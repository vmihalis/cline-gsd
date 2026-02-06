#!/usr/bin/env node

/**
 * Integration test for execute-phase.js
 *
 * Tests plan discovery, wave grouping, commit message formatting,
 * SUMMARY.md template generation, and phase completion detection.
 * Catches path mismatches, frontmatter parsing issues, template errors,
 * and state update regressions before real execution.
 *
 * Run: node scripts/test-execute-phase.js
 * npm: "test:execute-phase": "node scripts/test-execute-phase.js"
 */

import { tmpdir } from 'node:os';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

import {
  discoverPlans,
  groupByWave,
  buildTaskCommitMessage,
  buildPlanCommitMessage,
  buildSummaryContent,
  getPhaseCompletionStatus,
} from '../src/execute-phase.js';

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err.message });
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PLAN_FRONTMATTER = (planNum, wave = 1) => `---
phase: 07-test
plan: ${String(planNum).padStart(2, '0')}
wave: ${wave}
autonomous: true
depends_on: []
files_modified: []
---

# Plan ${planNum}
Test plan content.
`;

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

const TEMP_DIR = path.join(tmpdir(), `cline-gsd-exec-test-${Date.now()}`);

async function main() {
  console.log('\nExecute Phase Integration Test');
  console.log('==============================\n');
  console.log(`Temp dir: ${TEMP_DIR}\n`);

  try {
    await mkdir(TEMP_DIR, { recursive: true });

    // ---- Plan Discovery tests ----

    console.log('--- Plan Discovery ---');

    // Set up phase dir with 3 plans and 1 summary
    const phaseDir = path.join(TEMP_DIR, '07-test');
    await mkdir(phaseDir, { recursive: true });
    await writeFile(path.join(phaseDir, '07-01-PLAN.md'), PLAN_FRONTMATTER(1, 1));
    await writeFile(path.join(phaseDir, '07-02-PLAN.md'), PLAN_FRONTMATTER(2, 1));
    await writeFile(path.join(phaseDir, '07-03-PLAN.md'), PLAN_FRONTMATTER(3, 2));
    // One completed plan
    await writeFile(path.join(phaseDir, '07-01-SUMMARY.md'), '# Summary\nDone.');

    await test('1. discoverPlans finds plans and detects completion', async () => {
      const result = await discoverPlans(phaseDir);
      assert.equal(result.success, true, 'Should succeed');
      assert.equal(result.data.plans.length, 3, 'Should find 3 plans');
      assert.equal(result.data.completed.length, 1, 'Should have 1 completed');
      assert.equal(result.data.completed[0].id, '07-01', 'Completed plan should be 07-01');
      assert.equal(result.data.incomplete.length, 2, 'Should have 2 incomplete');
      // Verify parsed frontmatter fields
      const plan1 = result.data.plans.find(p => p.id === '07-01');
      assert.equal(plan1.wave, 1, 'Plan 1 wave should be 1');
      assert.equal(plan1.autonomous, true, 'Plan 1 autonomous should be true');
      assert.equal(plan1.isComplete, true, 'Plan 1 should be marked complete');
    });

    await test('2. discoverPlans returns error for non-existent directory', async () => {
      const result = await discoverPlans('/tmp/nonexistent-dir-12345');
      assert.equal(result.success, false, 'Should fail');
      assert.ok(
        result.error.includes('does not exist') || result.error.includes('not exist'),
        `Error should mention non-existence, got: "${result.error}"`
      );
    });

    await test('3. discoverPlans returns error for directory with no plans', async () => {
      const emptyDir = path.join(TEMP_DIR, 'empty-phase');
      await mkdir(emptyDir, { recursive: true });
      const result = await discoverPlans(emptyDir);
      // Implementation returns success: false with "No PLAN.md files found"
      assert.equal(result.success, false, 'Should fail for empty dir');
      assert.ok(
        result.error.includes('No PLAN.md'),
        `Error should mention no plans found, got: "${result.error}"`
      );
    });

    // ---- Wave Grouping tests ----

    console.log('\n--- Wave Grouping ---');

    await test('4. groupByWave groups plans correctly', async () => {
      const mockPlans = [
        { id: '01', wave: 1 },
        { id: '02', wave: 1 },
        { id: '03', wave: 2 },
        { id: '04', wave: 3 },
      ];
      const result = groupByWave(mockPlans);
      assert.equal(result.success, true, 'Should succeed');
      assert.deepEqual(result.data.waveOrder, [1, 2, 3], 'Wave order should be [1, 2, 3]');
      assert.equal(result.data.waves.get(1).length, 2, 'Wave 1 should have 2 plans');
      assert.equal(result.data.waves.get(2).length, 1, 'Wave 2 should have 1 plan');
      assert.equal(result.data.waves.get(3).length, 1, 'Wave 3 should have 1 plan');
    });

    await test('5. groupByWave handles empty array', async () => {
      const result = groupByWave([]);
      assert.equal(result.success, true, 'Should succeed');
      assert.equal(result.data.waveOrder.length, 0, 'Wave order should be empty');
      assert.equal(result.data.waves.size, 0, 'Waves map should be empty');
    });

    // ---- Commit Message tests ----

    console.log('\n--- Commit Messages ---');

    await test('6. buildTaskCommitMessage produces correct format', async () => {
      // Basic format
      const basic = buildTaskCommitMessage('feat', '07-01', 'create execute module');
      assert.equal(basic, 'feat(07-01): create execute module', 'Basic format should match');

      // With details
      const withDetails = buildTaskCommitMessage('feat', '07-01', 'create module', ['discovery', 'grouping']);
      assert.ok(withDetails.includes('- discovery'), 'Should contain "- discovery"');
      assert.ok(withDetails.includes('- grouping'), 'Should contain "- grouping"');
      assert.ok(withDetails.startsWith('feat(07-01): create module'), 'Should start with type(id): desc');

      // Invalid type falls back to chore
      const invalid = buildTaskCommitMessage('invalid', '07-01', 'something');
      assert.ok(invalid.startsWith('chore(07-01):'), 'Invalid type should fall back to chore');
    });

    await test('7. buildPlanCommitMessage includes task list and summary path', async () => {
      const msg = buildPlanCommitMessage(
        '07-01',
        'Execute-phase module',
        ['Task 1', 'Task 2'],
        '.planning/phases/07-test/07-01-SUMMARY.md'
      );
      assert.ok(
        msg.startsWith('docs(07-01): complete Execute-phase module'),
        `Should start with docs(07-01), got: "${msg.split('\n')[0]}"`
      );
      assert.ok(msg.includes('Tasks completed: 2/2'), 'Should contain task count');
      assert.ok(msg.includes('- Task 1'), 'Should contain Task 1');
      assert.ok(msg.includes('- Task 2'), 'Should contain Task 2');
      assert.ok(msg.includes('SUMMARY:'), 'Should contain SUMMARY path reference');
      assert.ok(
        msg.includes('.planning/phases/07-test/07-01-SUMMARY.md'),
        'Should contain full summary path'
      );
    });

    // ---- SUMMARY Template tests ----

    console.log('\n--- SUMMARY Template ---');

    const summaryData = {
      phase: '07-test',
      plan: '01',
      title: 'Execute Module Test',
      oneLiner: 'Execute-phase module with 7 exports for plan discovery and commit helpers',
      subsystem: 'orchestration',
      tags: ['execution', 'commits'],
      requires: ['Phase 3: state modules'],
      provides: ['execute-phase.js module'],
      affects: ['08-verification'],
      techAdded: [],
      patterns: ['error-return-pattern'],
      filesCreated: [{ path: 'src/execute-phase.js', purpose: 'Main module' }],
      filesModified: [],
      decisions: [{ decision: 'Pure formatters return strings', rationale: 'Simpler API' }],
      duration: '2 min',
      completed: '2026-02-06',
      tasks: [
        { name: 'Create module', commit: 'abc123f', type: 'feat', files: ['src/execute-phase.js'] },
      ],
      accomplishments: ['Created execute-phase.js with 7 exports'],
      deviations: 'None - plan executed exactly as written.',
      issues: 'None',
      nextReadiness: 'Ready for integration test',
    };

    await test('8. buildSummaryContent generates valid frontmatter and sections', async () => {
      const content = buildSummaryContent(summaryData);
      // Frontmatter
      assert.ok(content.startsWith('---'), 'Should start with frontmatter delimiter');
      assert.ok(content.includes('phase: 07-test'), 'Should contain phase');
      // Required sections
      assert.ok(content.includes('## Accomplishments'), 'Should have Accomplishments section');
      assert.ok(content.includes('## Task Commits'), 'Should have Task Commits section');
      assert.ok(content.includes('## Files Created/Modified'), 'Should have Files section');
      assert.ok(content.includes('## Decisions Made'), 'Should have Decisions section');
      assert.ok(content.includes('## Deviations from Plan'), 'Should have Deviations section');
      assert.ok(content.includes('## Next Phase Readiness'), 'Should have Next Phase Readiness');
      // Verify structural elements
      assert.ok(content.includes('## Performance'), 'Should have Performance section');
      assert.ok(content.includes('subsystem: orchestration'), 'Frontmatter should have subsystem');
      assert.ok(content.includes('tags: [execution, commits]'), 'Frontmatter should have tags');
    });

    await test('9. buildSummaryContent one-liner is substantive', async () => {
      const content = buildSummaryContent(summaryData);
      assert.ok(
        content.includes('Execute-phase module with 7 exports for plan discovery and commit helpers'),
        'Content should contain the exact one-liner'
      );
    });

    // ---- Phase Completion tests ----

    console.log('\n--- Phase Completion ---');

    await test('10. getPhaseCompletionStatus detects incomplete phase', async () => {
      // Reuse phaseDir from Test 1 (3 plans, 1 summary)
      const result = await getPhaseCompletionStatus(phaseDir);
      assert.equal(result.success, true, 'Should succeed');
      assert.equal(result.data.allComplete, false, 'Should be incomplete');
      assert.equal(result.data.totalPlans, 3, 'Should have 3 total plans');
      assert.equal(result.data.completedPlans, 1, 'Should have 1 completed');
      assert.ok(
        result.data.incompletePlans.includes('07-02'),
        'Incomplete should include 07-02'
      );
      assert.ok(
        result.data.incompletePlans.includes('07-03'),
        'Incomplete should include 07-03'
      );
    });

    await test('11. getPhaseCompletionStatus detects complete phase', async () => {
      const completeDir = path.join(TEMP_DIR, 'complete-phase');
      await mkdir(completeDir, { recursive: true });
      await writeFile(path.join(completeDir, '08-01-PLAN.md'), PLAN_FRONTMATTER(1));
      await writeFile(path.join(completeDir, '08-02-PLAN.md'), PLAN_FRONTMATTER(2));
      await writeFile(path.join(completeDir, '08-01-SUMMARY.md'), '# Done');
      await writeFile(path.join(completeDir, '08-02-SUMMARY.md'), '# Done');

      const result = await getPhaseCompletionStatus(completeDir);
      assert.equal(result.success, true, 'Should succeed');
      assert.equal(result.data.allComplete, true, 'Should be complete');
      assert.equal(result.data.totalPlans, 2, 'Should have 2 total plans');
      assert.equal(result.data.completedPlans, 2, 'Should have 2 completed');
      assert.equal(result.data.incompletePlans.length, 0, 'Should have no incomplete');
    });

    await test('12. getPhaseCompletionStatus returns error for non-existent directory', async () => {
      const result = await getPhaseCompletionStatus('/tmp/nonexistent-dir-12345');
      assert.equal(result.success, false, 'Should fail');
      assert.ok(
        result.error.includes('does not exist') || result.error.includes('not exist'),
        `Error should mention non-existence, got: "${result.error}"`
      );
    });

  } finally {
    // ---- Cleanup ----
    console.log('\n--- Cleanup ---');
    await rm(TEMP_DIR, { recursive: true, force: true });
    console.log(`  Removed: ${TEMP_DIR}`);
  }

  // ---- Summary ----

  const total = passed + failed;
  console.log(`\n${'='.repeat(40)}`);
  console.log(`${passed}/${total} tests passed`);

  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures) {
      console.log(`  - ${f.name}: ${f.error}`);
    }
  }

  console.log();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
