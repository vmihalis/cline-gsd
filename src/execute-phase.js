/**
 * Execution-phase orchestration for Cline-GSD
 *
 * Provides plan discovery, wave-based ordering, atomic commit message
 * builders, SUMMARY.md template generation, and state update orchestration.
 * This is the foundational module for execution -- all functions are called
 * by the Cline workflow (gsd-execute-phase.md) which executes tasks inline
 * in the main context (no subagents).
 *
 * Exports: discoverPlans, groupByWave, buildTaskCommitMessage,
 *          buildPlanCommitMessage, buildSummaryContent,
 *          updateStateAfterPlan, getPhaseCompletionStatus
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parsePlanFrontmatter, readRoadmap, readState, parseRoadmapProgress, readPlanningConfig } from './state-read.js';
import { updateStatePosition, updateRoadmapProgress, updatePlanCheckbox } from './state-write.js';
import { renderProgressBar } from './state-init.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Zero-pad a number to 2 digits.
 * @param {number} num
 * @returns {string}
 */
function pad(num) {
  return String(num).padStart(2, '0');
}

// ---------------------------------------------------------------------------
// Plan Discovery
// ---------------------------------------------------------------------------

/**
 * Discover all plans in a phase directory with completion status.
 *
 * Reads the phase directory for *-PLAN.md files, parses each plan's
 * frontmatter, and checks for matching *-SUMMARY.md to determine
 * completion. Plans are sorted by filename (natural order).
 *
 * @param {string} phaseDir - Absolute path to phase directory
 * @returns {Promise<{success: boolean, data?: {plans: Array, completed: Array, incomplete: Array}, error?: string}>}
 */
export async function discoverPlans(phaseDir) {
  try {
    let files;
    try {
      files = await readdir(phaseDir);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return { success: false, error: `Phase directory does not exist: ${phaseDir}` };
      }
      throw err;
    }

    const planFiles = files
      .filter(f => f.endsWith('-PLAN.md'))
      .sort();

    if (planFiles.length === 0) {
      return { success: false, error: `No PLAN.md files found in ${phaseDir}` };
    }

    const summaryFiles = new Set(
      files.filter(f => f.endsWith('-SUMMARY.md'))
    );

    const plans = [];
    for (const planFile of planFiles) {
      const planPath = path.join(phaseDir, planFile);
      const content = await readFile(planPath, 'utf-8');
      const frontmatter = parsePlanFrontmatter(content);

      // Extract plan ID from filename: "07-01-PLAN.md" -> "07-01"
      const planId = planFile.replace('-PLAN.md', '');
      const summaryFile = `${planId}-SUMMARY.md`;
      const isComplete = summaryFiles.has(summaryFile);

      plans.push({
        id: planId,
        file: planFile,
        path: planPath,
        wave: frontmatter?.wave ?? 1,
        autonomous: frontmatter?.autonomous ?? true,
        dependsOn: frontmatter?.depends_on ?? [],
        filesModified: frontmatter?.files_modified ?? [],
        isComplete,
      });
    }

    const completed = plans.filter(p => p.isComplete);
    const incomplete = plans.filter(p => !p.isComplete);

    return { success: true, data: { plans, completed, incomplete } };
  } catch (err) {
    return { success: false, error: `Failed to discover plans: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// Wave Grouping
// ---------------------------------------------------------------------------

/**
 * Group plans by wave number for ordered execution.
 *
 * Pure function -- no I/O. Plans within a wave execute sequentially
 * in main-context Cline-GSD (no parallel subagents).
 *
 * @param {Array} plans - Array of plan objects with wave property
 * @returns {{success: boolean, data?: {waves: Map<number, Array>, waveOrder: number[]}, error?: string}}
 */
export function groupByWave(plans) {
  try {
    const waves = new Map();
    for (const plan of plans) {
      const wave = plan.wave ?? 1;
      if (!waves.has(wave)) {
        waves.set(wave, []);
      }
      waves.get(wave).push(plan);
    }

    const waveOrder = [...waves.keys()].sort((a, b) => a - b);

    return { success: true, data: { waves, waveOrder } };
  } catch (err) {
    return { success: false, error: `Failed to group plans by wave: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// Commit Message Builders (pure formatters -- return strings directly)
// ---------------------------------------------------------------------------

/** Valid conventional commit types. */
const VALID_COMMIT_TYPES = new Set([
  'feat', 'fix', 'test', 'refactor', 'perf', 'chore', 'docs', 'style',
]);

/**
 * Build a conventional commit message for a task.
 *
 * Format: {type}({planId}): {description}
 * With optional body: \n\n- detail1\n- detail2
 *
 * @param {string} type - Commit type: feat, fix, test, refactor, perf, chore, docs, style
 * @param {string} planId - Plan ID like "07-01"
 * @param {string} description - Brief task description
 * @param {string[]} [details=[]] - Optional bullet-point details
 * @returns {string} Formatted commit message
 */
export function buildTaskCommitMessage(type, planId, description, details = []) {
  const commitType = VALID_COMMIT_TYPES.has(type) ? type : 'chore';
  let msg = `${commitType}(${planId}): ${description}`;
  if (details.length > 0) {
    msg += '\n\n' + details.map(d => `- ${d}`).join('\n');
  }
  return msg;
}

/**
 * Build the metadata commit message for plan completion.
 *
 * Format: docs({planId}): complete {planName}
 *
 * @param {string} planId - Plan ID like "07-01"
 * @param {string} planName - Human-readable plan name
 * @param {string[]} taskNames - Names of completed tasks
 * @param {string} summaryPath - Relative path to SUMMARY.md
 * @returns {string} Formatted commit message
 */
export function buildPlanCommitMessage(planId, planName, taskNames, summaryPath) {
  const taskList = taskNames.map(t => `- ${t}`).join('\n');
  return `docs(${planId}): complete ${planName}

Tasks completed: ${taskNames.length}/${taskNames.length}
${taskList}

SUMMARY: ${summaryPath}`;
}

// ---------------------------------------------------------------------------
// SUMMARY.md Template
// ---------------------------------------------------------------------------

/**
 * Generate complete SUMMARY.md content from execution data.
 *
 * Produces YAML frontmatter between --- delimiters matching the upstream
 * template structure, followed by a markdown body with all standard sections.
 *
 * @param {object} data - Summary data
 * @param {string} data.phase - Phase identifier (e.g. "07-execution-workflow")
 * @param {string} data.plan - Plan number (e.g. "01")
 * @param {string} data.title - Plan title
 * @param {string} data.oneLiner - Substantive one-liner
 * @param {string} data.subsystem - Category (e.g. "orchestration")
 * @param {string[]} data.tags - Searchable tech keywords
 * @param {string[]} data.requires - Dependencies on prior phases
 * @param {string[]} data.provides - What this delivers
 * @param {string[]} data.affects - Future phases needing this
 * @param {string[]} data.techAdded - New libraries added
 * @param {string[]} data.patterns - Patterns established
 * @param {Array<{path: string, purpose: string}>} data.filesCreated - Files created
 * @param {Array<{path: string, purpose: string}>} data.filesModified - Files modified
 * @param {Array<{decision: string, rationale: string}>} data.decisions - Decisions made
 * @param {string} data.duration - Duration string (e.g. "3 min")
 * @param {string} data.completed - ISO date (e.g. "2026-02-05")
 * @param {Array<{name: string, commit: string, type: string, files: string[]}>} data.tasks - Task commit records
 * @param {string[]} data.accomplishments - Accomplishment bullet strings
 * @param {string} data.deviations - Deviations text or "None - plan executed exactly as written."
 * @param {string} data.issues - Issues text or "None"
 * @param {string} data.nextReadiness - Next phase readiness text
 * @returns {string} Complete SUMMARY.md content
 */
export function buildSummaryContent(data) {
  const {
    phase, plan, title, oneLiner, subsystem, tags,
    requires, provides, affects,
    techAdded, patterns,
    filesCreated, filesModified,
    decisions, duration, completed,
    tasks, accomplishments, deviations, issues, nextReadiness,
  } = data;

  // --- YAML Frontmatter ---
  const yamlTags = tags.length > 0
    ? `[${tags.join(', ')}]`
    : '[]';

  const yamlRequires = requires.length > 0
    ? '\n' + requires.map(r => `  - "${r}"`).join('\n')
    : ' []';

  const yamlProvides = provides.length > 0
    ? '\n' + provides.map(p => `  - "${p}"`).join('\n')
    : ' []';

  const yamlAffects = affects.length > 0
    ? `[${affects.join(', ')}]`
    : '[]';

  const yamlTechAdded = techAdded.length > 0
    ? `[${techAdded.join(', ')}]`
    : '[]';

  const yamlPatterns = patterns.length > 0
    ? `[${patterns.join(', ')}]`
    : '[]';

  const yamlFilesCreated = filesCreated.length > 0
    ? '\n' + filesCreated.map(f => `  - "${f.path}"`).join('\n')
    : ' []';

  const yamlFilesModified = filesModified.length > 0
    ? '\n' + filesModified.map(f => `  - "${f.path}"`).join('\n')
    : ' []';

  const yamlDecisions = decisions.length > 0
    ? '\n' + decisions.map(d => `  - "${d.decision}"`).join('\n')
    : ' []';

  const yamlPatternsList = patterns.length > 0
    ? '\n' + patterns.map(p => `  - "${p}"`).join('\n')
    : ' []';

  const frontmatter = `---
phase: ${phase}
plan: ${plan}
subsystem: ${subsystem}
tags: ${yamlTags}

# Dependency graph
requires:${yamlRequires}
provides:${yamlProvides}
affects: ${yamlAffects}

# Tech tracking
tech-stack:
  added: ${yamlTechAdded}
  patterns: ${yamlPatterns}

key-files:
  created:${yamlFilesCreated}
  modified:${yamlFilesModified}

key-decisions:${yamlDecisions}

patterns-established:${yamlPatternsList}

# Metrics
duration: ${duration}
completed: ${completed}
---`;

  // --- Markdown Body ---

  // Performance section
  const totalFiles = filesCreated.length + filesModified.length;
  const performanceSection = `## Performance

- **Duration:** ${duration}
- **Tasks:** ${tasks.length}
- **Files modified:** ${totalFiles}`;

  // Accomplishments section
  const accomplishmentsList = accomplishments.length > 0
    ? accomplishments.map(a => `- ${a}`).join('\n')
    : '- Plan completed as specified';

  // Task Commits section
  const taskCommitsList = tasks.map((t, i) =>
    `${i + 1}. **${t.name}** - \`${t.commit}\` (${t.type})`
  ).join('\n');

  // Files Created/Modified section
  const filesList = [
    ...filesCreated.map(f => `- \`${f.path}\` - ${f.purpose} (created)`),
    ...filesModified.map(f => `- \`${f.path}\` - ${f.purpose} (modified)`),
  ].join('\n') || '- None';

  // Decisions section
  const decisionsText = decisions.length > 0
    ? decisions.map(d => `- **${d.decision}** -- ${d.rationale}`).join('\n')
    : 'None - followed plan as specified';

  // Deviations section
  const deviationsSection = deviations === 'None' || deviations === 'None - plan executed exactly as written.'
    ? 'None - plan executed exactly as written.'
    : deviations;

  // Issues section
  const issuesText = issues || 'None';

  // Next Phase Readiness section
  const nextReadinessText = nextReadiness || 'Ready for next plan';

  const body = `
# Phase ${phase.split('-')[0]}: ${title} Summary

**${oneLiner}**

${performanceSection}

## Accomplishments
${accomplishmentsList}

## Task Commits

Each task was committed atomically:

${taskCommitsList}

## Files Created/Modified
${filesList}

## Decisions Made
${decisionsText}

## Deviations from Plan

${deviationsSection}

## Issues Encountered
${issuesText}

## Next Phase Readiness
${nextReadinessText}

---
*Phase: ${phase}*
*Completed: ${completed}*`;

  return frontmatter + '\n' + body + '\n';
}

// ---------------------------------------------------------------------------
// State Update Orchestration
// ---------------------------------------------------------------------------

/**
 * Orchestrate all state updates after a plan completes.
 *
 * Steps:
 *   1. Toggle plan checkbox in ROADMAP.md
 *   2. Update ROADMAP.md progress table row
 *   3. Calculate global progress from ROADMAP.md
 *   4. Update STATE.md position
 *
 * @param {string} planningDir - Path to .planning/ directory
 * @param {number} phaseNum - Phase number
 * @param {number} planNum - Plan number
 * @param {string} phaseName - Phase display name
 * @param {number} totalPlansInPhase - Total plans in this phase
 * @param {number} completedInPhase - Plans completed so far (including this one)
 * @returns {Promise<{success: boolean, data?: {phaseComplete: boolean, globalProgress: {completed: number, total: number, pct: number}}, error?: string}>}
 */
export async function updateStateAfterPlan(planningDir, phaseNum, planNum, phaseName, totalPlansInPhase, completedInPhase) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const paddedPhase = pad(phaseNum);
    const paddedPlan = pad(planNum);

    // Step 1: Toggle plan checkbox in ROADMAP.md
    const checkboxResult = await updatePlanCheckbox(planningDir, phaseNum, planNum, true);
    if (!checkboxResult.success) {
      return { success: false, error: `Checkbox update failed: ${checkboxResult.error}` };
    }

    // Step 2: Determine phase status and update ROADMAP.md progress table
    const isPhaseComplete = completedInPhase >= totalPlansInPhase;
    const phaseStatus = isPhaseComplete ? 'Complete' : 'In progress';
    const dateStr = isPhaseComplete ? today : '-';

    const progressResult = await updateRoadmapProgress(
      planningDir, phaseNum, completedInPhase, totalPlansInPhase, phaseStatus, dateStr
    );
    if (!progressResult.success) {
      return { success: false, error: `Progress update failed: ${progressResult.error}` };
    }

    // Step 3: Calculate global progress from ROADMAP.md
    const roadmapResult = await readRoadmap(planningDir);
    if (!roadmapResult.success) {
      return { success: false, error: `Roadmap read failed: ${roadmapResult.error}` };
    }

    const progress = roadmapResult.data.progress;
    const globalCompleted = progress.completedPlans;
    const globalTotal = progress.totalPlans;
    const totalPhases = progress.phases.length;
    const pct = globalTotal > 0 ? Math.round((globalCompleted / globalTotal) * 100) : 0;

    // Step 4: Update STATE.md position
    const lastActivity = `${today} -- Completed ${paddedPhase}-${paddedPlan}-PLAN.md`;
    const stateStatus = isPhaseComplete ? 'Phase complete' : 'In progress';

    const stateResult = await updateStatePosition(planningDir, {
      phaseNum,
      totalPhases,
      phaseName,
      planNum: completedInPhase,
      totalPlans: totalPlansInPhase,
      status: stateStatus,
      lastActivity,
      completedPlans: globalCompleted,
      totalPlansGlobal: globalTotal,
    });
    if (!stateResult.success) {
      return { success: false, error: `State position update failed: ${stateResult.error}` };
    }

    return {
      success: true,
      data: {
        phaseComplete: isPhaseComplete,
        globalProgress: { completed: globalCompleted, total: globalTotal, pct },
      },
    };
  } catch (err) {
    return { success: false, error: `Failed to update state after plan: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// Phase Completion Check
// ---------------------------------------------------------------------------

/**
 * Quick check: are all plans in a phase complete?
 *
 * Reads the phase directory, counts PLAN.md and SUMMARY.md files,
 * and determines if all plans have matching summaries.
 *
 * @param {string} phaseDir - Absolute path to phase directory
 * @returns {Promise<{success: boolean, data?: {totalPlans: number, completedPlans: number, allComplete: boolean, incompletePlans: string[]}, error?: string}>}
 */
export async function getPhaseCompletionStatus(phaseDir) {
  try {
    let files;
    try {
      files = await readdir(phaseDir);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return { success: false, error: `Phase directory does not exist: ${phaseDir}` };
      }
      throw err;
    }

    const planFiles = files.filter(f => f.endsWith('-PLAN.md')).sort();
    const summaryFiles = new Set(
      files.filter(f => f.endsWith('-SUMMARY.md'))
    );

    const totalPlans = planFiles.length;
    const incompletePlans = [];
    let completedPlans = 0;

    for (const planFile of planFiles) {
      const planId = planFile.replace('-PLAN.md', '');
      const summaryFile = `${planId}-SUMMARY.md`;
      if (summaryFiles.has(summaryFile)) {
        completedPlans++;
      } else {
        incompletePlans.push(planId);
      }
    }

    return {
      success: true,
      data: {
        totalPlans,
        completedPlans,
        allComplete: completedPlans === totalPlans && totalPlans > 0,
        incompletePlans,
      },
    };
  } catch (err) {
    return { success: false, error: `Failed to check phase completion: ${err.message}` };
  }
}
