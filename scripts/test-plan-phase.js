#!/usr/bin/env node

/**
 * Integration test for plan-phase.js and discuss-phase.js
 *
 * Tests prompt builders, expected file path computation, config gating
 * logic, and discuss-phase helpers. Catches path mismatches, schema drift,
 * and import errors before real agent execution.
 *
 * Run: node scripts/test-plan-phase.js
 * npm: "test:plan-phase": "node scripts/test-plan-phase.js"
 */

import { tmpdir } from 'node:os';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

import {
  getPhaseDetails,
  getContextTemplateSections,
} from '../src/discuss-phase.js';

import {
  buildResearchPrompt,
  buildPlannerPrompt,
  buildCheckerPrompt,
  getExpectedPlanFiles,
} from '../src/plan-phase.js';

import { readPlanningConfig } from '../src/state-read.js';

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
// Mock data
// ---------------------------------------------------------------------------

const MOCK_ROADMAP = `# Roadmap: Test Project

## Overview

Test roadmap for integration testing.

## Phase Details

### Phase 6: Planning Workflow
**Goal**: Users can create validated plans with research support
**Depends on**: Phase 2, Phase 3, Phase 4
**Requirements**: CMD-02, CMD-05, AGT-04, AGT-05, AGT-06
**Success Criteria** (what must be TRUE):
  1. /gsd:discuss-phase N gathers context before planning
  2. /gsd:plan-phase N creates PLAN.md with atomic tasks
  3. Research agents run before planning when enabled in config
**Plans**: 3 plans

### Phase 7: Execution Workflow
**Goal**: Users can execute plans with atomic commits per task
**Depends on**: Phase 3, Phase 6
**Plans**: TBD
`;

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

const TEMP_DIR = path.join(tmpdir(), `cline-gsd-plan-test-${Date.now()}`);

async function main() {
  console.log('\nPlan Phase Integration Test');
  console.log('==========================\n');
  console.log(`Temp dir: ${TEMP_DIR}\n`);

  try {
    // Set up temp planning dir with mock ROADMAP.md
    const planningDir = path.join(TEMP_DIR, '.planning');
    await mkdir(planningDir, { recursive: true });
    await writeFile(path.join(planningDir, 'ROADMAP.md'), MOCK_ROADMAP);

    // ---- discuss-phase.js tests ----

    console.log('--- discuss-phase.js ---');

    await test('1. getContextTemplateSections returns 3 sections', async () => {
      const result = getContextTemplateSections();
      assert.equal(result.success, true, 'Should succeed');
      assert.equal(result.data.sections.length, 3, 'Should have 3 sections');
      assert.deepEqual(
        result.data.sections,
        ['Decisions', "Claude's Discretion", 'Deferred Ideas'],
        'Sections should match canonical names'
      );
      assert.ok(
        typeof result.data.template === 'string' && result.data.template.length > 0,
        'Template should be a non-empty string'
      );
      // Verify template contains all three section headers
      assert.ok(result.data.template.includes('## Decisions'), 'Template should contain Decisions header');
      assert.ok(result.data.template.includes("## Claude's Discretion"), 'Template should contain Claude\'s Discretion header');
      assert.ok(result.data.template.includes('## Deferred Ideas'), 'Template should contain Deferred Ideas header');
    });

    await test('2. getPhaseDetails reads phase from mock ROADMAP.md', async () => {
      const result = await getPhaseDetails(planningDir, 6);
      assert.equal(result.success, true, 'Should succeed');
      assert.ok(
        result.data.name.includes('Planning Workflow'),
        `Phase name should contain "Planning Workflow", got: "${result.data.name}"`
      );
      assert.ok(result.data.details.length > 0, 'Details should be non-empty');
      assert.ok(
        result.data.successCriteria.length >= 1,
        'Should have at least 1 success criterion'
      );
    });

    await test('3. getPhaseDetails returns error for missing phase', async () => {
      const result = await getPhaseDetails(planningDir, 99);
      assert.equal(result.success, false, 'Should fail');
      assert.ok(
        result.error.includes('not found'),
        `Error should contain "not found", got: "${result.error}"`
      );
    });

    // ---- plan-phase.js prompt builder tests ----

    console.log('\n--- plan-phase.js prompt builders ---');

    await test('4. buildResearchPrompt references agent definition', async () => {
      const result = buildResearchPrompt(6, 'Planning Workflow', 'details here', 'context here', '/tmp/phasedir');
      assert.equal(result.success, true, 'Should succeed');
      assert.ok(result.data.prompt, 'Should have prompt');
      assert.ok(result.data.outputFile, 'Should have outputFile');
      assert.ok(
        result.data.prompt.includes('agents/gsd-phase-researcher.md'),
        'Prompt should reference gsd-phase-researcher.md agent definition'
      );
      assert.ok(
        result.data.prompt.includes('Phase 6'),
        'Prompt should contain phase number'
      );
      assert.ok(
        result.data.prompt.includes('Planning Workflow'),
        'Prompt should contain phase name'
      );
      assert.ok(
        result.data.outputFile.endsWith('06-RESEARCH.md'),
        `Output file should end with 06-RESEARCH.md, got: "${result.data.outputFile}"`
      );
    });

    await test('5. buildPlannerPrompt references agent definition', async () => {
      const result = buildPlannerPrompt(6, 'Planning Workflow', 'details', 'context content', 'research content', '/tmp/phasedir');
      assert.equal(result.success, true, 'Should succeed');
      assert.ok(
        result.data.prompt.includes('agents/gsd-planner.md'),
        'Prompt should reference gsd-planner.md agent definition'
      );
      assert.ok(
        result.data.prompt.includes('<user_decisions>'),
        'Prompt should contain <user_decisions> tags when context provided'
      );
      assert.ok(
        result.data.prompt.includes('<research>'),
        'Prompt should contain <research> tags when research provided'
      );
      assert.ok(
        result.data.outputFile.endsWith('06-PLANS-DONE.md'),
        `Output file should end with 06-PLANS-DONE.md, got: "${result.data.outputFile}"`
      );
    });

    await test('6. buildPlannerPrompt handles null context and research', async () => {
      const result = buildPlannerPrompt(6, 'Planning Workflow', 'details', null, null, '/tmp/phasedir');
      assert.equal(result.success, true, 'Should succeed');
      assert.ok(
        !result.data.prompt.includes('<user_decisions>'),
        'Prompt should NOT contain <user_decisions> when context is null'
      );
      assert.ok(
        !result.data.prompt.includes('<research>'),
        'Prompt should NOT contain <research> when research is null'
      );
      assert.ok(
        result.data.prompt.includes('agents/gsd-planner.md'),
        'Prompt should still reference agent definition'
      );
    });

    await test('7. buildCheckerPrompt references agent definition', async () => {
      const result = buildCheckerPrompt(6, 'Planning Workflow', 'context content', '/tmp/phasedir');
      assert.equal(result.success, true, 'Should succeed');
      assert.ok(
        result.data.prompt.includes('agents/gsd-plan-checker.md'),
        'Prompt should reference gsd-plan-checker.md agent definition'
      );
      assert.ok(
        result.data.outputFile.endsWith('06-CHECK.md'),
        `Output file should end with 06-CHECK.md, got: "${result.data.outputFile}"`
      );
    });

    await test('8. getExpectedPlanFiles returns correct paths', async () => {
      const result = getExpectedPlanFiles('/tmp/test/06-planning', '06');
      assert.ok(result.research, 'Should have research key');
      assert.ok(result.plans, 'Should have plans key');
      assert.ok(result.check, 'Should have check key');
      assert.ok(
        result.research.startsWith('/tmp/test/06-planning'),
        `Research path should start with phase dir, got: "${result.research}"`
      );
      assert.ok(
        result.plans.startsWith('/tmp/test/06-planning'),
        `Plans path should start with phase dir, got: "${result.plans}"`
      );
      assert.ok(
        result.check.startsWith('/tmp/test/06-planning'),
        `Check path should start with phase dir, got: "${result.check}"`
      );
      assert.ok(
        path.basename(result.research) === '06-RESEARCH.md',
        `Research filename should be 06-RESEARCH.md, got: "${path.basename(result.research)}"`
      );
      assert.ok(
        path.basename(result.plans) === '06-PLANS-DONE.md',
        `Plans filename should be 06-PLANS-DONE.md, got: "${path.basename(result.plans)}"`
      );
      assert.ok(
        path.basename(result.check) === '06-CHECK.md',
        `Check filename should be 06-CHECK.md, got: "${path.basename(result.check)}"`
      );
    });

    // ---- Config gating tests ----

    console.log('\n--- Config gating ---');

    await test('9. Config with research=false skips research prompt building', async () => {
      // Create a config.json with research disabled
      const configDir = path.join(TEMP_DIR, '.planning-gated');
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, 'config.json'),
        JSON.stringify({
          workflow: { research: false, plan_check: true },
          model_profile: 'quality',
        })
      );

      const configResult = await readPlanningConfig(configDir);
      assert.equal(configResult.success, true, 'Config should load');
      assert.equal(
        configResult.data.workflow.research,
        false,
        'research should be false'
      );
      assert.equal(
        configResult.data.workflow.plan_check,
        true,
        'plan_check should remain true'
      );

      // Verify the gating logic: when research is false, pipeline skips research
      // This mirrors the condition in runPlanningPipeline:
      //   if (config.workflow && config.workflow.research === true) { ... }
      const shouldRunResearch = configResult.data.workflow && configResult.data.workflow.research === true;
      assert.equal(shouldRunResearch, false, 'Pipeline should skip research when config says false');
    });

    await test('10. Config defaults enable all pipeline stages', async () => {
      // Use a temp dir with NO config.json to trigger defaults
      const noConfigDir = path.join(TEMP_DIR, '.planning-defaults');
      await mkdir(noConfigDir, { recursive: true });

      const configResult = await readPlanningConfig(noConfigDir);
      assert.equal(configResult.success, true, 'Config should load with defaults');
      assert.equal(
        configResult.data.workflow.research,
        true,
        'Default workflow.research should be true'
      );
      assert.equal(
        configResult.data.workflow.plan_check,
        true,
        'Default workflow.plan_check should be true'
      );
      assert.equal(
        configResult.data.model_profile,
        'quality',
        'Default model_profile should be "quality"'
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
