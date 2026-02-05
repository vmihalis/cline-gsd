#!/usr/bin/env node

/**
 * Cline-GSD Installer
 * Entry point for `npx cline-gsd`
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ora from 'ora';
import { success, error, warn, info, dim, cyan } from '../src/output.js';
import { getPlatform, getClineWorkflowsDir, getGsdWorkflowsDir } from '../src/platform.js';
import { checkClineCli } from '../src/cline-check.js';
import { install } from '../src/installer.js';

// ESM pattern to get __dirname equivalent
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.join(__dirname, '..');

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
  console.log(`  ${dim('After installation, run /gsd-health.md in Cline to verify.')}`);
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
  const destDir = getGsdWorkflowsDir();
  info(`Install location: ${cyan(destDir)}`);

  // Step 4: Copy workflow files
  spinner.start('Copying workflows...');
  try {
    const result = await install({ verbose: args.verbose, force: args.force });
    spinner.succeed(`Installed ${result.filesInstalled} workflow(s)`);
  } catch (err) {
    spinner.fail('Installation failed');
    if (err.code === 'EACCES') {
      error('Permission denied. Try running with elevated privileges or check directory permissions.');
    } else {
      error(err.message);
    }
    process.exit(1);
  }

  // Step 5: Show changelog (what's new)
  await showChangelog();

  // Step 6: Success message
  console.log();
  success('Installation complete!');
  info(`Run ${cyan('/gsd-health.md')} in Cline to verify.`);
  console.log();
}

/**
 * Display changelog for latest version
 */
async function showChangelog() {
  try {
    const changelogPath = path.join(pkgRoot, 'CHANGELOG.md');
    const content = await fs.readFile(changelogPath, 'utf8');
    // Extract first version section (from ## [x.y.z] to --- or next ## [)
    const start = content.indexOf('## [');
    if (start === -1) return;

    // Find end - either --- separator or next version header
    let end = content.indexOf('\n---', start);
    const nextVersion = content.indexOf('\n## [', start + 1);
    if (nextVersion !== -1 && (end === -1 || nextVersion < end)) {
      end = nextVersion;
    }
    if (end === -1) end = content.length;

    const section = content.slice(start, end).trim();
    if (section) {
      // Remove the version header line for cleaner output
      const lines = section.split('\n');
      const body = lines.slice(1).join('\n').trim();
      if (body) {
        console.log('\n' + cyan('--- What\'s New ---'));
        console.log(body);
        console.log(cyan('------------------') + '\n');
      }
    }
  } catch {
    // Changelog not found, skip silently
  }
}

// Run main
main().catch((err) => {
  error(err.message);
  process.exit(1);
});
