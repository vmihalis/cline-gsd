#!/usr/bin/env node

/**
 * Cline-GSD Installer
 * Entry point for `npx cline-gsd`
 */

import { createRequire } from 'node:module';
import { success, error, warn, info, dim, cyan } from '../src/output.js';

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

// Main
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

// Placeholder for installation logic (next plan)
info('Installation starting...');
if (args.verbose) {
  info('Verbose mode enabled');
}
if (args.force) {
  info('Force mode enabled');
}
