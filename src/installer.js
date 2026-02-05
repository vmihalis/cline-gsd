/**
 * Core installation logic for Cline-GSD
 * Copies workflow files to user's Cline configuration
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { getGsdWorkflowsDir } from './platform.js';

// ESM pattern to get __dirname equivalent
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.join(__dirname, '..');

// ESM pattern to read package.json
const require = createRequire(import.meta.url);
const pkg = require('../package.json');

// Track created paths for rollback on failure
const createdPaths = [];

/**
 * Track a created path for potential rollback
 * @param {string} p - Path that was created
 */
function trackCreated(p) {
  createdPaths.push(p);
}

/**
 * Rollback created paths on failure
 * Best effort cleanup - silently ignores errors
 */
export async function rollback() {
  for (const p of createdPaths.reverse()) {
    try {
      await fs.rm(p, { recursive: true, force: true });
    } catch {
      // Best effort cleanup - continue even if removal fails
    }
  }
  // Clear tracked paths after rollback
  createdPaths.length = 0;
}

/**
 * Copy workflow files from package to destination
 * @param {string} destDir - Destination directory
 * @param {boolean} verbose - Show detailed output
 * @returns {Promise<number>} Count of files copied
 */
export async function copyWorkflows(destDir, verbose = false) {
  const srcDir = path.join(pkgRoot, 'workflows', 'gsd');

  // Ensure destination exists
  await fs.mkdir(destDir, { recursive: true });
  trackCreated(destDir);

  // Read all .md files from source
  const files = await fs.readdir(srcDir);
  let count = 0;

  for (const file of files) {
    if (file.endsWith('.md')) {
      const srcPath = path.join(srcDir, file);
      const destPath = path.join(destDir, file);
      await fs.copyFile(srcPath, destPath);
      trackCreated(destPath);
      count++;
      if (verbose) {
        console.log(`    Copied: ${file}`);
      }
    }
  }

  return count;
}

/**
 * Write GSD VERSION file to destination directory
 * @param {string} destDir - Destination directory
 */
export async function writeVersion(destDir) {
  const versionPath = path.join(destDir, 'gsd-VERSION');
  await fs.writeFile(versionPath, pkg.version, 'utf8');
  trackCreated(versionPath);
}

/**
 * Remove existing GSD workflow files from destination
 * @param {string} destDir - Destination directory
 * @param {boolean} verbose - Show detailed output
 */
async function cleanGsdFiles(destDir, verbose = false) {
  try {
    const files = await fs.readdir(destDir);
    for (const file of files) {
      if (file.startsWith('gsd-')) {
        const filePath = path.join(destDir, file);
        await fs.rm(filePath, { force: true });
        if (verbose) {
          console.log(`    Removed: ${file}`);
        }
      }
    }
  } catch {
    // Directory doesn't exist or can't read, that's fine
  }
}

/**
 * Main installation function
 * @param {Object} options - Installation options
 * @param {boolean} options.verbose - Show detailed output
 * @param {boolean} options.force - Force overwrite existing installation
 * @returns {Promise<{success: boolean, filesInstalled: number, location: string}>}
 */
export async function install(options = {}) {
  const { verbose = false, force = false } = options;
  const destDir = getGsdWorkflowsDir();

  try {
    // Clean existing GSD files (gsd-* prefix)
    if (verbose) {
      console.log(`    Checking for existing GSD workflows...`);
    }
    await cleanGsdFiles(destDir, verbose);

    // Copy workflow files
    const filesInstalled = await copyWorkflows(destDir, verbose);

    // Write VERSION file
    await writeVersion(destDir);

    return {
      success: true,
      filesInstalled,
      location: destDir
    };
  } catch (err) {
    // Handle permission errors with friendly message
    if (err.code === 'EACCES') {
      err.message = `Permission denied: ${err.path || destDir}`;
    }

    // Rollback any partial installation
    await rollback();

    throw err;
  }
}
