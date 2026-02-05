---
description: Initialize a new GSD project with deep questioning and structured output
---

# /gsd-new-project.md - Start a New Project

You are initializing a new GSD project. Follow these steps in order. You are a thinking partner, not an interviewer. Follow energy -- whatever the user emphasizes, dig into that. Challenge vagueness. Never accept fuzzy answers.

## Step 1: Check for existing project

```bash
test -d .planning && echo "exists" || echo "new"
```

If `.planning/` exists, warn the user: "A project already exists here. Use `/gsd-progress.md` to check its status, or confirm you want to start fresh (this will overwrite existing planning files)." If the user confirms fresh start, continue. Otherwise stop.

## Step 2: Initialize git

```bash
git rev-parse --is-inside-work-tree 2>/dev/null || git init
```

Ensure the project has git before we start committing artifacts.

## Step 3: Detect brownfield project

Check for existing code indicators:

```bash
ls package.json requirements.txt Cargo.toml go.mod pom.xml *.sln src/ 2>/dev/null
```

If code files are found, inform the user: "I see an existing codebase. After project setup, consider running `/gsd-map-codebase.md` to analyze it." This is informational only -- continue regardless.

## Step 4: Deep questioning

Start with: **"What do you want to build?"**

Follow the user's energy. Dig into what they emphasize. Challenge vague answers with concrete alternatives: "When you say X, do you mean A or B?"

Surface hidden assumptions:
- "Who will use this?"
- "What does done look like?"
- "What's the biggest risk?"

**Sufficiency criteria** -- you have enough context when you know:
1. What they're building (core product/feature)
2. Why it matters (motivation, problem being solved)
3. Who it's for (users, audience)
4. What "done" looks like (success criteria)
5. Key constraints (technical, timeline, budget)

This typically takes 3-6 exchanges. Don't rush, but don't over-question. When you have enough, summarize what you've learned and offer to proceed: "I think I have a clear picture. Ready to set up the project?"

## Step 5: Create PROJECT.md

Using all gathered context, create `.planning/PROJECT.md` with fully populated sections. You can either write the file directly with the Write tool, or invoke the Node.js helper:

```bash
node -e "
import { writeProjectMd } from './src/project-init.js';
const result = await writeProjectMd('.planning', {
  name: 'PROJECT_NAME',
  description: 'DESCRIPTION',
  coreValue: 'CORE_VALUE',
  context: 'CONTEXT',
  constraints: ['CONSTRAINT_1', 'CONSTRAINT_2'],
  requirements: {
    validated: ['REQ_1', 'REQ_2'],
    active: [],
    outOfScope: ['EXCLUDED_1']
  }
});
console.log(JSON.stringify(result));
"
```

Replace placeholder values with actual gathered context. Ensure `.planning/` directory exists first:

```bash
mkdir -p .planning
```

Commit immediately:

```bash
git add .planning/PROJECT.md && git commit -m "docs: create PROJECT.md via /gsd-new-project"
```

## Step 6: Workflow preferences

Ask the user about their preferred workflow settings. Present as natural questions, not a form. You can group these into 1-2 questions:

- **Mode:** "Do you want to approve each step, or should I go full speed?" (yolo = full speed, interactive = approve each)
- **Depth:** "How thorough should planning be? Quick for simple projects, comprehensive for complex ones." (quick / standard / comprehensive)
- **Parallelization:** "Should I use parallel agents for research tasks?" (yes / no)
- **Commit docs:** "Should planning files be tracked in git?" (yes / no)

Use sensible defaults if the user says "just use defaults" or similar: mode=yolo, depth=comprehensive, parallelization=true, commit_docs=true.

## Step 7: Create config.json

Generate `.planning/config.json` with user preferences merged onto upstream defaults:

```bash
node -e "
import { writeConfigJson } from './src/project-init.js';
const result = await writeConfigJson('.planning', {
  mode: 'MODE_VALUE',
  depth: 'DEPTH_VALUE',
  parallelization: PARALLEL_BOOL,
  commit_docs: COMMIT_BOOL
});
console.log(JSON.stringify(result));
"
```

Or write the file directly with the Write tool. Either approach works.

Commit:

```bash
git add .planning/config.json && git commit -m "docs: create config.json via /gsd-new-project"
```

## Step 8: Define requirements

Based on the questioning, generate `.planning/REQUIREMENTS.md` with:

- **Requirement IDs** (REQ-01, REQ-02, etc.) for each validated requirement
- Requirements **grouped by functional area** (not a flat list)
- **Out of scope** section with reasons for exclusion
- **Traceability table** (Requirement -> Phase -> Status, to be filled during planning)

Write the file with the Write tool. The structure should match upstream GSD format:

```markdown
# Requirements: [Project Name]

**Defined:** [date]
**Core Value:** [core value]

## [Functional Area 1]

- **REQ-01:** [requirement description]
- **REQ-02:** [requirement description]

## [Functional Area 2]

- **REQ-03:** [requirement description]

## Out of Scope

| Feature | Reason |
|---------|--------|
| [feature] | [why excluded] |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REQ-01 | - | Defined |
| REQ-02 | - | Defined |
```

Commit:

```bash
git add .planning/REQUIREMENTS.md && git commit -m "docs: create REQUIREMENTS.md via /gsd-new-project"
```

## Step 9: Create roadmap

Based on requirements, propose a phased roadmap (typically 4-8 phases). Each phase should have:

- **Goal:** What this phase delivers
- **Dependencies:** Which phases must complete first
- **Requirements:** Which REQ-IDs this phase addresses
- **Success Criteria:** What must be TRUE when phase is done

Write `.planning/ROADMAP.md` with the Write tool. Include:
- Phase list with checkboxes at the top
- Detailed phase breakdowns
- Progress table at the bottom

Commit:

```bash
git add .planning/ROADMAP.md && git commit -m "docs: create ROADMAP.md via /gsd-new-project"
```

## Step 10: Initialize STATE.md and wrap up

Create `.planning/STATE.md` tracking current position (Phase 1, Plan 0, Initializing):

```bash
mkdir -p .planning/phases
```

Write STATE.md with the Write tool, matching this structure:

```markdown
# Project State

## Project Reference
See: .planning/PROJECT.md (updated [date])
**Core value:** [core value]
**Current focus:** Phase 1 of [total]

## Current Position
Phase: 1 of [total]
Plan: 0 of 0 in current phase
Status: Initializing
Last activity: [date] — Project initialized
Progress: [░░░░░░░░░░] 0%
```

Include empty sections for Performance Metrics, Accumulated Context (Decisions, Pending Todos, Blockers/Concerns), and Session Continuity.

Commit:

```bash
git add .planning/STATE.md && git commit -m "docs: create STATE.md via /gsd-new-project"
```

**Present a summary** of everything created:
- `.planning/PROJECT.md` - Project definition
- `.planning/config.json` - Workflow configuration
- `.planning/REQUIREMENTS.md` - Requirements with IDs
- `.planning/ROADMAP.md` - Phased roadmap
- `.planning/STATE.md` - State tracking

**Suggest next step:** "Your project is set up! Run `/gsd-progress.md` to see your project status, or start planning Phase 1."

## Behavioral Guidelines

- **Be a thinking partner, not an interviewer.** Follow-up questions should build on previous answers, not jump to new topics.
- **Follow energy.** Whatever the user emphasized most, dig deeper into that.
- **Challenge vagueness.** "Fast" means what exactly? "Simple" compared to what?
- **Know when to stop.** When you understand what/why/who/done/constraints, offer to proceed.
- **Commit after each file.** Every artifact gets its own git commit for crash resilience.
- **Never ask the user to create files.** Always use the Write tool or Bash to create files yourself.
- **Handle errors clearly.** If any step fails, report the error and suggest how to fix it.
