/**
 * Cline CLI verification utilities
 * Check if Cline CLI is installed and get version
 */

import commandExists from 'command-exists';
import { execSync } from 'node:child_process';

/**
 * Get the Cline CLI version
 * @returns {Promise<string | null>} Version string or null if unavailable
 */
export async function getClineVersion() {
  try {
    const output = execSync('cline --version', {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return output.trim();
  } catch {
    return null;
  }
}

/**
 * Check if Cline CLI is installed
 * @returns {Promise<{installed: boolean, version: string | null}>}
 */
export async function checkClineCli() {
  try {
    await commandExists('cline');
    const version = await getClineVersion();
    return { installed: true, version };
  } catch {
    return { installed: false, version: null };
  }
}
