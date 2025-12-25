import * as childProcess from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { basename, isAbsolute, relative, join } from 'node:path';

import chalk from 'chalk';
import { debug } from './debug';
import { type PackageDotJson, hasPackageInstalled } from './package-json';
import {
  type PackageManager,
  detectAllPackageManagers,
  packageManagers,
} from './package-manager';
import type { WizardOptions } from './types';
import { ISSUES_URL } from '../lib/constants';
import clack from './clack';

export async function abort(message?: string, status?: number): Promise<never> {
  clack.outro(message ?? 'Wizard setup cancelled.');
  return process.exit(status ?? 1);
}

export async function abortIfCancelled<T>(
  input: T | Promise<T>,
): Promise<Exclude<T, symbol>> {
  const resolvedInput = await input;

  if (
    clack.isCancel(resolvedInput) ||
    (typeof resolvedInput === 'symbol' &&
      resolvedInput.description === 'clack:cancel')
  ) {
    clack.cancel('Wizard setup cancelled.');
    process.exit(0);
  } else {
    return input as Exclude<T, symbol>;
  }
}

export function printWelcome(options: {
  wizardName: string;
  message?: string;
}): void {
  // eslint-disable-next-line no-console
  console.log('');
  clack.intro(chalk.inverse(` ${options.wizardName} `));

  const welcomeText =
    options.message ||
    `The ${options.wizardName} will help you set up Beltic credentials for your agent.`;

  clack.note(welcomeText);
}

export function isInGitRepo() {
  try {
    childProcess.execSync('git rev-parse --is-inside-work-tree', {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

export function getUncommittedOrUntrackedFiles(): string[] {
  try {
    const gitStatus = childProcess
      .execSync('git status --porcelain=v1', {
        // we only care about stdout
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      .toString();

    const files = gitStatus
      .split(os.EOL)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((f) => `- ${f.split(/\s+/)[1]}`);

    return files;
  } catch {
    return [];
  }
}

export async function askForItemSelection(
  items: string[],
  message: string,
): Promise<{ value: string; index: number }> {
  const selection: { value: string; index: number } | symbol =
    await abortIfCancelled(
      clack.select({
        maxItems: 12,
        message: message,
        options: items.map((item, index) => {
          return {
            value: { value: item, index: index },
            label: item,
          };
        }),
      }),
    );

  return selection;
}

export async function ensurePackageIsInstalled(
  packageJson: PackageDotJson,
  packageId: string,
  packageName: string,
): Promise<void> {
  const installed = hasPackageInstalled(packageId, packageJson);

  if (!installed) {
    const continueWithoutPackage = await abortIfCancelled(
      clack.confirm({
        message: `${packageName} does not seem to be installed. Do you still want to continue?`,
        initialValue: false,
      }),
    );

    if (!continueWithoutPackage) {
      await abort(undefined, 0);
    }
  }
}

export async function getPackageDotJson({
  installDir,
}: Pick<WizardOptions, 'installDir'>): Promise<PackageDotJson> {
  const packageJsonFileContents = await fs.promises
    .readFile(join(installDir, 'package.json'), 'utf8')
    .catch(() => {
      return '{}';
    });

  let packageJson: PackageDotJson | undefined = undefined;

  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    packageJson = JSON.parse(packageJsonFileContents);
  } catch {
    return {};
  }

  return packageJson || {};
}

export async function updatePackageDotJson(
  packageDotJson: PackageDotJson,
  { installDir }: Pick<WizardOptions, 'installDir'>,
): Promise<void> {
  try {
    await fs.promises.writeFile(
      join(installDir, 'package.json'),
      JSON.stringify(packageDotJson, null, 2),
      {
        encoding: 'utf8',
        flag: 'w',
      },
    );
  } catch {
    clack.log.error(`Unable to update your package.json.`);
    await abort();
  }
}

export async function getPackageManager({
  installDir,
}: Pick<WizardOptions, 'installDir'>): Promise<PackageManager> {
  const detectedPackageManagers = detectAllPackageManagers({ installDir });

  // If exactly one package manager detected, use it automatically
  if (detectedPackageManagers.length === 1) {
    const detectedPackageManager = detectedPackageManagers[0];
    return detectedPackageManager;
  }

  // If multiple or no package managers detected, prompt user to select
  const options =
    detectedPackageManagers.length > 0
      ? detectedPackageManagers
      : packageManagers;

  const message =
    detectedPackageManagers.length > 1
      ? 'Multiple package managers detected. Please select one:'
      : 'Please select your package manager.';

  const selectedPackageManager: PackageManager | symbol =
    await abortIfCancelled(
      clack.select({
        message,
        options: options.map((packageManager) => ({
          value: packageManager,
          label: packageManager.label,
        })),
      }),
    );

  return selectedPackageManager;
}

export function isUsingTypeScript({
  installDir,
}: Pick<WizardOptions, 'installDir'>) {
  try {
    return fs.existsSync(join(installDir, 'tsconfig.json'));
  } catch {
    return false;
  }
}

/**
 * Prints copy/paste-able instructions to the console.
 */
export async function showCopyPasteInstructions(
  filename: string,
  codeSnippet: string,
  hint?: string,
): Promise<void> {
  clack.log.step(
    `Add the following code to your ${chalk.cyan(basename(filename))} file:${
      hint ? chalk.dim(` (${chalk.dim(hint)})`) : ''
    }`,
  );

  // eslint-disable-next-line no-console
  console.log(`\n${codeSnippet}\n`);

  await abortIfCancelled(
    clack.select({
      message: 'Did you apply the snippet above?',
      options: [{ label: 'Yes, continue!', value: true }],
      initialValue: true,
    }),
  );
}

/**
 * Callback that exposes formatting helpers for a code snippet.
 */
type CodeSnippetFormatter = (
  unchanged: (txt: string) => string,
  plus: (txt: string) => string,
  minus: (txt: string) => string,
) => string;

/**
 * Crafts a code snippet that can be used to print copy/paste instructions.
 */
export function makeCodeSnippet(
  colors: boolean,
  callback: CodeSnippetFormatter,
): string {
  const unchanged = (txt: string) => (colors ? chalk.grey(txt) : txt);
  const plus = (txt: string) => (colors ? chalk.greenBright(txt) : txt);
  const minus = (txt: string) => (colors ? chalk.redBright(txt) : txt);

  return callback(unchanged, plus, minus);
}

/**
 * Creates a new config file.
 */
export async function createNewConfigFile(
  filepath: string,
  codeSnippet: string,
  { installDir }: Pick<WizardOptions, 'installDir'>,
  moreInformation?: string,
): Promise<boolean> {
  if (!isAbsolute(filepath)) {
    debug(`createNewConfigFile: filepath is not absolute: ${filepath}`);
    return false;
  }

  const prettyFilename = chalk.cyan(relative(installDir, filepath));

  try {
    await fs.promises.writeFile(filepath, codeSnippet);

    clack.log.success(`Added new ${prettyFilename} file.`);

    if (moreInformation) {
      clack.log.info(chalk.gray(moreInformation));
    }

    return true;
  } catch (e) {
    debug(e);
    clack.log.warn(
      `Could not create a new ${prettyFilename} file. Please create one manually.`,
    );
  }

  return false;
}
