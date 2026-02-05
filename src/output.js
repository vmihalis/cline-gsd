/**
 * Terminal output helpers with colored formatting
 * Uses picocolors for lightweight, fast terminal coloring
 */

import pc from 'picocolors';

// Unicode symbols for visual feedback
const symbols = {
  success: '\u2713',  // checkmark
  error: '\u2717',    // X mark
  warning: '\u26A0',  // warning triangle
  info: '\u2139'      // info symbol
};

/**
 * Log success message with green checkmark
 * @param {string} msg - Message to display
 */
export function success(msg) {
  console.log(`  ${pc.green(symbols.success)} ${msg}`);
}

/**
 * Log error message with red X
 * @param {string} msg - Message to display
 */
export function error(msg) {
  console.log(`  ${pc.red(symbols.error)} ${pc.red(msg)}`);
}

/**
 * Log warning message with yellow warning sign
 * @param {string} msg - Message to display
 */
export function warn(msg) {
  console.log(`  ${pc.yellow(symbols.warning)} ${pc.yellow(msg)}`);
}

/**
 * Log info message with blue info symbol
 * @param {string} msg - Message to display
 */
export function info(msg) {
  console.log(`  ${pc.blue(symbols.info)} ${msg}`);
}

/**
 * Return dimmed text for secondary information
 * @param {string} msg - Text to dim
 * @returns {string} Dimmed text
 */
export function dim(msg) {
  return pc.dim(msg);
}

/**
 * Return cyan text for highlights
 * @param {string} msg - Text to highlight
 * @returns {string} Cyan text
 */
export function cyan(msg) {
  return pc.cyan(msg);
}

/**
 * Check if color output is supported
 * @returns {boolean} True if terminal supports colors
 */
export function isColorSupported() {
  return pc.isColorSupported;
}
