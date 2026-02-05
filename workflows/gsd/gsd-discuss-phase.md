---
description: Gather context and decisions before planning a phase
---

# /gsd-discuss-phase.md - Discuss Phase Before Planning

You are gathering context and decisions before creating plans for a phase. This is an interactive discussion -- no agents are spawned. Your goal is to produce a structured CONTEXT.md file that constrains all downstream planning (researcher, planner, and checker agents all parse this file).

## Step 1: Parse phase number

Extract the phase number from the user's input. If not provided or unclear, load the roadmap and present available phases:

```bash
node -e "
import { readRoadmap } from './src/state-read.js';
const result = await readRoadmap('.planning');
if (result.success) {
  const lines = result.data.raw.split('\n').filter(l => /^- \[.\] \*\*Phase \d+/.test(l));
  lines.forEach(l => console.log(l));
} else {
  console.log('ERROR: ' + result.error);
}
"
```

Ask: "Which phase would you like to discuss?" and wait for the user to select one.

## Step 2: Load phase details

Load the phase goal, requirements, and success criteria from ROADMAP.md:

```bash
node -e "
import { getPhaseDetails } from './src/discuss-phase.js';
const result = await getPhaseDetails('.planning', PHASE_NUM);
if (result.success) {
  console.log('Phase: ' + result.data.name);
  console.log(result.data.details);
} else {
  console.log('ERROR: ' + result.error);
}
"
```

Replace `PHASE_NUM` with the actual phase number.

If the call fails, stop with the error. If it succeeds, display the phase goal, requirements, and success criteria to frame the discussion.

## Step 3: Check for existing CONTEXT.md

Check whether a CONTEXT.md already exists for this phase:

```bash
ls .planning/phases/PADDED_PHASE-*/*-CONTEXT.md 2>/dev/null
```

Replace `PADDED_PHASE` with the zero-padded phase number (e.g., `06`).

If a CONTEXT.md exists, inform the user:

> A CONTEXT.md already exists for this phase. Options:
> 1. **Overwrite** -- start fresh discussion
> 2. **Keep** -- use existing context

If the user chooses to keep, stop and suggest `/gsd-plan-phase N` as the next step. If overwrite, continue.

## Step 4: Ensure phase directory exists

Create the phase directory if it does not already exist:

```bash
node -e "
import { getOrCreatePhaseDir } from './src/discuss-phase.js';
const result = await getOrCreatePhaseDir('.planning', PHASE_NUM, 'PHASE_NAME');
console.log(JSON.stringify(result));
"
```

Replace `PHASE_NUM` and `PHASE_NAME` with actual values from Step 2. This creates `.planning/phases/NN-phase-name/` if it does not exist.

## Step 5: Interactive discussion

Present the phase goal and ask targeted questions. Do not present these as a numbered form -- weave them into a natural conversation:

- **"What key decisions have you already made for this phase?"** -- technology choices, approach, constraints, non-negotiables
- **"Are there areas where you'd like me to use my judgment?"** -- implementation details, naming conventions, internal structure, library choices
- **"Is there anything explicitly out of scope for this phase?"** -- features to defer, ideas for later, things to avoid

Follow the user's energy. Dig into what they emphasize. Challenge vague answers with concrete alternatives: "When you say 'simple auth', do you mean session cookies or JWT tokens?"

This typically takes 2-4 exchanges. When you have enough context, summarize what you gathered and offer to proceed: "I think I have a clear picture. Ready to create the CONTEXT.md?"

## Step 6: Write CONTEXT.md

Using the gathered context, write the CONTEXT.md file. The file MUST use these exact section headers:

- `## Decisions` -- user decisions as bullet points
- `## Claude's Discretion` -- areas where Claude can decide freely
- `## Deferred Ideas` -- ideas explicitly deferred to later phases

File location: `.planning/phases/NN-phase-name/NN-CONTEXT.md` (e.g., `.planning/phases/06-planning-workflow/06-CONTEXT.md`).

Write the file with the Write tool. Example structure:

```markdown
# Phase 6: Planning Workflow - Context

**Discussed:** 2026-02-05

## Decisions
- Research agents use the "speed" model profile for cost efficiency
- Plan checker is mandatory (cannot be skipped via config)
- CONTEXT.md must exist before plan-phase will proceed

## Claude's Discretion
- Internal module structure and function naming
- How research results are formatted and stored
- Error message wording

## Deferred Ideas
- Plan versioning (track multiple revisions of a plan) -- Phase 8
- AI-powered plan review beyond structural checks -- Phase 8
```

## Step 7: Commit and suggest next step

If `commit_docs` is true in config:

```bash
git add .planning/phases/PADDED_PHASE-*/*-CONTEXT.md && git commit -m "docs(PHASE_NUM): gather context via /gsd-discuss-phase"
```

Replace `PADDED_PHASE` and `PHASE_NUM` with actual values.

If `commit_docs` is false, skip with a note:

> Skipping git commit (commit_docs: false in config).

Suggest the next step: "Context gathered! Run `/gsd-plan-phase N` to create plans for this phase."

## Behavioral Guidelines

- **Be a thinking partner, not a questionnaire.** Follow-up questions should build on previous answers, not jump to new topics.
- **Follow energy.** Whatever the user emphasizes, dig deeper into that.
- **Challenge vagueness.** "Fast" means what exactly? "Simple" compared to what?
- **This is purely interactive.** No agents are spawned. This is a conversation between you and the user.
- **CONTEXT.md section headers are sacred.** Use exactly `## Decisions`, `## Claude's Discretion`, `## Deferred Ideas`. Downstream agents parse these headers.
- **Keep the discussion focused on the specific phase.** Do not wander into whole-project scope.
- **Never ask the user to create files.** Always write files yourself using the Write tool.
- **Handle errors clearly.** If any step fails, report the error and suggest how to fix it.
