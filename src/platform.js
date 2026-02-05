/**
 * Platform detection utilities for Cline-GSD
 * Cross-platform path and environment handling
 */

import os from 'node:os';
import path from 'node:path';

/**
 * Get the current platform as a friendly name
 * @returns {'mac' | 'windows' | 'linux' | 'unknown'}
 */
export function getPlatform() {
  const platform = os.platform();
  switch (platform) {
    case 'darwin':
      return 'mac';
    case 'win32':
      return 'windows';
    case 'linux':
      return 'linux';
    default:
      return 'unknown';
  }
}

/**
 * Get the user's home directory
 * @returns {string}
 */
export function getHomeDir() {
  return os.homedir();
}

/**
 * Get the Cline configuration directory
 * Respects CLINE_DIR environment variable for override
 * @returns {string}
 */
export function getClineConfigDir() {
  // Allow override via environment variable
  if (process.env.CLINE_DIR) {
    return process.env.CLINE_DIR;
  }
  return path.join(os.homedir(), '.cline');
}

/**
 * Get the Cline workflows directory (where Cline looks for global workflows)
 * @returns {string}
 */
export function getClineWorkflowsDir() {
  // Allow override via environment variable
  if (process.env.CLINE_WORKFLOWS_DIR) {
    return process.env.CLINE_WORKFLOWS_DIR;
  }
  // Cline looks for global workflows in ~/Documents/Cline/Workflows/
  return path.join(os.homedir(), 'Documents', 'Cline', 'Workflows');
}

/**
 * Get the GSD workflows directory (same as Cline workflows - GSD files have gsd- prefix)
 * @returns {string}
 */
export function getGsdWorkflowsDir() {
  return getClineWorkflowsDir();
}
