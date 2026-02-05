/**
 * Agent output verification and collection for Cline-GSD
 * After spawned agents complete, verify outputs exist and collect results
 */

import { readFile, stat, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { success, error, warn, info } from './output.js';

/**
 * Verify expected output files exist
 * @param {string[]} files - Array of file paths to verify
 * @returns {Promise<Array<{path: string, exists: boolean, lines: number, bytes: number}>>}
 */
export async function verifyOutputs(files) {
  const results = await Promise.all(
    files.map(async (filePath) => {
      try {
        // Check if file exists and is readable
        await access(filePath, constants.R_OK);

        // Get file stats for size
        const fileStat = await stat(filePath);
        const bytes = fileStat.size;

        // Read file to count lines
        const content = await readFile(filePath, 'utf-8');
        const lines = content.split('\n').length;

        return {
          path: filePath,
          exists: true,
          lines,
          bytes,
        };
      } catch {
        return {
          path: filePath,
          exists: false,
          lines: 0,
          bytes: 0,
        };
      }
    })
  );

  return results;
}

/**
 * Collect content from output files
 * @param {string[]} files - Array of file paths to read
 * @returns {Promise<Array<{path: string, content: string|null, error: string|null}>>}
 */
export async function collectOutputs(files) {
  const results = await Promise.all(
    files.map(async (filePath) => {
      try {
        const content = await readFile(filePath, 'utf-8');
        return {
          path: filePath,
          content,
          error: null,
        };
      } catch (err) {
        return {
          path: filePath,
          content: null,
          error: err.message,
        };
      }
    })
  );

  return results;
}

/**
 * Generate a summary report from verification results
 * @param {Array<{path: string, exists: boolean, lines: number, bytes: number}>} verifications
 * @returns {{total: number, found: number, missing: number, report: string}}
 */
export function reportResults(verifications) {
  const total = verifications.length;
  const found = verifications.filter((v) => v.exists).length;
  const missing = total - found;

  // Build report string
  const lines = ['Agent Output Summary:'];

  for (const v of verifications) {
    if (v.exists) {
      lines.push(`- ${v.path}: OK (${v.lines} lines)`);
    } else {
      lines.push(`- ${v.path}: MISSING`);
    }
  }

  lines.push(`Found: ${found}/${total} outputs`);

  const report = lines.join('\n');

  return {
    total,
    found,
    missing,
    report,
  };
}
