#!/usr/bin/env node

/**
 * Cline-GSD Installer
 * Entry point for `npx cline-gsd`
 */

import { createRequire } from 'node:module';
import ora from 'ora';
import { success, error, warn, info, dim, cyan } from '../src/output.js';
import { getPlatform, getClineConfigDir } from '../src/platform.js';
import { checkClineCli } from '../src/cline-check.js';

// ESM pattern to read package.json
const require = createRequire(import.meta.url);
const pkg = require('../package.json');

// Parse CLI arguments
function parseArgs(argv) {
  const args = {
    help: false,
    verbose: false,
    force: false,
    version: false
  };

  for (const arg of argv) {
    switch (arg) {
      case '--help':
      case '-h':
        args.help = true;
        break;
      case '--verbose':
      case '-v':
        args.verbose = true;
        break;
      case '--force':
      case '-f':
        args.force = true;
        break;
      case '--version':
        args.version = true;
        break;
    }
  }

  return args;
}

// Display banner
function showBanner() {
  console.log();
  console.log(`  ${cyan('Cline-GSD')} ${dim(`v${pkg.version}`)}`);
  console.log(`  GSD workflow system for Cline`);
  console.log();
}

// Display help
function showHelp() {
  console.log(`  ${dim('Usage:')} npx cline-gsd [options]`);
  console.log();
  console.log(`  ${dim('Options:')}`);
  console.log(`    -h, --help     Show this help message`);
  console.log(`    -v, --verbose  Show detailed output`);
  console.log(`    -f, --force    Force overwrite existing installation`);
  console.log(`    --version      Show version number`);
  console.log();
  console.log(`  ${dim('After installation, run /gsd:health in Cline to verify.')}`);
  console.log();
}

// Display version
function showVersion() {
  console.log(pkg.version);
}

// Main installation function
async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.version) {
    showVersion();
    process.exit(0);
  }

  showBanner();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  if (args.verbose) {
    info('Verbose mode enabled');
  }
  if (args.force) {
    info('Force mode enabled');
  }

  // Step 1: Detect platform
  const spinner = ora('Detecting platform...').start();
  const platform = getPlatform();
  spinner.succeed(`Platform: ${cyan(platform)}`);

  // Step 2: Check Cline CLI
  spinner.start('Checking for Cline CLI...');
  const clineStatus = await checkClineCli();
  if (clineStatus.installed) {
    spinner.succeed(`Cline CLI found (${cyan(clineStatus.version || 'version unknown')})`);
  } else {
    spinner.warn('Cline CLI not found');
    warn('Cline-GSD requires Cline CLI. Install it first:');
    info('  npm install -g @anthropics/cline');
    info('Continuing installation anyway...');
  }

  // Step 3: Show target directory
  const configDir = getClineConfigDir();
  info(`Install location: ${cyan(configDir)}`);

  // TODO: Copy workflow files (Plan 03)
}

// Run main
main().catch((err) => {
  error(err.message);
  process.exit(1);
});
