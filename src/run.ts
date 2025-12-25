/**
 * Main entry point for the Beltic wizard
 * Orchestrates the workflow: authenticate -> detect -> analyze -> generate -> sign
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import clack from './utils/clack';
import type { WizardOptions } from './utils/types';
import { debug, initLogFile, LOG_FILE_PATH } from './utils/debug';
import {
  detectCodebase,
  isBelticInstalled,
  installBelticCli,
  getBelticVersion,
  generateBelticYaml,
  writeBelticYaml,
  belticYamlExists,
  readBelticYaml,
  runBelticInit,
  runBelticFingerprint,
  runBelticKeygen,
  runBelticSign,
  findPrivateKey,
  findCredentialFiles,
  updateGitignore,
  hasBelticEntries,
  updateReadme,
  hasBelticSection,
  analyzeAndPatchManifest,
  type DetectionResult,
} from './beltic';
import {
  DOCS_URL,
  ISSUES_URL,
  PLACEHOLDER_ISSUER_DID,
  generatePlaceholderSubjectDid,
  KYA_API_URL,
} from './lib/constants';
import { performBelticOAuth } from './lib/workos-oauth';
import { fetchDeveloperData } from './lib/api';
import {
  saveCredentials,
  loadCredentials,
  hasValidCredentials,
  type StoredCredentials,
} from './lib/credentials';
import { abort } from './utils/clack-utils';

/**
 * Authenticate with the KYA platform via WorkOS OAuth
 *
 * Flow:
 * 1. Check for existing valid credentials
 * 2. If none/expired, prompt user to login
 * 3. Perform OAuth flow with WorkOS AuthKit
 * 4. Fetch developer data from KYA API
 * 5. Save credentials to ~/.beltic/credentials.json
 */
async function authenticateWithKya(): Promise<StoredCredentials> {
  // Check for existing valid credentials
  const existing = loadCredentials();
  if (existing && hasValidCredentials()) {
    clack.log.info(`Logged in as ${chalk.cyan(existing.email)}`);
    return existing;
  }

  // Credentials are missing or expired
  if (existing && !hasValidCredentials()) {
    clack.log.warn('Your session has expired. Please log in again.');
  }

  // Prompt user to login
  const shouldLogin = await clack.confirm({
    message: 'Login to Beltic to continue?',
    initialValue: true,
  });

  if (clack.isCancel(shouldLogin) || !shouldLogin) {
    clack.log.error('Authentication is required to use the Beltic wizard.');
    await abort();
    throw new Error('Authentication cancelled');
  }

  // Perform OAuth flow
  const spinner = clack.spinner();

  try {
    const tokenResponse = await performBelticOAuth();

    spinner.start('Fetching your developer profile...');

    // Fetch developer data from KYA API
    const developer = await fetchDeveloperData(
      tokenResponse.access_token,
      KYA_API_URL,
    );

    spinner.stop(`Welcome, ${chalk.cyan(developer.name || developer.email)}!`);

    // Build credentials object
    const credentials: StoredCredentials = {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      developerId: developer.id,
      email: developer.email,
      name: developer.name,
      expiresAt: tokenResponse.expires_in
        ? Date.now() + tokenResponse.expires_in * 1000
        : undefined,
    };

    // Save credentials
    saveCredentials(credentials);
    debug('Credentials saved successfully');

    return credentials;
  } catch (error) {
    spinner.stop('Authentication failed');
    debug('Auth error:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    clack.log.error(
      `Failed to authenticate: ${errorMessage}\n\n${chalk.dim(
        `If you think this is a bug, please report it:\n${ISSUES_URL}`,
      )}`,
    );

    await abort();
    throw error;
  }
}

export async function runWizard(options: WizardOptions): Promise<void> {
  initLogFile();

  clack.intro(chalk.inverse(` Beltic Wizard `));

  const installDir = options.installDir;

  // Verify directory exists
  if (!fs.existsSync(installDir)) {
    clack.log.error(`Directory does not exist: ${installDir}`);
    process.exit(1);
  }

  debug('Starting wizard with options:', options);
  debug('Install directory:', installDir);

  try {
    // Step 0: Authenticate with KYA platform
    const credentials = await authenticateWithKya();
    debug('Authenticated as:', credentials.email);

    // Step 1: Check/Install Beltic CLI
    await ensureBelticCli();

    // Step 2: Check existing files and get user confirmation
    const existingFiles = await checkExistingFiles(installDir, options);

    // Step 3: Detect codebase
    const detection = await detectAndAnalyzeCodebase(installDir);

    // Step 4: Generate .beltic.yaml
    await generateConfiguration(installDir, detection, options, existingFiles);

    // Step 5: Run beltic init (or update manifest)
    await initializeManifest(installDir, options, existingFiles);

    // Step 6: Run beltic fingerprint
    await generateFingerprint(installDir, existingFiles);

    // Step 7: Generate keys and sign (unless skipped)
    if (!options.skipSign) {
      await generateKeysAndSign(installDir, options, detection);
    }

    // Step 8: Update .gitignore
    await updateGitignoreFile(installDir);

    // Step 9: Update README (unless skipped)
    if (!options.skipReadme) {
      await updateReadmeFile(installDir, detection.agentName);
    }

    // Final summary
    printSummary(installDir, detection.agentName, options);
  } catch (error) {
    clack.log.error(`An error occurred: ${(error as Error).message}`);
    debug('Full error:', error);
    
    clack.outro(
      `If you need help, please open an issue: ${chalk.cyan(ISSUES_URL)}`,
    );
    process.exit(1);
  }
}

type ExistingFiles = {
  hasYaml: boolean;
  hasManifest: boolean;
  hasCredential: boolean;
  hasKeys: boolean;
  shouldRegenerate: boolean;
  shouldUpdateFingerprint: boolean;
};

/**
 * Check for existing Beltic files and get user confirmation
 */
async function checkExistingFiles(
  installDir: string,
  options: WizardOptions,
): Promise<ExistingFiles> {
  const hasYaml = belticYamlExists(installDir);
  const hasManifest = fs.existsSync(path.join(installDir, 'agent-manifest.json'));
  const hasCredential = fs.existsSync(path.join(installDir, 'agent-credential.jwt'));
  const hasKeys = findPrivateKey(installDir) !== null;

  const existing: ExistingFiles = {
    hasYaml,
    hasManifest,
    hasCredential,
    hasKeys,
    shouldRegenerate: options.force,
    shouldUpdateFingerprint: true,
  };

  // If force is set, skip prompts
  if (options.force) {
    return existing;
  }

  // If any files exist, show status and ask what to do
  if (hasYaml || hasManifest || hasCredential) {
    clack.log.info('Found existing Beltic files:');
    if (hasYaml) clack.log.info(`  • ${chalk.cyan('.beltic.yaml')}`);
    if (hasManifest) clack.log.info(`  • ${chalk.cyan('agent-manifest.json')}`);
    if (hasCredential) clack.log.info(`  • ${chalk.cyan('agent-credential.jwt')}`);
    if (hasKeys) clack.log.info(`  • ${chalk.cyan('.beltic/')} (keys)`);

    // Check if code has changed (compare fingerprint timestamp vs source files)
    const manifestMtime = hasManifest
      ? fs.statSync(path.join(installDir, 'agent-manifest.json')).mtime
      : null;

    // Ask user what to do
    const action = await clack.select({
      message: 'What would you like to do?',
      options: [
        {
          value: 'update',
          label: 'Update fingerprint only',
          hint: 'Keep existing config, regenerate fingerprint and re-sign',
        },
        {
          value: 'regenerate',
          label: 'Regenerate all files',
          hint: 'Re-analyze codebase and regenerate everything',
        },
        {
          value: 'skip',
          label: 'Skip to signing',
          hint: 'Only regenerate fingerprint and sign (keep all existing files)',
        },
      ],
    });

    if (clack.isCancel(action)) {
      clack.cancel('Wizard cancelled.');
      process.exit(0);
    }

    if (action === 'regenerate') {
      existing.shouldRegenerate = true;
    } else if (action === 'skip') {
      existing.shouldRegenerate = false;
      existing.shouldUpdateFingerprint = true;
    } else {
      existing.shouldRegenerate = false;
      existing.shouldUpdateFingerprint = true;
    }
  }

  return existing;
}

/**
 * Ensure Beltic CLI is installed
 */
async function ensureBelticCli(): Promise<void> {
  const spinner = clack.spinner();
  spinner.start('Checking for Beltic CLI...');

  if (isBelticInstalled()) {
    const version = getBelticVersion();
    spinner.stop(`Beltic CLI found: ${version}`);
    return;
  }

  spinner.stop('Beltic CLI not found');

  const shouldInstall = await clack.confirm({
    message: 'Beltic CLI is not installed. Would you like to install it now?',
    initialValue: true,
  });

  if (clack.isCancel(shouldInstall) || !shouldInstall) {
    clack.log.error(
      'Beltic CLI is required. Please install it manually:\n' +
        '  brew tap belticlabs/tap && brew install beltic\n' +
        '  Or: cargo install beltic',
    );
    process.exit(1);
  }

  spinner.start('Installing Beltic CLI...');
  const success = await installBelticCli();

  if (!success) {
    spinner.stop('Installation failed');
    clack.log.error(
      'Failed to install Beltic CLI. Please install it manually:\n' +
        '  brew tap belticlabs/tap && brew install beltic\n' +
        '  Or: cargo install beltic',
    );
    process.exit(1);
  }

  spinner.stop('Beltic CLI installed successfully');
}

/**
 * Detect and analyze codebase
 */
async function detectAndAnalyzeCodebase(installDir: string) {
  const spinner = clack.spinner();
  spinner.start('Analyzing codebase...');

  const detection = await detectCodebase(installDir);

  spinner.stop('Codebase analysis complete');

  clack.log.info(
    `Detected: ${chalk.cyan(detection.language)} ${detection.deploymentType} agent` +
      (detection.modelProvider ? ` using ${chalk.cyan(detection.modelProvider)}` : ''),
  );
  clack.log.info(`Agent name: ${chalk.cyan(detection.agentName)}`);

  return detection;
}

/**
 * Generate .beltic.yaml configuration
 */
async function generateConfiguration(
  installDir: string,
  detection: Awaited<ReturnType<typeof detectCodebase>>,
  options: WizardOptions,
  existing: ExistingFiles,
): Promise<void> {
  if (existing.hasYaml && !existing.shouldRegenerate) {
    clack.log.info('.beltic.yaml exists, using existing configuration');
    return;
  }

  const spinner = clack.spinner();
  spinner.start('Generating .beltic.yaml configuration...');

  try {
    const config = await generateBelticYaml(installDir, detection, options);
    writeBelticYaml(installDir, config);
    spinner.stop('.beltic.yaml generated');
  } catch (error) {
    spinner.stop('Failed to generate .beltic.yaml');
    debug('YAML generation error:', error);
    throw error;
  }
}

/**
 * Initialize agent manifest
 */
async function initializeManifest(
  installDir: string,
  options: WizardOptions,
  existing: ExistingFiles,
): Promise<void> {
  if (existing.hasManifest && !existing.shouldRegenerate) {
    clack.log.info('agent-manifest.json exists, using existing manifest');
    return;
  }

  const spinner = clack.spinner();
  spinner.start('Initializing agent manifest...');

  const result = await runBelticInit(installDir, {
    config: '.beltic.yaml',
    force: existing.shouldRegenerate,
  });

  if (!result.success) {
    spinner.stop('Failed to initialize manifest');
    clack.log.error(`Error: ${result.stderr}`);
    throw new Error('beltic init failed');
  }

  spinner.stop('Agent manifest created');
}

/**
 * Generate code fingerprint
 */
async function generateFingerprint(
  installDir: string,
  existing: ExistingFiles,
): Promise<void> {
  if (!existing.shouldUpdateFingerprint) {
    return;
  }

  const spinner = clack.spinner();
  spinner.start('Generating code fingerprint...');

  const result = await runBelticFingerprint(installDir, {
    config: '.beltic.yaml',
  });

  if (!result.success) {
    spinner.stop('Failed to generate fingerprint');
    clack.log.error(`Error: ${result.stderr}`);
    throw new Error('beltic fingerprint failed');
  }

  spinner.stop('Code fingerprint generated');
}

/**
 * Generate cryptographic keys and sign credential
 */
async function generateKeysAndSign(
  installDir: string,
  options: WizardOptions,
  detection: DetectionResult,
): Promise<void> {
  const agentName = detection.agentName;
  
  // Check if keys already exist
  let privateKey = findPrivateKey(installDir);

  if (!privateKey) {
    const spinner = clack.spinner();
    spinner.start('Generating cryptographic keypair...');

    const keyResult = await runBelticKeygen(installDir, {
      alg: 'EdDSA',
    });

    if (!keyResult.success) {
      spinner.stop('Failed to generate keypair');
      clack.log.error(`Error: ${keyResult.stderr}`);
      throw new Error('beltic keygen failed');
    }

    spinner.stop('Keypair generated');
    privateKey = findPrivateKey(installDir);
  } else {
    clack.log.info('Using existing keypair');
  }

  if (!privateKey) {
    throw new Error('Could not find private key after keygen');
  }

  const { manifest } = findCredentialFiles(installDir);
  if (!manifest) {
    throw new Error('agent-manifest.json not found');
  }

  // Use LLM to analyze codebase and fill in manifest fields intelligently
  clack.log.step('Analyzing codebase to fill manifest fields...');
  
  try {
    await analyzeAndPatchManifest(
      installDir,
      agentName,
      detection,
      options.anthropicKey,
      (message) => clack.log.info(chalk.dim(message)),
    );
    clack.log.success('Manifest analysis complete');
  } catch (error) {
    clack.log.warn('Manifest analysis failed, using defaults');
    debug('Manifest analysis error:', error);
  }

  // Sign the credential
  const signSpinner = clack.spinner();
  signSpinner.start('Signing agent credential...');

  // Generate placeholder DIDs for self-signing
  const issuerDid = PLACEHOLDER_ISSUER_DID;
  const subjectDid = generatePlaceholderSubjectDid(agentName);

  const signResult = await runBelticSign(installDir, {
    key: privateKey,
    payload: manifest,
    kid: 'agent-key',
    out: 'agent-credential.jwt',
    skipValidation: options.skipValidation,
    issuer: issuerDid,
    subject: subjectDid,
  });

  if (!signResult.success) {
    signSpinner.stop('Failed to sign credential');
    clack.log.error(`Error: ${signResult.stderr}`);
    
    // Suggest using --skip-validation for local testing
    if (signResult.stderr.includes('schema validation failed')) {
      clack.log.warn(
        chalk.yellow('\nTip: For local testing, you can use --skip-validation to skip schema validation.')
      );
    }
    
    throw new Error('beltic sign failed');
  }

  signSpinner.stop('Agent credential signed');
  clack.log.info(chalk.dim(`Issuer: ${issuerDid}`));
  clack.log.info(chalk.dim(`Subject: ${subjectDid}`));
}

/**
 * Update .gitignore with Beltic entries
 */
async function updateGitignoreFile(installDir: string): Promise<void> {
  if (hasBelticEntries(installDir)) {
    return;
  }

  const updated = updateGitignore(installDir);
  if (updated) {
    clack.log.info('.gitignore updated with Beltic entries');
  }
}

/**
 * Update README with Beltic section
 */
async function updateReadmeFile(
  installDir: string,
  agentName: string,
): Promise<void> {
  if (hasBelticSection(installDir)) {
    return;
  }

  const updated = updateReadme(installDir, agentName);
  if (updated) {
    clack.log.info('README.md updated with Beltic section');
  }
}

/**
 * Print final summary
 */
function printSummary(
  installDir: string,
  agentName: string,
  options: WizardOptions,
): void {
  const files = [
    '.beltic.yaml - Configuration',
    'agent-manifest.json - Agent manifest',
  ];

  if (!options.skipSign) {
    files.push(
      'agent-credential.jwt - Signed credential',
      '.beltic/ - Cryptographic keys',
    );
  }

  const nextSteps = [
    'Review the generated files and verify they are correct',
    'Commit the credential files to your repository',
  ];

  if (!options.skipSign) {
    nextSteps.push(
      'After code changes, run: beltic fingerprint && beltic sign',
      'To verify: beltic verify --key .beltic/*-public.pem --token agent-credential.jwt',
    );
  } else {
    nextSteps.push(
      'Run beltic keygen to generate keys',
      'Run beltic sign to sign the credential',
    );
  }

  if (options.skipValidation) {
    nextSteps.unshift(
      chalk.yellow('⚠ Signed without validation - credential may not be valid for production'),
    );
  }

  const outroMessage = `
${chalk.green('Successfully set up Beltic for ' + agentName + '!')}

${chalk.cyan('Generated files:')}
${files.map((f) => `  • ${f}`).join('\n')}

${chalk.yellow('Next steps:')}
${nextSteps.map((step) => `  • ${step}`).join('\n')}

${chalk.dim(`Verbose logs: ${LOG_FILE_PATH}`)}

Learn more: ${chalk.cyan(DOCS_URL)}
`;

  clack.outro(outroMessage);
}
