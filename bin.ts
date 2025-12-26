#!/usr/bin/env node
import { satisfies } from 'semver';
import { red } from './src/utils/logging';

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';

const NODE_VERSION_RANGE = '>=18.17.0';

// Have to run this above the other imports because they are importing clack that
// has the problematic imports.
if (!satisfies(process.version, NODE_VERSION_RANGE)) {
  red(
    `Beltic wizard requires Node.js ${NODE_VERSION_RANGE}. You are using Node.js ${process.version}. Please upgrade your Node.js version.`,
  );
  process.exit(1);
}

import type { WizardOptions } from './src/utils/types';
import { runWizard } from './src/run';
import {
  readEnvironment,
  isNonInteractiveEnvironment,
} from './src/utils/environment';
import path from 'path';
import clack from './src/utils/clack';

if (isNonInteractiveEnvironment()) {
  clack.intro(chalk.inverse(`Beltic Wizard`));

  clack.log.error(
    'This installer requires an interactive terminal (TTY) to run.\n' +
      'It appears you are running in a non-interactive environment.\n' +
      'Please run the wizard in an interactive terminal.',
  );
  process.exit(1);
}

yargs(hideBin(process.argv))
  .env('BELTIC_WIZARD')
  // global options
  .options({
    debug: {
      default: false,
      describe: 'Enable verbose logging\nenv: BELTIC_WIZARD_DEBUG',
      type: 'boolean',
    },
    'anthropic-key': {
      describe:
        'Anthropic API key for LLM analysis\nenv: ANTHROPIC_API_KEY',
      type: 'string',
    },
  })
  .command(
    ['$0'],
    'Run the Beltic setup wizard to analyze your agent codebase and generate credentials',
    (yargs) => {
      return yargs.options({
        'install-dir': {
          describe:
            'Directory containing the agent codebase\nenv: BELTIC_WIZARD_INSTALL_DIR',
          type: 'string',
        },
        'skip-sign': {
          default: false,
          describe: 'Skip signing the credential (only generate manifest)',
          type: 'boolean',
        },
        'skip-readme': {
          default: false,
          describe: 'Skip updating the README.md file',
          type: 'boolean',
        },
        force: {
          default: false,
          describe: 'Overwrite existing Beltic files',
          type: 'boolean',
        },
        'skip-validation': {
          default: false,
          describe: 'Skip schema validation when signing (for local testing)',
          type: 'boolean',
        },
      });
    },
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async (argv) => {
      const envArgs = readEnvironment();
      const envInstallDir = envArgs.installDir as string | undefined;
      const envDebug = envArgs.debug as boolean | undefined;
      
      let resolvedInstallDir: string;
      if (argv.installDir) {
        const argInstallDir = argv.installDir as string;
        if (path.isAbsolute(argInstallDir)) {
          resolvedInstallDir = argInstallDir;
        } else {
          resolvedInstallDir = path.join(process.cwd(), argInstallDir);
        }
      } else if (envInstallDir) {
        if (path.isAbsolute(envInstallDir)) {
          resolvedInstallDir = envInstallDir;
        } else {
          resolvedInstallDir = path.join(process.cwd(), envInstallDir);
        }
      } else {
        resolvedInstallDir = process.cwd();
      }

      // Get Anthropic API key from CLI arg, environment, or use default (hardcoded)
      // Default key allows Beltic to cover costs on behalf of users
      const { DEFAULT_ANTHROPIC_API_KEY } = await import('./src/lib/constants.js');
      const anthropicKey =
        argv['anthropic-key'] ||
        process.env.ANTHROPIC_API_KEY ||
        DEFAULT_ANTHROPIC_API_KEY;

      const wizardOptions: WizardOptions = {
        debug: argv.debug ?? envDebug ?? false,
        installDir: resolvedInstallDir,
        anthropicKey,
        skipSign: argv['skip-sign'] ?? false,
        skipReadme: argv['skip-readme'] ?? false,
        force: argv.force ?? false,
        skipValidation: argv['skip-validation'] ?? false,
      };

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      runWizard(wizardOptions);
    },
  )
  .help()
  .alias('help', 'h')
  .version()
  .alias('version', 'v')
  .wrap(process.stdout.isTTY ? yargs.terminalWidth() : 80).argv;
