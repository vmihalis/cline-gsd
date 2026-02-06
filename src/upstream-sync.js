/**
 * Upstream sync helpers for Cline-GSD
 *
 * Provides version comparison and upstream checking for the sync workflow.
 * This is a thin module -- the actual update mechanism is `npx cline-gsd@latest`.
 * These helpers let the workflow check if an update is available before guiding
 * the user through re-installation.
 *
 * Pure functions:  compareVersions
 * I/O functions:   getInstalledVersion, checkUpstreamVersion
 *
 * Exports: getInstalledVersion, compareVersions, checkUpstreamVersion
 */

import { readFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Pure functions (no I/O)
// ---------------------------------------------------------------------------

/**
 * Compare two semver version strings.
 *
 * Simple numeric comparison of major.minor.patch segments.
 * Does not handle pre-release or build metadata -- just the three
 * numeric parts that matter for upstream sync checking.
 *
 * @param {string} current - Current installed version (e.g. "1.0.0")
 * @param {string} latest - Latest published version (e.g. "1.1.0")
 * @returns {{ needsUpdate: boolean, current: string, latest: string, comparison: 'up-to-date'|'behind'|'ahead' }}
 */
export function compareVersions(current, latest) {
  const currentParts = current.split('.').map(Number);
  const latestParts = latest.split('.').map(Number);

  // Pad to at least 3 segments
  while (currentParts.length < 3) currentParts.push(0);
  while (latestParts.length < 3) latestParts.push(0);

  for (let i = 0; i < 3; i++) {
    if (currentParts[i] < latestParts[i]) {
      return { needsUpdate: true, current, latest, comparison: 'behind' };
    }
    if (currentParts[i] > latestParts[i]) {
      return { needsUpdate: false, current, latest, comparison: 'ahead' };
    }
  }

  return { needsUpdate: false, current, latest, comparison: 'up-to-date' };
}

// ---------------------------------------------------------------------------
// I/O functions (async, error-return pattern)
// ---------------------------------------------------------------------------

/**
 * Read the local package.json and extract the version field.
 *
 * @param {string} [projectRoot='.'] - Path to the project root directory
 * @returns {Promise<{ success: boolean, data?: { version: string, path: string }, error?: string }>}
 */
export async function getInstalledVersion(projectRoot = '.') {
  try {
    const pkgPath = path.resolve(projectRoot, 'package.json');
    const raw = await readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw);

    if (!pkg.version) {
      return { success: false, error: `No version field found in ${pkgPath}` };
    }

    return { success: true, data: { version: pkg.version, path: pkgPath } };
  } catch (err) {
    return { success: false, error: `Failed to read package.json: ${err.message}` };
  }
}

/**
 * Check the latest published version of a package on npm.
 *
 * Uses `npm view <packageName> version` to fetch the latest version
 * from the registry. Returns an error if the command fails (network
 * issue, package not published, etc.).
 *
 * @param {string} [packageName='cline-gsd'] - npm package name to check
 * @returns {Promise<{ success: boolean, data?: { version: string, packageName: string }, error?: string }>}
 */
export async function checkUpstreamVersion(packageName = 'cline-gsd') {
  try {
    const output = execSync(`npm view ${packageName} version`, {
      encoding: 'utf-8',
      timeout: 15000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const version = output.trim();
    if (!version) {
      return { success: false, error: `Empty version returned for ${packageName}` };
    }

    return { success: true, data: { version, packageName } };
  } catch (err) {
    return { success: false, error: `Failed to check upstream version: ${err.message}` };
  }
}
