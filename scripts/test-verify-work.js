#!/usr/bin/env node

/**
 * Integration test for verify-work.js, debug-phase.js, and upstream-sync.js
 *
 * Tests must-haves parsing, artifact checking, debug file roundtrip,
 * UAT/verification content generation, and version comparison.
 * Catches parser regressions, content format issues, and version
 * comparison edge cases before real verification workflows run.
 *
 * Run: node scripts/test-verify-work.js
 * npm: "test:verify-work": "node scripts/test-verify-work.js"
 */

import { tmpdir } from 'node:os';
import { mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

import {
  parseMustHaves,
  extractTestableDeliveries,
  checkArtifactExists,
  checkArtifactSubstantive,
  buildUATContent,
  buildVerificationContent,
} from '../src/verify-work.js';

import { buildDebugFileContent, parseDebugFile } from '../src/debug-phase.js';
import { compareVersions, getInstalledVersion } from '../src/upstream-sync.js';

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
// Test suite
// ---------------------------------------------------------------------------

const TEMP_DIR = path.join(tmpdir(), `cline-gsd-verify-test-${Date.now()}`);

async function main() {
  console.log('\nVerify-Work Integration Test');
  console.log('============================\n');
  console.log(`Temp dir: ${TEMP_DIR}\n`);

  try {
    await mkdir(TEMP_DIR, { recursive: true });

    // ---- Must-Haves Parser tests ----

    console.log('--- Must-Haves Parser ---');

    await test('1. parseMustHaves extracts truths from frontmatter', async () => {
      const content = `---
phase: 08-test
plan: 01
must_haves:
  truths:
    - "getInstalledVersion reads the local package.json version"
    - "compareVersions correctly compares semver strings"
    - "checkUpstreamVersion fetches the latest published npm version"
---

# Plan 01
Content here.
`;
      const result = parseMustHaves(content);
      assert.ok(result !== null, 'Should return a result');
      assert.equal(result.truths.length, 3, 'Should have 3 truths');
      assert.ok(
        result.truths[0].includes('getInstalledVersion'),
        'First truth should mention getInstalledVersion'
      );
      assert.ok(
        result.truths[2].includes('checkUpstreamVersion'),
        'Third truth should mention checkUpstreamVersion'
      );
    });

    await test('2. parseMustHaves extracts artifacts from frontmatter', async () => {
      const content = `---
phase: 08-test
plan: 01
must_haves:
  truths: []
  artifacts:
    - path: "src/upstream-sync.js"
      provides: "Version comparison and upstream checking"
      exports: ["getInstalledVersion", "compareVersions", "checkUpstreamVersion"]
      min_lines: 50
---

# Plan 01
`;
      const result = parseMustHaves(content);
      assert.ok(result !== null, 'Should return a result');
      assert.equal(result.artifacts.length, 1, 'Should have 1 artifact');
      assert.equal(result.artifacts[0].path, 'src/upstream-sync.js', 'Path should match');
      assert.equal(result.artifacts[0].provides, 'Version comparison and upstream checking', 'Provides should match');
      assert.deepEqual(
        result.artifacts[0].exports,
        ['getInstalledVersion', 'compareVersions', 'checkUpstreamVersion'],
        'Exports should match'
      );
      assert.equal(result.artifacts[0].min_lines, 50, 'min_lines should be 50');
    });

    await test('3. parseMustHaves extracts key_links from frontmatter', async () => {
      const content = `---
phase: 08-test
plan: 01
must_haves:
  truths: []
  artifacts: []
  key_links:
    - from: "scripts/test-verify-work.js"
      to: "src/upstream-sync.js"
      via: "import for compareVersions, getInstalledVersion"
      pattern: "import.*upstream-sync"
---

# Plan 01
`;
      const result = parseMustHaves(content);
      assert.ok(result !== null, 'Should return a result');
      assert.equal(result.key_links.length, 1, 'Should have 1 key_link');
      assert.equal(result.key_links[0].from, 'scripts/test-verify-work.js', 'from should match');
      assert.equal(result.key_links[0].to, 'src/upstream-sync.js', 'to should match');
      assert.ok(result.key_links[0].via.includes('compareVersions'), 'via should mention compareVersions');
      assert.equal(result.key_links[0].pattern, 'import.*upstream-sync', 'pattern should match');
    });

    await test('4. parseMustHaves returns null for content without must_haves', async () => {
      const content = `---
phase: 08-test
plan: 01
autonomous: true
---

# Plan 01
No must_haves here.
`;
      const result = parseMustHaves(content);
      assert.equal(result, null, 'Should return null when no must_haves');
    });

    await test('5. parseMustHaves handles real PLAN.md format', async () => {
      const content = `---
phase: 08-verification-polish
plan: 03
type: execute
wave: 2
depends_on: ["08-01", "08-02"]
files_modified:
  - src/upstream-sync.js
  - workflows/gsd/gsd-sync-upstream.md

must_haves:
  truths:
    - "getInstalledVersion reads the local package.json version"
    - "compareVersions correctly compares semver strings"
  artifacts:
    - path: "src/upstream-sync.js"
      provides: "Version comparison and upstream checking"
      exports: ["getInstalledVersion", "compareVersions"]
      min_lines: 50
    - path: "workflows/gsd/gsd-sync-upstream.md"
      provides: "Cline workflow for /gsd-sync-upstream command"
      min_lines: 60
  key_links:
    - from: "scripts/test-verify-work.js"
      to: "src/upstream-sync.js"
      via: "import for compareVersions"
      pattern: "import.*upstream-sync"
---

# Plan content
`;
      const result = parseMustHaves(content);
      assert.ok(result !== null, 'Should return a result');
      assert.equal(result.truths.length, 2, 'Should have 2 truths');
      assert.equal(result.artifacts.length, 2, 'Should have 2 artifacts');
      assert.equal(result.key_links.length, 1, 'Should have 1 key_link');
      assert.equal(result.artifacts[1].path, 'workflows/gsd/gsd-sync-upstream.md', 'Second artifact path');
      assert.equal(result.artifacts[1].min_lines, 60, 'Second artifact min_lines');
    });

    // ---- Artifact Checking tests ----

    console.log('\n--- Artifact Checking ---');

    await test('6. checkArtifactExists returns true for existing file', async () => {
      const filePath = path.join(TEMP_DIR, 'exists.js');
      await writeFile(filePath, 'export function hello() {}');
      const result = await checkArtifactExists(filePath);
      assert.equal(result.success, true, 'Should succeed');
      assert.equal(result.data.exists, true, 'File should exist');
    });

    await test('7. checkArtifactExists returns false for non-existent file', async () => {
      const filePath = path.join(TEMP_DIR, 'does-not-exist.js');
      const result = await checkArtifactExists(filePath);
      assert.equal(result.success, true, 'Should succeed (checking is valid)');
      assert.equal(result.data.exists, false, 'File should not exist');
    });

    await test('8. checkArtifactSubstantive detects substantive files', async () => {
      const filePath = path.join(TEMP_DIR, 'substantive.js');
      const lines = [];
      for (let i = 0; i < 25; i++) {
        lines.push(`export function fn${i}() { return ${i}; }`);
      }
      await writeFile(filePath, lines.join('\n'));
      const result = await checkArtifactSubstantive(filePath, {
        min_lines: 10,
        exports: ['fn0', 'fn1'],
      });
      assert.equal(result.success, true, 'Should succeed');
      assert.equal(result.data.status, 'SUBSTANTIVE', 'Should be SUBSTANTIVE');
      assert.equal(result.data.hasStubs, false, 'Should have no stubs');
      assert.equal(result.data.missingExports.length, 0, 'Should have no missing exports');
    });

    await test('9. checkArtifactSubstantive detects stubs', async () => {
      const filePath = path.join(TEMP_DIR, 'stub.js');
      await writeFile(filePath, '// TODO: implement\nexport function stub() {}\n// placeholder');
      const result = await checkArtifactSubstantive(filePath, { min_lines: 10 });
      assert.equal(result.success, true, 'Should succeed');
      assert.equal(result.data.status, 'STUB', 'Should be STUB');
      assert.equal(result.data.hasStubs, true, 'Should detect stubs');
    });

    await test('10. checkArtifactSubstantive detects missing exports', async () => {
      const filePath = path.join(TEMP_DIR, 'partial.js');
      const lines = [];
      for (let i = 0; i < 20; i++) {
        lines.push(`function internal${i}() { return ${i}; }`);
      }
      await writeFile(filePath, lines.join('\n'));
      const result = await checkArtifactSubstantive(filePath, {
        min_lines: 10,
        exports: ['missingExport'],
      });
      assert.equal(result.success, true, 'Should succeed');
      assert.equal(result.data.status, 'PARTIAL', 'Should be PARTIAL');
      assert.deepEqual(result.data.missingExports, ['missingExport'], 'Should report missing export');
    });

    // ---- Debug File tests ----

    console.log('\n--- Debug File ---');

    await test('11. buildDebugFileContent generates valid debug file', async () => {
      const content = buildDebugFileContent({
        slug: 'login-redirect-loop',
        trigger: 'User reported infinite redirect on login',
        status: 'gathering',
        created: '2026-02-06',
        updated: '2026-02-06',
      });
      assert.ok(content.includes('---'), 'Should have frontmatter delimiters');
      assert.ok(content.includes('status: gathering'), 'Should have status');
      assert.ok(content.includes('trigger: User reported infinite redirect'), 'Should have trigger');
      assert.ok(content.includes('# Debug: login-redirect-loop'), 'Should have slug heading');
      assert.ok(content.includes('## Current Focus'), 'Should have Current Focus section');
      assert.ok(content.includes('## Symptoms'), 'Should have Symptoms section');
      assert.ok(content.includes('## Eliminated'), 'Should have Eliminated section');
      assert.ok(content.includes('## Evidence'), 'Should have Evidence section');
      assert.ok(content.includes('## Resolution'), 'Should have Resolution section');
    });

    await test('12. parseDebugFile roundtrips with buildDebugFileContent', async () => {
      const content = buildDebugFileContent({
        slug: 'api-timeout',
        trigger: 'API calls timing out after deploy',
        status: 'investigating',
        created: '2026-02-05',
        updated: '2026-02-06',
      });
      const parsed = parseDebugFile(content);
      assert.ok(parsed !== null, 'Should parse successfully');
      assert.equal(parsed.status, 'investigating', 'Status should match');
      assert.equal(parsed.trigger, 'API calls timing out after deploy', 'Trigger should match');
      assert.equal(parsed.slug, 'api-timeout', 'Slug should match');
      assert.equal(parsed.created, '2026-02-05', 'Created should match');
      assert.equal(parsed.updated, '2026-02-06', 'Updated should match');
      // Sections should be parsed
      assert.ok(parsed.currentFocus, 'Should have currentFocus');
      assert.ok(parsed.symptoms, 'Should have symptoms');
      assert.ok(parsed.resolution, 'Should have resolution');
      assert.equal(parsed.currentFocus.hypothesis, '(none yet)', 'Default hypothesis');
      assert.equal(parsed.currentFocus.next_action, 'Gather symptoms', 'Default next_action');
    });

    // ---- UAT and Verification Content tests ----

    console.log('\n--- UAT and Verification Content ---');

    await test('13. buildUATContent generates valid UAT file', async () => {
      const content = buildUATContent({
        phase: '08-verification-polish',
        phaseName: 'Verification & Polish',
        tests: [
          { name: 'Version check works', expected: 'Shows current version', result: 'pass' },
          { name: 'Update detection', expected: 'Detects newer version', result: 'fail', issue: 'Network timeout', severity: 'medium' },
        ],
        status: 'failed',
        created: '2026-02-06',
        updated: '2026-02-06',
      });
      // Frontmatter checks
      assert.ok(content.includes('status: failed'), 'Should have status');
      assert.ok(content.includes('passed: 1'), 'Should have passed: 1');
      assert.ok(content.includes('failed: 1'), 'Should have failed: 1');
      assert.ok(content.includes('total: 2'), 'Should have total: 2');
      // Body checks
      assert.ok(content.includes('# Phase 8: Verification & Polish - UAT'), 'Should have title');
      assert.ok(content.includes('### Test 1: Version check works'), 'Should have test 1');
      assert.ok(content.includes('### Test 2: Update detection'), 'Should have test 2');
      assert.ok(content.includes('**Issue:** Network timeout'), 'Should have issue details');
      assert.ok(content.includes('**Severity:** medium'), 'Should have severity');
    });

    await test('14. buildVerificationContent generates valid verification file', async () => {
      const content = buildVerificationContent({
        phase: '08-verification-polish',
        phaseName: 'Verification & Polish',
        plans: [
          {
            planId: '08-01',
            truths: [
              { text: 'Parser works correctly', status: 'pass' },
              { text: 'Exports are complete', status: 'fail' },
            ],
            artifacts: [
              { path: 'src/verify-work.js', exists: true, substantive: 'SUBSTANTIVE', wired: true, status: 'pass' },
            ],
            keyLinks: [],
          },
        ],
        created: '2026-02-06',
        summary: { totalChecks: 3, passed: 2, failed: 1, skipped: 0 },
      });
      // Frontmatter checks
      assert.ok(content.includes('status: fail'), 'Should have status fail');
      assert.ok(content.includes('passed: 2'), 'Should have passed: 2');
      assert.ok(content.includes('failed: 1'), 'Should have failed: 1');
      // Body checks
      assert.ok(content.includes('## Summary'), 'Should have Summary section');
      assert.ok(content.includes('2/3 checks passed'), 'Should have summary counts');
      assert.ok(content.includes('## Plan 08-01'), 'Should have plan section');
      assert.ok(content.includes('[x] "Parser works correctly"'), 'Should have passing truth');
      assert.ok(content.includes('[ ] "Exports are complete"'), 'Should have failing truth');
      assert.ok(content.includes('src/verify-work.js'), 'Should have artifact path');
    });

    // ---- Version Comparison tests ----

    console.log('\n--- Version Comparison ---');

    await test('15. compareVersions correctly compares semver strings', async () => {
      // behind
      const behind = compareVersions('1.0.0', '1.1.0');
      assert.equal(behind.needsUpdate, true, '1.0.0 vs 1.1.0 should need update');
      assert.equal(behind.comparison, 'behind', '1.0.0 vs 1.1.0 should be behind');

      // ahead
      const ahead = compareVersions('2.0.0', '1.0.0');
      assert.equal(ahead.needsUpdate, false, '2.0.0 vs 1.0.0 should not need update');
      assert.equal(ahead.comparison, 'ahead', '2.0.0 vs 1.0.0 should be ahead');

      // up-to-date
      const upToDate = compareVersions('1.0.0', '1.0.0');
      assert.equal(upToDate.needsUpdate, false, '1.0.0 vs 1.0.0 should not need update');
      assert.equal(upToDate.comparison, 'up-to-date', '1.0.0 vs 1.0.0 should be up-to-date');

      // patch version difference
      const patchBehind = compareVersions('1.0.0', '1.0.1');
      assert.equal(patchBehind.comparison, 'behind', '1.0.0 vs 1.0.1 should be behind');

      // major version difference
      const majorAhead = compareVersions('3.0.0', '2.9.9');
      assert.equal(majorAhead.comparison, 'ahead', '3.0.0 vs 2.9.9 should be ahead');
    });

    await test('16. getInstalledVersion reads local package.json', async () => {
      const result = await getInstalledVersion('.');
      assert.equal(result.success, true, 'Should succeed');
      assert.ok(result.data.version, 'Should have a version');
      // Verify it looks like a semver string
      assert.ok(
        /^\d+\.\d+\.\d+/.test(result.data.version),
        `Version should match semver pattern, got: "${result.data.version}"`
      );
      assert.ok(result.data.path, 'Should have a path');
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
