/**
 * Debug-phase helpers for Cline-GSD
 *
 * Provides debug session file creation, parsing, updating, session
 * discovery, and investigation prompt generation. Debug sessions use
 * persistent files in .planning/debug/ that survive /clear boundaries.
 * The methodology follows the scientific method: gather symptoms,
 * form hypothesis, test, eliminate/confirm, resolve.
 *
 * Exports: buildDebugFileContent, parseDebugFile, updateDebugFile,
 *          getActiveDebugSessions, buildDebugPrompt
 */

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Pure Formatters (no I/O -- return strings directly)
// ---------------------------------------------------------------------------

/**
 * Generate a new debug session file matching the upstream protocol.
 *
 * @param {object} data - Debug session data
 * @param {string} data.slug - Short identifier (e.g. "login-redirect-loop")
 * @param {string} data.trigger - What triggered this debug session
 * @param {string} [data.status='gathering'] - Initial status
 * @param {string} data.created - ISO date string
 * @param {string} data.updated - ISO date string
 * @returns {string} Formatted debug session file content
 */
export function buildDebugFileContent(data) {
  const { slug, trigger, status = 'gathering', created, updated } = data;

  return `---
status: ${status}
trigger: ${trigger}
created: ${created}
updated: ${updated}
---

# Debug: ${slug}

## Current Focus

hypothesis: (none yet)
test: (none yet)
expecting: (none yet)
next_action: Gather symptoms

## Symptoms

expected: (to be filled)
actual: (to be filled)
errors: (to be filled)
reproduction: (to be filled)
started: ${created}

## Eliminated

(append-only -- hypotheses disproven with evidence)

## Evidence

(append-only -- findings with implications)

## Resolution

root_cause: (pending)
fix: (pending)
verification: (pending)
files_changed: (pending)
`;
}

/**
 * Generate an investigation-guiding prompt from the current debug session state.
 *
 * @param {object} sessionData - Parsed debug file object (from parseDebugFile)
 * @returns {string} Formatted investigation prompt
 */
export function buildDebugPrompt(sessionData) {
  const { slug, status, trigger, currentFocus, symptoms, eliminated, evidence } = sessionData;

  let prompt = `## Debug Session: ${slug}

**Status:** ${status}
**Trigger:** ${trigger}

### Current Focus
- Hypothesis: ${currentFocus.hypothesis}
- Test: ${currentFocus.test}
- Expecting: ${currentFocus.expecting}
- Next action: ${currentFocus.next_action}

### Investigation Context`;

  // Show symptoms if filled (not default placeholders)
  if (symptoms && symptoms.expected && symptoms.expected !== '(to be filled)') {
    prompt += `\n\n**Symptoms:**
- Expected: ${symptoms.expected}
- Actual: ${symptoms.actual}
- Errors: ${symptoms.errors}
- Reproduction: ${symptoms.reproduction}`;
  }

  // Show eliminated entries if present
  if (eliminated && eliminated.trim() && !eliminated.includes('(append-only -- hypotheses disproven with evidence)')) {
    prompt += `\n\n**Eliminated:**\n${eliminated}`;
  }

  // Show evidence entries if present
  if (evidence && evidence.trim() && !evidence.includes('(append-only -- findings with implications)')) {
    prompt += `\n\n**Evidence:**\n${evidence}`;
  }

  prompt += `

### Guidelines
- Update the debug file BEFORE taking action (not after)
- Use scientific method: hypothesis -> test -> confirm/eliminate
- Append to Eliminated and Evidence sections (never delete entries)
- When fixing, update status to "fixing" first
- After fix, update status to "verifying" and run verification
- When verified, update status to "resolved" with Resolution details`;

  return prompt;
}

// ---------------------------------------------------------------------------
// Pure Parser (no I/O -- operates on string content)
// ---------------------------------------------------------------------------

/**
 * Parse a debug session file into structured data.
 *
 * Extracts frontmatter fields and all sections from the debug file.
 *
 * @param {string} content - Raw debug file text
 * @returns {object|null} Parsed debug session, or null if no frontmatter found
 */
export function parseDebugFile(content) {
  // Extract frontmatter
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return null;

  const fmText = fmMatch[1];

  // Parse frontmatter fields
  const statusMatch = fmText.match(/^status:\s*(.+)$/m);
  const triggerMatch = fmText.match(/^trigger:\s*(.+)$/m);
  const createdMatch = fmText.match(/^created:\s*(.+)$/m);
  const updatedMatch = fmText.match(/^updated:\s*(.+)$/m);

  const status = statusMatch ? statusMatch[1].trim() : null;
  const trigger = triggerMatch ? triggerMatch[1].trim() : null;
  const created = createdMatch ? createdMatch[1].trim() : null;
  const updated = updatedMatch ? updatedMatch[1].trim() : null;

  // Extract slug from heading
  const slugMatch = content.match(/^# Debug:\s*(.+)$/m);
  const slug = slugMatch ? slugMatch[1].trim() : null;

  // Split content into sections at ## headings
  const sections = splitSections(content);

  // Parse Current Focus section
  const currentFocus = parseKeyValueSection(sections['Current Focus'] || '', [
    'hypothesis', 'test', 'expecting', 'next_action',
  ]);

  // Parse Symptoms section
  const symptoms = parseKeyValueSection(sections['Symptoms'] || '', [
    'expected', 'actual', 'errors', 'reproduction', 'started',
  ]);

  // Raw text sections (append-only)
  const eliminated = (sections['Eliminated'] || '').trim();
  const evidence = (sections['Evidence'] || '').trim();

  // Parse Resolution section
  const resolution = parseKeyValueSection(sections['Resolution'] || '', [
    'root_cause', 'fix', 'verification', 'files_changed',
  ]);

  return {
    status,
    trigger,
    created,
    updated,
    slug,
    currentFocus,
    symptoms,
    eliminated,
    evidence,
    resolution,
  };
}

// ---------------------------------------------------------------------------
// Helpers (internal)
// ---------------------------------------------------------------------------

/**
 * Split markdown content into sections by ## headings.
 * Returns a map of heading name -> body text.
 *
 * @param {string} content - Raw markdown text
 * @returns {Object<string, string>}
 */
function splitSections(content) {
  const regex = /^## (.+)$/gm;
  const sections = {};
  const matches = [...content.matchAll(regex)];

  for (let i = 0; i < matches.length; i++) {
    const name = matches[i][1].trim();
    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : content.length;
    sections[name] = content.slice(start, end).trim();
  }

  return sections;
}

/**
 * Parse key: value pairs from a section body.
 *
 * @param {string} text - Section body text
 * @param {string[]} keys - Keys to extract
 * @returns {Object<string, string>}
 */
function parseKeyValueSection(text, keys) {
  const result = {};
  for (const key of keys) {
    const regex = new RegExp(`^${key}:\\s*(.+)$`, 'm');
    const match = text.match(regex);
    result[key] = match ? match[1].trim() : null;
  }
  return result;
}

/**
 * Replace a key: value line in a text block.
 *
 * @param {string} text - Text containing key: value lines
 * @param {string} key - Key to replace
 * @param {string} value - New value
 * @returns {string} Updated text
 */
function replaceKeyValue(text, key, value) {
  const regex = new RegExp(`^(${key}:)\\s*.*$`, 'm');
  if (regex.test(text)) {
    return text.replace(regex, `$1 ${value}`);
  }
  return text;
}

// ---------------------------------------------------------------------------
// I/O Functions (async, error-return pattern)
// ---------------------------------------------------------------------------

/**
 * Read an existing debug file, apply updates, write it back.
 *
 * @param {string} filePath - Absolute path to the debug file
 * @param {object} updates - Fields to update
 * @param {string} [updates.status] - New frontmatter status
 * @param {object} [updates.currentFocus] - Replace Current Focus key-value pairs
 * @param {object} [updates.symptoms] - Replace Symptoms key-value pairs
 * @param {string} [updates.appendEliminated] - Text to append to Eliminated section
 * @param {string} [updates.appendEvidence] - Text to append to Evidence section
 * @param {object} [updates.resolution] - Replace Resolution key-value pairs
 * @returns {Promise<{success: boolean, data?: {path: string, status: string}, error?: string}>}
 */
export async function updateDebugFile(filePath, updates) {
  try {
    let content = await readFile(filePath, 'utf-8');
    const today = new Date().toISOString().split('T')[0];

    // Update frontmatter status
    if (updates.status) {
      content = content.replace(
        /^(status:\s*).+$/m,
        `$1${updates.status}`
      );
    }

    // Always update the 'updated' field in frontmatter
    content = content.replace(
      /^(updated:\s*).+$/m,
      `$1${today}`
    );

    // Update Current Focus section key-value pairs
    if (updates.currentFocus) {
      for (const [key, value] of Object.entries(updates.currentFocus)) {
        if (value !== undefined && value !== null) {
          content = replaceKeyValue(content, key, value);
        }
      }
    }

    // Update Symptoms section key-value pairs
    if (updates.symptoms) {
      for (const [key, value] of Object.entries(updates.symptoms)) {
        if (value !== undefined && value !== null) {
          content = replaceKeyValue(content, key, value);
        }
      }
    }

    // Append to Eliminated section
    if (updates.appendEliminated) {
      content = appendToSection(content, 'Eliminated', updates.appendEliminated);
    }

    // Append to Evidence section
    if (updates.appendEvidence) {
      content = appendToSection(content, 'Evidence', updates.appendEvidence);
    }

    // Update Resolution section key-value pairs
    if (updates.resolution) {
      for (const [key, value] of Object.entries(updates.resolution)) {
        if (value !== undefined && value !== null) {
          content = replaceKeyValue(content, key, value);
        }
      }
    }

    await writeFile(filePath, content, 'utf-8');

    // Read back status for return value
    const newStatus = updates.status || content.match(/^status:\s*(.+)$/m)?.[1]?.trim() || 'unknown';

    return { success: true, data: { path: filePath, status: newStatus } };
  } catch (err) {
    return { success: false, error: `Failed to update debug file: ${err.message}` };
  }
}

/**
 * Append text to a named ## section before the next ## heading.
 *
 * @param {string} content - Full file content
 * @param {string} sectionName - Name of the ## section
 * @param {string} text - Text to append
 * @returns {string} Updated content
 */
function appendToSection(content, sectionName, text) {
  const sectionRegex = new RegExp(`^(## ${sectionName})$`, 'm');
  const sectionMatch = content.match(sectionRegex);
  if (!sectionMatch) return content;

  const sectionStart = sectionMatch.index + sectionMatch[0].length;

  // Find the next ## heading after this section
  const nextSectionRegex = /^## /m;
  const restContent = content.slice(sectionStart);
  const nextMatch = restContent.match(nextSectionRegex);

  if (nextMatch) {
    const insertPoint = sectionStart + nextMatch.index;
    // Insert the new text before the next section heading
    const before = content.slice(0, insertPoint).trimEnd();
    const after = content.slice(insertPoint);
    return `${before}\n\n${text}\n\n${after}`;
  } else {
    // This is the last section -- append at the end
    const before = content.trimEnd();
    return `${before}\n\n${text}\n`;
  }
}

/**
 * Find all non-resolved debug session files in .planning/debug/.
 *
 * @param {string} planningDir - Path to .planning/ directory
 * @returns {Promise<{success: boolean, data?: {sessions: Array<{slug: string, status: string, trigger: string, path: string, created: string, updated: string}>}, error?: string}>}
 */
export async function getActiveDebugSessions(planningDir) {
  try {
    const debugDir = path.join(planningDir, 'debug');

    let files;
    try {
      files = await readdir(debugDir);
    } catch (err) {
      if (err.code === 'ENOENT') {
        // Debug directory doesn't exist yet -- not an error, just no sessions
        return { success: true, data: { sessions: [] } };
      }
      throw err;
    }

    const debugFiles = files.filter(f => f.startsWith('DEBUG-') && f.endsWith('.md')).sort();
    const sessions = [];

    for (const file of debugFiles) {
      const filePath = path.join(debugDir, file);
      const content = await readFile(filePath, 'utf-8');
      const parsed = parseDebugFile(content);

      if (parsed && parsed.status !== 'resolved') {
        sessions.push({
          slug: parsed.slug,
          status: parsed.status,
          trigger: parsed.trigger,
          path: filePath,
          created: parsed.created,
          updated: parsed.updated,
        });
      }
    }

    return { success: true, data: { sessions } };
  } catch (err) {
    return { success: false, error: `Failed to get active debug sessions: ${err.message}` };
  }
}
