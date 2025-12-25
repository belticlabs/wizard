/**
 * Beltic CLI wrapper
 * Handles installation check, CLI installation, and command execution
 */

import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import clack from '../utils/clack';
import { debug } from '../utils/debug';
import {
  BELTIC_CLI_HOMEBREW_TAP,
  BELTIC_CLI_HOMEBREW_FORMULA,
  BELTIC_CLI_INSTALL_SCRIPT_URL,
} from '../lib/constants';

export type BelticCommandResult = {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
};

/**
 * Check if Beltic CLI is installed
 */
export function isBelticInstalled(): boolean {
  try {
    execSync('beltic --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get Beltic CLI version
 */
export function getBelticVersion(): string | null {
  try {
    const output = execSync('beltic --version', { stdio: 'pipe' });
    return output.toString().trim();
  } catch {
    return null;
  }
}

/**
 * Check if Homebrew is available
 */
function isHomebrewAvailable(): boolean {
  try {
    execSync('brew --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Install Beltic CLI
 * Tries Homebrew first, then falls back to curl installer
 */
export async function installBelticCli(): Promise<boolean> {
  const platform = os.platform();

  if (platform === 'darwin' || platform === 'linux') {
    // Try Homebrew first
    if (isHomebrewAvailable()) {
      clack.log.step('Installing Beltic CLI via Homebrew...');
      try {
        execSync(`brew tap ${BELTIC_CLI_HOMEBREW_TAP}`, { stdio: 'inherit' });
        execSync(`brew install ${BELTIC_CLI_HOMEBREW_FORMULA}`, {
          stdio: 'inherit',
        });
        return true;
      } catch (error) {
        clack.log.warn('Homebrew installation failed, trying curl installer...');
        debug('Homebrew install error:', error);
      }
    }

    // Fall back to curl installer
    clack.log.step('Installing Beltic CLI via curl...');
    try {
      execSync(`curl -fsSL ${BELTIC_CLI_INSTALL_SCRIPT_URL} | sh`, {
        stdio: 'inherit',
        shell: '/bin/bash',
      });
      return true;
    } catch (error) {
      clack.log.error('Failed to install Beltic CLI via curl');
      debug('Curl install error:', error);
      return false;
    }
  }

  clack.log.error(
    'Automatic installation is only supported on macOS and Linux. ' +
      'Please install the Beltic CLI manually: cargo install beltic',
  );
  return false;
}

/**
 * Run a Beltic CLI command
 */
export async function runBelticCommand(
  command: string,
  args: string[],
  cwd: string,
): Promise<BelticCommandResult> {
  return new Promise((resolve) => {
    const fullArgs = [command, ...args];
    debug(`Running: beltic ${fullArgs.join(' ')}`);

    const proc = spawn('beltic', fullArgs, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (exitCode) => {
      resolve({
        success: exitCode === 0,
        stdout,
        stderr,
        exitCode: exitCode ?? 1,
      });
    });

    proc.on('error', (error) => {
      resolve({
        success: false,
        stdout,
        stderr: stderr + '\n' + error.message,
        exitCode: 1,
      });
    });
  });
}

/**
 * Run beltic init command
 */
export async function runBelticInit(
  cwd: string,
  options: {
    output?: string;
    config?: string;
    force?: boolean;
    credential?: boolean;
  } = {},
): Promise<BelticCommandResult> {
  const args: string[] = ['--non-interactive'];

  if (options.output) {
    args.push('--output', options.output);
  }
  if (options.config) {
    args.push('--config', options.config);
  }
  if (options.force) {
    args.push('--force');
  }
  if (options.credential) {
    args.push('--credential');
  }

  return runBelticCommand('init', args, cwd);
}

/**
 * Run beltic fingerprint command
 */
export async function runBelticFingerprint(
  cwd: string,
  options: {
    manifest?: string;
    config?: string;
    verbose?: boolean;
  } = {},
): Promise<BelticCommandResult> {
  const args: string[] = [];

  if (options.manifest) {
    args.push('--manifest', options.manifest);
  }
  if (options.config) {
    args.push('--config', options.config);
  }
  if (options.verbose) {
    args.push('--verbose');
  }

  return runBelticCommand('fingerprint', args, cwd);
}

/**
 * Run beltic keygen command
 */
export async function runBelticKeygen(
  cwd: string,
  options: {
    alg?: 'EdDSA' | 'ES256';
    name?: string;
    out?: string;
    pub?: string;
  } = {},
): Promise<BelticCommandResult> {
  const args: string[] = ['--non-interactive'];

  if (options.alg) {
    args.push('--alg', options.alg);
  }
  if (options.name) {
    args.push('--name', options.name);
  }
  if (options.out) {
    args.push('--out', options.out);
  }
  if (options.pub) {
    args.push('--pub', options.pub);
  }

  return runBelticCommand('keygen', args, cwd);
}

/**
 * Run beltic sign command
 */
export async function runBelticSign(
  cwd: string,
  options: {
    key?: string;
    payload?: string;
    kid?: string;
    out?: string;
    skipValidation?: boolean;
    issuer?: string;
    subject?: string;
  } = {},
): Promise<BelticCommandResult> {
  const args: string[] = ['--non-interactive'];

  if (options.skipValidation) {
    args.push('--skip-schema');
  }
  if (options.issuer) {
    args.push('--issuer', options.issuer);
  }
  if (options.subject) {
    args.push('--subject', options.subject);
  }
  if (options.key) {
    args.push('--key', options.key);
  }
  if (options.payload) {
    args.push('--payload', options.payload);
  }
  if (options.kid) {
    args.push('--kid', options.kid);
  }
  if (options.out) {
    args.push('--out', options.out);
  }

  return runBelticCommand('sign', args, cwd);
}

/**
 * Run beltic verify command
 */
export async function runBelticVerify(
  cwd: string,
  options: {
    key?: string;
    token?: string;
  } = {},
): Promise<BelticCommandResult> {
  const args: string[] = ['--non-interactive'];

  if (options.key) {
    args.push('--key', options.key);
  }
  if (options.token) {
    args.push('--token', options.token);
  }

  return runBelticCommand('verify', args, cwd);
}

/**
 * Find the private key file in .beltic directory
 */
export function findPrivateKey(cwd: string): string | null {
  const belticDir = path.join(cwd, '.beltic');
  if (!fs.existsSync(belticDir)) {
    return null;
  }

  const files = fs.readdirSync(belticDir);
  const privateKeyFile = files.find(
    (f) => f.endsWith('-private.pem') || f.includes('private'),
  );

  if (privateKeyFile) {
    return path.join('.beltic', privateKeyFile);
  }
  return null;
}

/**
 * Find the public key file in .beltic directory
 */
export function findPublicKey(cwd: string): string | null {
  const belticDir = path.join(cwd, '.beltic');
  if (!fs.existsSync(belticDir)) {
    return null;
  }

  const files = fs.readdirSync(belticDir);
  const publicKeyFile = files.find(
    (f) => f.endsWith('-public.pem') || f.includes('public'),
  );

  if (publicKeyFile) {
    return path.join('.beltic', publicKeyFile);
  }
  return null;
}

/**
 * Find credential files
 */
export function findCredentialFiles(cwd: string): {
  manifest?: string;
  credential?: string;
} {
  const result: { manifest?: string; credential?: string } = {};

  if (fs.existsSync(path.join(cwd, 'agent-manifest.json'))) {
    result.manifest = 'agent-manifest.json';
  }
  if (fs.existsSync(path.join(cwd, 'agent-credential.json'))) {
    result.credential = 'agent-credential.json';
  }

  return result;
}
