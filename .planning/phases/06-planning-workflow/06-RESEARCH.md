# Phase 6: Planning Workflow - Research

**Researched:** 2026-02-05
**Domain:** Workflow orchestration, agent spawning patterns, markdown-based command workflows
**Confidence:** HIGH

## Summary

Phase 6 implements three new Cline workflows (`gsd-discuss-phase.md`, `gsd-plan-phase.md`) and supporting Node.js orchestration modules. The domain is entirely internal to the cline-gsd system -- no external libraries are needed beyond what already exists in `package.json`. The phase wires together existing infrastructure (agent spawning from Phase 2, state management from Phase 3, config reading from Phase 4) into higher-level planning commands.

The primary challenge is orchestrating the pipeline correctly: discuss-phase must produce a CONTEXT.md that constrains plan-phase; plan-phase must optionally spawn a researcher agent, then a planner agent, then a plan-checker agent; and model orchestration must select cheaper models for research work. All three commands are workflow markdown files that Cline interprets step-by-step, with Node.js modules handling the programmatic orchestration logic.

The codebase already has all the building blocks: `agent-spawn.js` for spawning CLI subagents, `agent-collect.js` for verifying outputs, `state-read.js` for reading config/state, `state-write.js` for updating state, and `state-init.js` for directory creation. The agent definition files (`gsd-phase-researcher.md`, `gsd-planner.md`, `gsd-plan-checker.md`) already exist with full instructions. Phase 6 creates the orchestration layer that ties these together.

**Primary recommendation:** Follow the established pattern from `gsd-map-codebase.md` and `map-codebase.js` -- workflow markdown files drive step-by-step logic, Node.js modules handle orchestration, agents are spawned via `spawnAgent` with outputFile markers, and results are verified with `verifyOutputs`.

## Standard Stack

### Core (already in package.json -- no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js fs/promises | built-in | File I/O for CONTEXT.md, RESEARCH.md, PLAN.md | ESM-native, error-return pattern already established |
| Node.js path | built-in | Cross-platform path construction | Already used in all modules |
| picocolors | ^1.1.1 | Terminal output coloring | Already a dependency, used in output.js |

### Supporting (already available)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| agent-spawn.js | internal | Spawn researcher/planner/checker agents | When plan-phase needs to delegate to subagents |
| agent-collect.js | internal | Verify agent output files exist | After spawning agents, before proceeding to next step |
| state-read.js | internal | Read config.json, STATE.md, ROADMAP.md | At start of every workflow to load context |
| state-write.js | internal | Update STATE.md position and sections | After plan-phase completes to update progress |
| state-init.js | internal | Ensure phase directories exist | Before writing CONTEXT.md or spawning agents |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Spawning agents sequentially | Parallel research + planning | Agents depend on each other (researcher -> planner -> checker), so must be sequential |
| Node.js orchestration module | Pure workflow-only (no module) | Workflow-only is fragile for multi-step orchestration with error handling |
| Single mega-workflow | Split into discuss + plan workflows | Split matches upstream GSD pattern and keeps workflows focused |

**Installation:** No new packages needed. All dependencies already present.

## Architecture Patterns

### Recommended Module Structure

```
src/
  plan-phase.js          # Orchestration: build prompts, run pipeline, verify
  discuss-phase.js       # Context gathering helpers (phase dir, CONTEXT.md template)
workflows/gsd/
  gsd-discuss-phase.md   # Cline workflow for /gsd-discuss-phase
  gsd-plan-phase.md      # Cline workflow for /gsd-plan-phase
```

### Pattern 1: Workflow + Module Separation (established in Phase 5)

**What:** Workflow markdown files handle step-by-step user interaction and decision points. Node.js modules handle the programmatic orchestration (spawning agents, verifying outputs, reading/writing state). Workflows invoke modules via `node -e "import { fn } from './src/module.js'; ..."`.

**When to use:** Always. This is the established pattern across all phases.

**Example:**
```javascript
// src/plan-phase.js -- orchestration module
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { spawnAgent, waitForAgents } from './agent-spawn.js';
import { verifyOutputs, reportResults } from './agent-collect.js';
import { readPlanningConfig } from './state-read.js';
import { ensurePhaseDir } from './state-init.js';

export function buildResearchPrompt(phaseNum, phaseName, phaseContext) {
  // Build prompt referencing agents/gsd-phase-researcher.md
  const paddedPhase = String(phaseNum).padStart(2, '0');
  return {
    prompt: `Read agents/gsd-phase-researcher.md and follow instructions.\n\nPhase: ${phaseNum} - ${phaseName}\n${phaseContext}`,
    outputFile: `.planning/phases/${paddedPhase}-${slug}/RESEARCH.md`,
  };
}
```

### Pattern 2: Sequential Agent Pipeline

**What:** Research, planning, and checking must run sequentially (each depends on the previous output). Unlike map-codebase which runs 4 agents in parallel, plan-phase runs 3 agents in series: researcher -> planner -> checker.

**When to use:** When agent outputs feed into subsequent agent prompts.

**Example:**
```javascript
// Sequential pipeline: research -> plan -> check
export async function runPlanningPipeline(projectRoot, phaseNum, options) {
  const planningDir = path.join(projectRoot, '.planning');

  // Step 1: Research (if enabled in config)
  if (options.research) {
    const researchAgent = spawnAgent(researchPrompt, { outputFile: researchOutputFile });
    const [researchResult] = await waitForAgents([{ ...researchAgent, outputFile: researchOutputFile }]);
    const researchVerify = await verifyOutputs([researchOutputFile]);
    if (!researchVerify[0].exists) {
      return { success: false, error: 'Research agent did not produce output' };
    }
  }

  // Step 2: Plan (always)
  const planAgent = spawnAgent(planPrompt, { outputFile: planOutputFile });
  // ... wait and verify

  // Step 3: Check (if enabled in config)
  if (options.planCheck) {
    const checkAgent = spawnAgent(checkPrompt, { outputFile: checkOutputFile });
    // ... wait and verify
  }
}
```

### Pattern 3: Config-Driven Agent Toggle

**What:** The `config.json` `workflow` section controls which agents run. `workflow.research: true` enables the researcher agent. `workflow.plan_check: true` enables the plan checker. This is read via `readPlanningConfig()`.

**When to use:** At the start of plan-phase to determine pipeline shape.

**Example:**
```javascript
const configResult = await readPlanningConfig(planningDir);
const config = configResult.data;
const runResearch = config.workflow.research;
const runPlanCheck = config.workflow.plan_check;
```

### Pattern 4: Discuss-Phase as Interactive Workflow (no agents)

**What:** Unlike plan-phase, discuss-phase is a purely interactive workflow. Cline reads the phase description from ROADMAP.md, asks the user targeted questions about implementation decisions, and writes a structured CONTEXT.md. No agents are spawned.

**When to use:** discuss-phase only. It is a conversation, not an orchestration.

**Example CONTEXT.md output:**
```markdown
# Phase N: Name - Context

**Discussed:** 2026-02-05

## Decisions
- Use library X for authentication
- Card layout for dashboard (not tables)

## Claude's Discretion
- File naming conventions
- Internal module organization
- Error message wording

## Deferred Ideas
- Search functionality (Phase N+1)
- Dark mode support (Phase N+2)
```

### Pattern 5: Model Orchestration via Agent Definition Frontmatter

**What:** The upstream GSD agent definitions already specify tool requirements in their frontmatter. Model orchestration is handled at the Cline CLI level, not in the Node.js modules. The workflow instructs Cline to use "a cheaper model" for research by referencing the `model_profile` config and passing model hints in the agent spawn prompt.

**When to use:** When spawning agents that should use different model tiers.

**Key insight:** Cline's `cline -y "prompt"` command uses whatever model is configured in Cline settings. Model orchestration at the GSD level is advisory -- the workflow can suggest it, but Cline's global model setting determines what actually runs. The `model_profile` config field is a hint for future Cline features that may support per-agent model selection.

### Anti-Patterns to Avoid

- **Inlining agent instructions in workflow:** Always reference the agent definition file (`agents/gsd-planner.md`), never copy agent instructions into the workflow or prompt.
- **Parallel agents when sequential is needed:** Research must complete before planning; planning must complete before checking. Do not parallelize the pipeline.
- **Skipping output verification:** Always verify agent output files exist before proceeding. Agents can fail silently.
- **Hardcoding phase directories:** Always use the `ensurePhaseDir` pattern with zero-padded phase numbers.
- **Writing CONTEXT.md from Node.js module:** CONTEXT.md is written by the workflow (Cline's Write tool) during the interactive discussion, not by a Node.js helper. The user shapes it interactively.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Phase directory creation | Manual mkdir + path construction | `ensurePhaseDir(planningDir, phaseNum, phaseName)` | Handles zero-padding, slugification, recursive creation |
| Config reading with defaults | Manual JSON.parse + default merging | `readPlanningConfig(planningDir)` | Already handles missing file, malformed JSON, deep merging |
| Agent spawning + waiting | Direct `child_process.spawn` | `spawnAgent` + `waitForAgents` | Platform-specific spawn options, timeout handling, PID tracking |
| Output verification | Manual `fs.access` checks | `verifyOutputs(files)` + `reportResults(verifications)` | Counts lines/bytes, generates report, handles missing files |
| State position updates | Manual regex on STATE.md | `updateStatePosition(planningDir, position)` | Handles all position lines atomically |
| ROADMAP.md plan checkbox toggling | Manual regex find/replace | `updatePlanCheckbox(planningDir, phaseNum, planNum, checked)` | Handles both `[ ]` and `[x]` states |
| Progress bar rendering | Manual character building | `renderProgressBar(completed, total)` | Consistent format across all callers |

**Key insight:** All infrastructure for this phase already exists. The work is composing existing modules into new orchestration flows, not building new low-level capabilities.

## Common Pitfalls

### Pitfall 1: Agent Output File Not Matching Expected Path

**What goes wrong:** The spawned agent writes its output to a path that differs from what the orchestrator expects. Verification then reports the file as missing even though the agent succeeded.

**Why it happens:** Path construction in the prompt doesn't match path construction in the verifier. Relative vs absolute path confusion, or slug differences.

**How to avoid:** Use a single function to compute the output file path. Pass that exact path to both the agent prompt and the verification step. The `map-codebase.js` module demonstrates this pattern with `getExpectedOutputFiles()` computing paths used by both `buildMapperPrompts()` and `verifyOutputs()`.

**Warning signs:** Tests pass with hardcoded paths but fail with dynamic phase names.

### Pitfall 2: Discuss-Phase CONTEXT.md Format Mismatch

**What goes wrong:** The discuss-phase workflow writes CONTEXT.md with slightly different section names than what plan-phase (and agent definitions) expect. The researcher agent can't find `## Decisions` because it was written as `## Key Decisions` or `## User Decisions`.

**Why it happens:** No shared template or validation for the CONTEXT.md structure.

**How to avoid:** Define the CONTEXT.md template structure in a helper function that both the discuss-phase workflow and the plan-phase pipeline reference. Use exact section headers: `## Decisions`, `## Claude's Discretion`, `## Deferred Ideas`. The agent definition files (`gsd-phase-researcher.md`, `gsd-planner.md`, `gsd-plan-checker.md`) all expect these exact headers.

**Warning signs:** Researcher agent produces research that ignores user decisions. Planner creates plans that contradict user choices.

### Pitfall 3: Sequential Pipeline Error Handling

**What goes wrong:** Research agent fails (times out or produces no output), but the pipeline continues to spawn the planner agent anyway. The planner runs without research context and produces lower-quality plans.

**Why it happens:** No error checking between pipeline stages.

**How to avoid:** After each agent completes, verify its output file exists and has substantive content (> 0 bytes). If research fails: skip to planner but log a warning. If planner fails: stop pipeline. If checker finds issues: optionally loop back to planner (revision mode).

**Warning signs:** Pipeline reports success even when intermediate steps failed.

### Pitfall 4: Config Toggle Not Respected

**What goes wrong:** Plan-phase always runs research, even when `workflow.research: false` in config.json. Or it always runs plan-checker when `workflow.plan_check: false`.

**Why it happens:** Config values not read or not checked before spawning agents.

**How to avoid:** Read config at pipeline start. Gate each agent spawn on its respective config toggle. Test with both `true` and `false` values.

**Warning signs:** Config changes have no effect on pipeline behavior.

### Pitfall 5: Phase Directory Naming Inconsistency

**What goes wrong:** discuss-phase creates `.planning/phases/06-planning-workflow/` but plan-phase looks for `.planning/phases/6-planning/` (different slug or padding).

**Why it happens:** Different workflows compute the directory name differently.

**How to avoid:** Always use `ensurePhaseDir()` which produces a canonical name. Use `ls -d .planning/phases/06-*` glob pattern to find the directory regardless of slug. Both discuss-phase and plan-phase should use the same directory-finding logic.

**Warning signs:** Phase directory already exists but workflow creates a second one with different name.

### Pitfall 6: CONTEXT.md File Naming Convention

**What goes wrong:** Discuss-phase writes `CONTEXT.md` but plan-phase looks for `06-CONTEXT.md` (or vice versa).

**Why it happens:** Inconsistent naming convention between workflows.

**How to avoid:** The established convention from Phase 5 is `{padded_phase}-{TYPE}.md` (e.g., `06-RESEARCH.md`). CONTEXT.md should follow: `06-CONTEXT.md`. Both workflows must agree on this. The agent definitions reference `*-CONTEXT.md` glob patterns, so the prefix is expected.

**Warning signs:** One workflow finds the file and the other doesn't.

## Code Examples

### Example 1: Discuss-Phase Helper Module

```javascript
// src/discuss-phase.js
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { readRoadmap } from './state-read.js';
import { ensurePhaseDir } from './state-init.js';

/**
 * Get phase details from ROADMAP.md for discussion context.
 */
export async function getPhaseDetails(planningDir, phaseNum) {
  const roadmapResult = await readRoadmap(planningDir);
  if (!roadmapResult.success) {
    return { success: false, error: roadmapResult.error };
  }

  // Parse the phase section from ROADMAP.md raw content
  const raw = roadmapResult.data.raw;
  const phaseRegex = new RegExp(
    `### Phase ${phaseNum}:(.+?)\\n([\\s\\S]*?)(?=### Phase \\d|## Progress|$)`
  );
  const match = raw.match(phaseRegex);
  if (!match) {
    return { success: false, error: `Phase ${phaseNum} not found in ROADMAP.md` };
  }

  return {
    success: true,
    data: {
      name: match[1].trim(),
      details: match[2].trim(),
    },
  };
}

/**
 * Get the canonical phase directory path, creating it if needed.
 */
export async function getOrCreatePhaseDir(planningDir, phaseNum, phaseName) {
  return ensurePhaseDir(planningDir, phaseNum, phaseName);
}
```

### Example 2: Plan-Phase Orchestration Module

```javascript
// src/plan-phase.js
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { spawnAgent, waitForAgents } from './agent-spawn.js';
import { verifyOutputs, reportResults } from './agent-collect.js';
import { readPlanningConfig } from './state-read.js';

/**
 * Build the prompt for the researcher agent.
 */
export function buildResearchPrompt(phaseNum, phaseName, phaseDetails, contextContent) {
  const paddedPhase = String(phaseNum).padStart(2, '0');
  const contextSection = contextContent
    ? `\n\nCONTEXT.md content:\n${contextContent}`
    : '\n\nNo CONTEXT.md exists. All areas are at Claude\'s discretion.';

  return `You are a GSD phase researcher.

Read the agent definition at agents/gsd-phase-researcher.md and follow all instructions.

Phase: ${phaseNum} - ${phaseName}
Phase details from ROADMAP.md:
${phaseDetails}
${contextSection}

Write your research output to: .planning/phases/${paddedPhase}-*/06-RESEARCH.md`;
}

/**
 * Build the prompt for the planner agent.
 */
export function buildPlannerPrompt(phaseNum, phaseName, phaseDetails, contextContent, researchExists) {
  const paddedPhase = String(phaseNum).padStart(2, '0');
  const contextSection = contextContent
    ? `\n\n<user_decisions>\n${contextContent}\n</user_decisions>`
    : '';
  const researchNote = researchExists
    ? `\n\nResearch file exists at .planning/phases/${paddedPhase}-*/06-RESEARCH.md — read it before planning.`
    : '';

  return `You are a GSD planner.

Read the agent definition at agents/gsd-planner.md and follow all instructions.

Phase: ${phaseNum} - ${phaseName}
Phase details from ROADMAP.md:
${phaseDetails}
${contextSection}${researchNote}

Write PLAN.md files to: .planning/phases/${paddedPhase}-*/`;
}

/**
 * Build the prompt for the plan-checker agent.
 */
export function buildCheckerPrompt(phaseNum, phaseName, contextContent) {
  const paddedPhase = String(phaseNum).padStart(2, '0');
  const contextSection = contextContent
    ? `\n\n<context_md>\n${contextContent}\n</context_md>`
    : '';

  return `You are a GSD plan checker.

Read the agent definition at agents/gsd-plan-checker.md and follow all instructions.

Phase: ${phaseNum} - ${phaseName}
${contextSection}

Check all PLAN.md files in .planning/phases/${paddedPhase}-*/ and write your verdict to .planning/phases/${paddedPhase}-*/06-CHECK.md`;
}

/**
 * Run the full planning pipeline: research -> plan -> check.
 */
export async function runPlanningPipeline(projectRoot, phaseNum, phaseName, options = {}) {
  const planningDir = path.join(projectRoot, '.planning');
  const config = options.config || (await readPlanningConfig(planningDir)).data;
  const timeout = options.timeout || 600000; // 10 min per agent

  const paddedPhase = String(phaseNum).padStart(2, '0');
  const results = { research: null, planning: null, checking: null };

  // Step 1: Research (if enabled)
  if (config.workflow.research) {
    // spawn researcher, wait, verify
  }

  // Step 2: Planning (always)
  // spawn planner, wait, verify

  // Step 3: Checking (if enabled)
  if (config.workflow.plan_check) {
    // spawn checker, wait, verify
  }

  return { success: true, data: results };
}
```

### Example 3: Workflow File Pattern (gsd-discuss-phase.md)

```markdown
---
description: Gather context and decisions before planning a phase
---

# /gsd-discuss-phase.md - Discuss Phase Before Planning

## Step 1: Parse phase number
Extract the phase number from the user's command...

## Step 2: Load phase details from ROADMAP.md
```bash
node -e "
import { getPhaseDetails } from './src/discuss-phase.js';
const result = await getPhaseDetails('.planning', PHASE_NUM);
console.log(JSON.stringify(result));
"
```

## Step 3: Interactive discussion
Ask targeted questions about the phase...

## Step 4: Write CONTEXT.md
Write the structured CONTEXT.md file with Decisions, Claude's Discretion, and Deferred Ideas...
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline agent instructions in prompts | Reference agent definition files | Phase 5 (established pattern) | Agents are self-contained, reusable, versioned |
| Single workflow for all planning steps | Split discuss + plan workflows | Upstream GSD design | Separation of concerns, optional discuss step |
| Hardcoded model selection | Config-driven model_profile | Project inception | Future-proofs for per-agent model selection |

**Deprecated/outdated:**
- None applicable. This is internal architecture following established patterns.

## Key Design Decisions for Planning

### 1. discuss-phase is Purely Interactive (No Agents)

Discuss-phase is a conversation between Cline and the user. It does NOT spawn any agents. The output is a CONTEXT.md file written by Cline's Write tool during the conversation. This keeps the command fast and focused.

**Confidence: HIGH** -- This matches the upstream GSD pattern where discuss-phase is conversational.

### 2. plan-phase Pipeline is Sequential, Not Parallel

The pipeline is: research -> plan -> check. Each step depends on the previous output. Research produces RESEARCH.md that the planner reads. The planner produces PLAN.md files that the checker reads. These cannot be parallelized.

**Confidence: HIGH** -- This is a fundamental data dependency, not a design choice.

### 3. Model Orchestration is Advisory, Not Enforced

The `model_profile` config and `AGT-06` requirement for "cheap models for research, quality for planning" is a hint system. Cline's `cline -y` command uses whatever model is globally configured. The workflow can log which model *should* be used, but cannot enforce it at the CLI level.

**Approach:** The workflow tells the user which model tier is recommended for each step. If Cline CLI gains per-invocation model selection in the future, the module can pass model hints. For now, model orchestration is documentation/logging only.

**Confidence: MEDIUM** -- This satisfies the requirement's intent (awareness of model cost optimization) without requiring Cline CLI features that may not exist.

### 4. CONTEXT.md Has a Fixed, Minimal Schema

The CONTEXT.md file has exactly three sections: `## Decisions`, `## Claude's Discretion`, `## Deferred Ideas`. This matches what the agent definitions expect. Adding extra sections would break the agent parsing.

**Confidence: HIGH** -- All three agent definitions (researcher, planner, checker) reference these exact section names.

### 5. Plan Checker Output Goes to a CHECK.md File

The plan checker's verdict is written to `06-CHECK.md` in the phase directory. The plan-phase workflow reads this file to determine if plans need revision. If the checker reports issues, the workflow can optionally spawn the planner in revision mode.

**Confidence: MEDIUM** -- The exact file naming is a design choice. Using `{padded}-CHECK.md` follows the established `{padded}-RESEARCH.md` pattern.

### 6. No Revision Loop in v1

The initial implementation will NOT automatically loop planner -> checker -> planner. If the checker finds issues, the workflow reports them and lets the user decide whether to re-run `/gsd-plan-phase`. This keeps the implementation simpler and avoids infinite loops.

**Confidence: HIGH** -- Matches the "ship fast" philosophy. Revision loops can be added later.

## Open Questions

1. **Cline CLI model selection flag**
   - What we know: `cline -y "prompt"` runs with the globally configured model.
   - What's unclear: Whether Cline CLI supports `--model` or similar per-invocation flags.
   - Recommendation: Implement model orchestration as logging/advisory. If a flag exists or is added, the module can be trivially updated to use it.

2. **Phase number parsing in workflow**
   - What we know: Users invoke `/gsd-discuss-phase 6` or `/gsd-plan-phase 6`. The workflow must extract "6".
   - What's unclear: How Cline passes arguments to workflows. The existing workflows (map-codebase, new-project) don't take arguments.
   - Recommendation: The workflow should ask for the phase number at the start if not provided. This matches the interactive pattern of existing workflows. Alternatively, parse it from the user's natural language input.

3. **Agent timeout for planner**
   - What we know: Mappers in Phase 5 use 5-minute timeout. Research agents may need similar time. Planner agents may need more (they write multiple PLAN.md files).
   - What's unclear: Optimal timeout values.
   - Recommendation: Use 10-minute default timeout for all agents in the planning pipeline. Make it configurable.

## Sources

### Primary (HIGH confidence)
- **Existing codebase** (`src/agent-spawn.js`, `src/agent-collect.js`, `src/state-read.js`, `src/state-write.js`, `src/state-init.js`, `src/map-codebase.js`) -- verified by reading actual source code
- **Existing workflows** (`gsd-map-codebase.md`, `gsd-new-project.md`, `gsd-progress.md`) -- verified by reading actual workflow files
- **Agent definitions** (`agents/gsd-phase-researcher.md`, `agents/gsd-planner.md`, `agents/gsd-plan-checker.md`) -- verified by reading actual agent files
- **Config schema** (`readPlanningConfig` defaults in `state-read.js` and `project-init.js`) -- verified by reading actual source code

### Secondary (MEDIUM confidence)
- **Upstream GSD patterns** -- inferred from agent definition references to `/gsd:discuss-phase` and `/gsd:plan-phase` formats in agent files

### Tertiary (LOW confidence)
- **Cline CLI model selection** -- no verification possible without testing actual Cline CLI flags

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new dependencies; all modules already exist and were verified by reading source
- Architecture: HIGH -- Follows established patterns from Phase 5 (workflow + module separation, agent spawning, output verification)
- Pitfalls: HIGH -- Derived from actual codebase patterns and known file-path/naming issues observed in prior phases
- Model orchestration: MEDIUM -- Advisory approach satisfies requirement intent, but enforcement depends on Cline CLI capabilities

**Research date:** 2026-02-05
**Valid until:** 2026-03-07 (30 days -- stable internal architecture, no external dependency changes expected)
