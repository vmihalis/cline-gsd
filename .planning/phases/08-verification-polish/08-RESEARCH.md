# Phase 8: Verification & Polish - Research

**Researched:** 2026-02-06
**Domain:** Post-execution UAT verification, systematic debugging, upstream sync, must-haves checking
**Confidence:** HIGH (based on codebase analysis + upstream GSD reference)

## Summary

Phase 8 is the final phase of the Cline-GSD port. It covers four requirements: VER-01 (verify-work UAT), VER-02 (debug command), VER-03 (must-haves checking against codebase), and SYNC-02 (upstream sync mechanism). The upstream GSD project has mature implementations of all these features (verify-work.md, diagnose-issues.md, verify-phase.md, gsd-debugger.md agent), which provide the reference architecture. The Cline adaptation must account for the key difference: Cline agents are read-only CLI subagents (`cline "prompt" &`), while upstream GSD uses in-process Task tool agents that can edit code.

The research confirms that all three planned plans (08-01: verify-work + UAT, 08-02: debug with checkpoints, 08-03: upstream sync + documentation) are correctly scoped. The src/ helper + workflow + test pattern established in Phases 6-7 continues here. No new external dependencies are needed -- the existing codebase modules (state-read.js, state-write.js, state-init.js, agent-spawn.js, agent-collect.js, execute-phase.js, discuss-phase.js) provide all the building blocks.

**Primary recommendation:** Port upstream GSD's verify-work, debug, and verify-phase patterns to Cline, adapting the agent-based diagnosis to use CLI subagents for research-only investigation while keeping verification and fix planning in the main Cline context.

## Standard Stack

### Core

No new libraries needed. Phase 8 uses only existing codebase modules.

| Module | Purpose | Why Standard |
|--------|---------|--------------|
| `src/state-read.js` | Parse STATE.md, ROADMAP.md, config.json, PLAN.md frontmatter | Existing -- all phase details and must_haves parsing |
| `src/state-write.js` | Update STATE.md and ROADMAP.md | Existing -- state updates after verification |
| `src/state-init.js` | ensurePhaseDir, renderProgressBar | Existing -- create debug directory |
| `src/agent-spawn.js` | spawnAgent, spawnAgents, waitForAgents | Existing -- spawn debug/diagnosis agents |
| `src/agent-collect.js` | verifyOutputs, collectOutputs, reportResults | Existing -- collect debug agent results |
| `src/execute-phase.js` | discoverPlans, getPhaseCompletionStatus, buildSummaryContent | Existing -- discover plans for verification |
| `src/discuss-phase.js` | getPhaseDetails, getOrCreatePhaseDir | Existing -- phase directory management |

### Supporting

| Module | Purpose | When to Use |
|--------|---------|-------------|
| `node:fs/promises` | File I/O for UAT.md, VERIFICATION.md, debug files | All new modules |
| `node:path` | Path operations | All new modules |
| `node:child_process` | Git operations for upstream sync | Sync helper only |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual git commands for sync | npm package like `simple-git` | Extra dependency; git CLI is sufficient and already used in execution workflow |
| Complex AST parsing for must-haves | Regex/grep pattern matching | AST parsing too heavy for this scope; upstream uses grep/search patterns |

**Installation:** No new packages needed.

## Architecture Patterns

### Recommended Project Structure for Phase 8

```
src/
├── verify-work.js        # Verify-work helper (UAT extraction, test management, result processing)
├── debug-phase.js        # Debug helper (session management, file protocol, prompt building)
├── upstream-sync.js      # Upstream sync helper (version check, fetch/merge, conflict detection)
workflows/gsd/
├── gsd-verify-work.md    # /gsd-verify-work workflow (interactive UAT)
├── gsd-debug.md          # /gsd-debug workflow (systematic debugging)
├── gsd-sync-upstream.md  # /gsd-sync-upstream workflow (pull upstream improvements)
scripts/
├── test-verify-work.js   # Integration test for verify-work module
agents/
├── (none new)            # Debug agents use existing gsd-debugger pattern via prompts
```

### Pattern 1: Verify-Work as Main-Context Interactive Workflow

**What:** The verify-work command runs in the main Cline context as an interactive conversation. It extracts testable deliverables from SUMMARY.md files, presents them one-by-one to the user, and records pass/fail/issue results.

**When to use:** After plan execution completes for a phase.

**How it differs from upstream:** Upstream GSD spawns parallel diagnosis agents when issues are found. Cline-GSD keeps diagnosis interactive in the main context (since debug agents are read-only and cannot fix code). The workflow presents issues and offers to spawn a debug agent for investigation, but the actual fix happens in the main context.

**Key data flow:**
```
SUMMARY.md files -> extract testable deliverables -> present to user ->
record results -> generate UAT.md -> if issues: offer /gsd-debug
```

**Confidence:** HIGH -- follows the same main-context interactive pattern established in Phase 7 (execute-phase).

### Pattern 2: Must-Haves Verification (VER-03)

**What:** Automated checking of PLAN.md `must_haves` frontmatter against the actual codebase. This is the "verify-phase" concept from upstream GSD, adapted for Cline.

**When to use:** After execution completes, before or alongside UAT. Can also be called independently.

**Three-level artifact verification (from upstream verify-phase):**

1. **Existence:** Does the file exist?
2. **Substantive:** Is it more than a stub? (line count thresholds, no placeholder patterns)
3. **Wired:** Is it imported and used by other files?

**Truth verification:** Each `must_haves.truths` entry maps to observable behaviors. Check supporting artifacts and wiring.

**Key implementation:** The `parsePlanFrontmatter()` function in state-read.js already handles plan frontmatter but does NOT deeply parse `must_haves` (it was left as raw text intentionally -- see decision in Phase 3). Phase 8 needs a `parseMustHaves(planContent)` parser that extracts the `truths`, `artifacts`, and `key_links` arrays from the YAML frontmatter.

**Confidence:** HIGH -- upstream verify-phase.md provides the complete algorithm. The Cline port uses grep/file-read patterns instead of AST analysis.

### Pattern 3: Debug Session with Persistent State

**What:** The debug command creates a persistent debug file in `.planning/debug/` that tracks the investigation through hypothesis -> test -> eliminate/confirm cycles. The file persists across `/clear` boundaries so investigation can resume.

**When to use:** When bugs are found during UAT or manually triggered by user.

**Key adaptation for Cline:**
- Upstream GSD debugger is a Task tool agent (can edit code, run tests)
- Cline-GSD debug runs in main context (Cline performs the investigation)
- The workflow guides Cline through the scientific debugging methodology
- The `.planning/debug/DEBUG-{slug}.md` file is the persistent state

**File protocol (from upstream gsd-debugger.md):**
```
.planning/debug/DEBUG-{slug}.md:
  frontmatter: status, trigger, created, updated
  Current Focus: hypothesis, test, expecting, next_action
  Symptoms: expected, actual, errors, reproduction, started
  Eliminated: (append-only) disproven hypotheses with evidence
  Evidence: (append-only) findings with implications
  Resolution: root_cause, fix, verification, files_changed
```

**Status transitions:** `gathering -> investigating -> fixing -> verifying -> resolved`

**Confidence:** HIGH -- upstream debugger agent definition (990 lines) is well-documented.

### Pattern 4: Upstream Sync Mechanism

**What:** A workflow and helper that allows users to pull improvements from `glittercowboy/get-shit-done` into their Cline-GSD installation.

**How it works:**
1. The Cline-GSD repository tracks upstream GSD as a reference (not a git submodule)
2. The sync workflow checks if a newer version of upstream GSD exists
3. It fetches upstream changes and identifies files relevant to Cline-GSD
4. Cline-specific files (workflows/gsd/, src/, bin/) are protected from overwrite
5. Template and pattern files can be updated selectively

**Implementation approach:**
- `npx cline-gsd` already handles clean install (removes old gsd-* files, copies new ones)
- Upstream sync means: `npx cline-gsd@latest` to update to the latest published version
- For development/contribution: add a `--check-upstream` flag that compares local vs upstream GSD
- The documentation should explain how to track upstream changes manually via git

**Confidence:** MEDIUM -- the exact sync mechanism is partly a documentation/process concern rather than purely code. The installer already handles reinstallation.

### Anti-Patterns to Avoid

- **Spawning debug agents that try to fix code:** Cline CLI agents are read-only. Debug agents can only investigate and report. The main context handles fixes.
- **Blocking verification on external services:** Keep all checks local (file existence, content analysis, import tracing).
- **Over-engineering must-haves parsing:** Keep it regex-based like the existing frontmatter parser. Don't add YAML parsing libraries.
- **Making upstream sync automatic:** Users should explicitly trigger sync. Automatic updates break trust and can introduce breaking changes.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | Custom full YAML parser | Extend existing `parsePlanFrontmatter()` regex approach | Already works for all other frontmatter; must_haves follows same pattern |
| File existence checking | Custom exists() function | Use existing `access()` pattern from state-init.js | Already proven, handles edge cases |
| Agent spawning for diagnosis | New agent infrastructure | Use existing `spawnAgent`/`waitForAgents` from agent-spawn.js | Built and tested in Phase 2 |
| Output verification | New file checking code | Use existing `verifyOutputs` from agent-collect.js | Handles all edge cases already |
| Progress bar rendering | New progress display | Use existing `renderProgressBar` from state-init.js | Consistent with rest of system |

**Key insight:** Phase 8 is primarily about **orchestration and workflow** -- almost all the building blocks already exist in the codebase from Phases 1-7. The new code should be relatively thin: a verify-work.js helper, a debug-phase.js helper, an upstream-sync.js helper, three workflows, and one test file.

## Common Pitfalls

### Pitfall 1: Confusing Verification with Testing

**What goes wrong:** Building automated test runners instead of user acceptance testing.
**Why it happens:** Developers conflate UAT (human verification) with automated testing.
**How to avoid:** Verify-work is interactive -- it presents expected behavior to the user and records their confirmation. Must-haves checking is automated but checks file existence/wiring, not runtime behavior.
**Warning signs:** If the implementation tries to `node --test` or run scripts, it's gone wrong. UAT means asking the user "does this work?"

### Pitfall 2: Debug State File Getting Out of Sync

**What goes wrong:** The debug file doesn't reflect the current investigation state, making resume fail.
**Why it happens:** Updates happen after actions instead of before.
**How to avoid:** Follow the upstream protocol: "Update BEFORE taking action, not after." The Current Focus section always shows what's about to happen, so if the session breaks, resume knows where to pick up.
**Warning signs:** The debug file shows completed steps in Current Focus but no Evidence entries.

### Pitfall 3: Must-Haves Parsing Too Fragile

**What goes wrong:** The must_haves parser breaks on slight formatting variations in PLAN.md frontmatter.
**Why it happens:** YAML frontmatter is sensitive to whitespace and indentation.
**How to avoid:** Follow the existing `parsePlanFrontmatter()` pattern -- extract the frontmatter block first, then parse specific fields with line-by-line regex. Handle both inline array `[a, b]` and multi-line `- item` formats. Gracefully return null/empty when fields are missing.
**Warning signs:** Tests fail on plans from different phases that have slightly different formatting.

### Pitfall 4: Upstream Sync Breaking Cline-Specific Code

**What goes wrong:** Pulling upstream changes overwrites Cline-specific workflow files or helper modules.
**Why it happens:** No clear separation between upstream-compatible and Cline-specific files.
**How to avoid:** The installer already uses `gsd-` prefix for all Cline workflow files. Upstream sync should only update reference materials (templates, documentation), not installed workflows. Document the file ownership clearly.
**Warning signs:** After sync, `/gsd-health` reports missing or broken workflows.

### Pitfall 5: Debug Agent Trying to Edit Files

**What goes wrong:** The debug workflow spawns a CLI agent that tries to make code changes, which fails because CLI agents are read-only.
**Why it happens:** Porting upstream debug patterns too literally.
**How to avoid:** Debug agents in Cline-GSD are investigation-only. They analyze code, form hypotheses, and report findings. The main context handles all code changes. The workflow should explicitly instruct: "You are investigating only. Report your findings. Do not attempt to edit files."
**Warning signs:** Debug agents produce error output about permission denied or file write failures.

## Code Examples

### Example 1: Must-Haves Parser (extending existing pattern)

```javascript
// Source: existing parsePlanFrontmatter in src/state-read.js + upstream verify-phase.md
/**
 * Parse must_haves from PLAN.md frontmatter content.
 * Handles truths (string[]), artifacts ({path, provides, exports[], min_lines}[]),
 * and key_links ({from, to, via, pattern}[]).
 */
export function parseMustHaves(content) {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return null;

  const fmText = fmMatch[1];

  // Check if must_haves section exists
  if (!fmText.includes('must_haves:')) return null;

  const result = { truths: [], artifacts: [], key_links: [] };

  // Parse truths (array of quoted strings under must_haves.truths)
  const truthsMatch = fmText.match(/truths:\s*\n((?:\s+-\s+"[^"]+"\n?)+)/);
  if (truthsMatch) {
    const lines = truthsMatch[1].match(/"([^"]+)"/g);
    result.truths = lines ? lines.map(l => l.replace(/^"|"$/g, '')) : [];
  }

  // Parse artifacts (array of objects under must_haves.artifacts)
  // ... (similar line-by-line parsing)

  // Parse key_links (array of objects under must_haves.key_links)
  // ... (similar line-by-line parsing)

  return result;
}
```

**Confidence:** HIGH -- follows the exact same pattern as the existing `parsePlanFrontmatter()`.

### Example 2: UAT File Template

```javascript
// Source: upstream verify-work.md UAT file structure
export function buildUATContent(data) {
  const { phase, phaseName, tests, status, created, updated } = data;

  const frontmatter = `---
status: ${status}
phase: ${phase}
created: ${created}
updated: ${updated}
total: ${tests.length}
passed: ${tests.filter(t => t.result === 'pass').length}
failed: ${tests.filter(t => t.result === 'fail').length}
skipped: ${tests.filter(t => t.result === 'skipped').length}
pending: ${tests.filter(t => t.result === 'pending').length}
---`;

  const testsList = tests.map((t, i) =>
    `### Test ${i + 1}: ${t.name}\n- **Expected:** ${t.expected}\n- **Result:** ${t.result}\n${t.issue ? `- **Issue:** ${t.issue}\n- **Severity:** ${t.severity}\n` : ''}`
  ).join('\n');

  return `${frontmatter}\n\n# Phase ${phase}: ${phaseName} - UAT\n\n${testsList}`;
}
```

**Confidence:** HIGH -- matches upstream UAT file structure.

### Example 3: Debug Session File Template

```javascript
// Source: upstream gsd-debugger.md debug file protocol
export function buildDebugFileContent(data) {
  const { slug, trigger, status, created, updated } = data;

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
```

**Confidence:** HIGH -- matches upstream debug file protocol exactly.

### Example 4: Artifact Substantive Check

```javascript
// Source: upstream verify-phase.md three-level verification
const MIN_LINES = {
  component: 15,
  api_route: 10,
  utility: 10,
  schema: 5,
  module: 10,  // Default for src/*.js files
};

const STUB_PATTERNS = [
  /TODO/i, /FIXME/i, /placeholder/i, /coming soon/i,
  /lorem ipsum/i, /throw new Error\(['"]not implemented/i,
  /return\s*;?\s*$/m,  // Empty return
];

export function checkArtifactSubstantive(content, type = 'module') {
  const lines = content.split('\n').length;
  const minLines = MIN_LINES[type] || MIN_LINES.module;
  const hasStubs = STUB_PATTERNS.some(p => p.test(content));
  const hasExports = /export\s/.test(content);

  if (lines >= minLines && !hasStubs && hasExports) return 'SUBSTANTIVE';
  if (lines < minLines || hasStubs) return 'STUB';
  return 'PARTIAL';
}
```

**Confidence:** HIGH -- directly from upstream verify-phase.md algorithm.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual post-execution review | Structured UAT with persistent state | Upstream GSD v1.5.17 | Systematic verification with resume |
| Ad-hoc debugging | Scientific method with debug files | Upstream GSD v1.5.16 | Persistent investigation state across /clear |
| Copy-paste from upstream | npx re-install for updates | Since Phase 1 | Clean install pattern already handles sync |

**Deprecated/outdated:**
- None identified. All upstream patterns are current (v1.11.2 as of 2026-02-05).

## Codebase Integration Points

### What Already Exists That Phase 8 Uses

1. **`parsePlanFrontmatter()`** in state-read.js -- parses plan frontmatter but intentionally skips deep must_haves parsing (decision 03-02). Phase 8 adds a `parseMustHaves()` companion function.

2. **`discoverPlans()`** in execute-phase.js -- discovers all PLAN.md files in a phase directory with completion status. Verify-work uses this to find what was built.

3. **`getPhaseCompletionStatus()`** in execute-phase.js -- checks if all plans have matching SUMMARY.md. Verification runs only after phase is complete (or on specific plans).

4. **`buildSummaryContent()`** in execute-phase.js -- generates SUMMARY.md. Verify-work extracts testable deliverables from these summaries.

5. **`spawnAgent()`/`waitForAgents()`** in agent-spawn.js -- spawns background agents. Debug diagnosis can optionally use this for parallel investigation (when Cline CLI is available).

6. **`verifyOutputs()`/`collectOutputs()`** in agent-collect.js -- verifies agent output files exist and collects their content.

7. **`getPhaseDetails()`** in discuss-phase.js -- extracts phase goal, requirements, success criteria from ROADMAP.md. Used to establish verification scope.

8. **`getOrCreatePhaseDir()`** in discuss-phase.js -- ensures phase directory exists.

9. **`readPlanningConfig()`** in state-read.js -- reads config.json with defaults including `workflow.verifier: true` which gates whether automated verification runs.

10. **`updateStateSection()`** in state-write.js -- updates specific sections in STATE.md (for recording verification results).

### New Files Phase 8 Creates

| File | Type | Exports | Purpose |
|------|------|---------|---------|
| `src/verify-work.js` | Helper module | parseMustHaves, extractTestableDeliveries, checkArtifactExists, checkArtifactSubstantive, checkArtifactWired, buildUATContent, buildVerificationContent | UAT and must-haves verification logic |
| `src/debug-phase.js` | Helper module | buildDebugFileContent, updateDebugFile, parseDebugFile, getActiveDebugSessions, buildDebugPrompt | Debug session management |
| `src/upstream-sync.js` | Helper module | checkUpstreamVersion, compareVersions, getInstalledVersion | Upstream version checking |
| `workflows/gsd/gsd-verify-work.md` | Workflow | N/A | Interactive UAT workflow |
| `workflows/gsd/gsd-debug.md` | Workflow | N/A | Systematic debugging workflow |
| `workflows/gsd/gsd-sync-upstream.md` | Workflow | N/A | Upstream sync workflow |
| `scripts/test-verify-work.js` | Test | N/A | Integration test |

## Open Questions

1. **Should must-haves verification run automatically after execution or be manually triggered?**
   - What we know: Upstream GSD runs verify-phase automatically as part of the execute-phase flow. The config has `workflow.verifier: true` setting.
   - What's unclear: Whether automatic verification adds value in the Cline interactive context where the user is watching execution happen.
   - Recommendation: Make it config-gated (`workflow.verifier`). When true, auto-run must-haves check after phase execution. When false, user triggers via `/gsd-verify-work`.

2. **How deep should debug agent investigation go?**
   - What we know: Upstream GSD debugger agents have full file editing capability. Cline CLI agents are read-only.
   - What's unclear: Whether read-only investigation agents provide enough value to justify the agent-spawning complexity.
   - Recommendation: Keep debug as a main-context workflow (not agent-spawned) for the initial implementation. The workflow guides Cline through the investigation methodology. If parallel diagnosis is needed (multiple issues from UAT), spawn read-only investigation agents.

3. **What exactly constitutes "upstream sync"?**
   - What we know: `npx cline-gsd@latest` already handles clean re-installation. The project tracks upstream GSD as a reference.
   - What's unclear: Whether users expect a `git merge` style sync or just a re-install.
   - Recommendation: Implement as re-install (`npx cline-gsd@latest`) with a version comparison check. Add documentation explaining the relationship to upstream GSD and how to manually check for upstream changes.

## Sources

### Primary (HIGH confidence)

- **Codebase analysis** -- Direct reading of all 14 src/*.js modules, 9 workflows/gsd/*.md files, 6 test scripts, and all .planning/ state files. This is the authoritative source for existing patterns.
- **Upstream GSD verify-work.md** -- Raw file from glittercowboy/get-shit-done (fetched via WebFetch). 14-step workflow for conversational UAT.
- **Upstream GSD verify-phase.md** -- Raw file from glittercowboy/get-shit-done (fetched via WebFetch). 12-step automated verification with three-level artifact checks.
- **Upstream GSD diagnose-issues.md** -- Raw file from glittercowboy/get-shit-done (fetched via WebFetch). Parallel debug agent orchestration.
- **Upstream GSD gsd-debugger.md** -- Raw file from glittercowboy/get-shit-done (fetched via WebFetch). 990-line debugger agent definition with scientific method, hypothesis testing, and persistent debug files.

### Secondary (MEDIUM confidence)

- **Upstream GSD CHANGELOG.md** -- Version history showing verify-work (v1.5.17), debug (v1.5.16), current version (v1.11.2). Confirms features are mature and stable.
- **GitHub repository structure** -- Directory listing showing 12 workflow files including verify-work.md, verify-phase.md, diagnose-issues.md.

### Tertiary (LOW confidence)

- None. All findings are based on direct codebase analysis and upstream source files.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All modules already exist in codebase; no new dependencies
- Architecture: HIGH -- Patterns directly derived from upstream GSD + existing codebase patterns
- Pitfalls: HIGH -- Based on direct analysis of how upstream handles edge cases
- Must-haves verification: HIGH -- Upstream verify-phase.md provides complete algorithm
- Debug protocol: HIGH -- Upstream gsd-debugger.md provides 990-line reference implementation
- Upstream sync: MEDIUM -- Partly a documentation/process concern; technical implementation is straightforward

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (stable -- no fast-moving dependencies)
