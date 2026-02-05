---
description: Analyze existing codebase with parallel mapper agents
---

# /gsd-map-codebase.md - Map Existing Codebase

You are mapping an existing codebase to produce structured documentation that downstream GSD commands will use for planning and execution. This spawns parallel mapper agents, each analyzing a different aspect of the codebase.

## Step 1: Check for existing codebase map

```bash
ls .planning/codebase/*.md 2>/dev/null | wc -l
```

If files exist, inform the user:

> A codebase map already exists with N documents. Options:
> 1. **Refresh** -- delete and re-map from scratch
> 2. **Skip** -- keep existing map

If user says refresh:

```bash
rm -rf .planning/codebase && mkdir -p .planning/codebase
```

If user says skip: stop and suggest `/gsd-progress.md` to check project status.

If no existing map: continue to Step 2.

## Step 2: Verify prerequisites

Check that the planning directory exists:

```bash
test -d .planning && echo "exists" || echo "missing"
```

If missing, create it:

```bash
mkdir -p .planning .planning/phases
```

Check that the mapper agent definition exists:

```bash
test -f agents/gsd-codebase-mapper.md && echo "exists" || echo "missing"
```

If the agent file is missing, stop with this error:

> The mapper agent definition is missing. Ensure you have the full cline-gsd installation. Re-run `npx cline-gsd` to reinstall.

Create the output directory:

```bash
mkdir -p .planning/codebase
```

## Step 3: Read configuration

Read config for parallelization and commit_docs settings:

```bash
node -e "
import { readPlanningConfig } from './src/state-read.js';
const result = await readPlanningConfig('.planning');
console.log(JSON.stringify({ parallel: result.data.parallelization, commit_docs: result.data.commit_docs }));
"
```

Store the `parallel` and `commit_docs` values for use in subsequent steps. If config read fails, default to `parallel: true` and `commit_docs: true`.

## Step 4: Spawn mapper agents

Inform the user that 4 mapper agents are being spawned:

- **Agent 1 (tech):** Analyzing technology stack and integrations
- **Agent 2 (arch):** Analyzing architecture and structure
- **Agent 3 (quality):** Analyzing conventions and testing
- **Agent 4 (concerns):** Analyzing tech debt and concerns

Note: This step may take 2-5 minutes depending on codebase size.

Run the mapping pipeline:

```bash
node -e "
import { runMapping } from './src/map-codebase.js';
const result = await runMapping(process.cwd(), { parallel: PARALLEL_VALUE });
console.log(JSON.stringify(result, null, 2));
"
```

Replace `PARALLEL_VALUE` with the value from Step 3 (`true` or `false`).

## Step 5: Verify results

Check the output from `runMapping`:

- If `success: true` and all 7 files found: proceed to Step 6.
- If `success: true` but some files missing: report which files were produced and which are missing. Ask: "N of 7 documents were produced. Would you like to re-run the failed mappers or continue with partial results?"
- If `success: false`: report the error and suggest re-running `/gsd-map-codebase.md`.

For each produced file, verify it has substantive content:

```bash
for f in .planning/codebase/*.md; do
  lines=$(wc -l < "$f" 2>/dev/null || echo 0)
  name=$(basename "$f")
  if [ "$lines" -gt 20 ]; then
    echo "OK: $name ($lines lines)"
  else
    echo "WARN: $name only has $lines lines (may be incomplete)"
  fi
done
```

## Step 6: Commit codebase map

Only if `commit_docs` is `true` (from Step 3):

```bash
git add .planning/codebase/*.md && git commit -m "docs: map existing codebase via /gsd-map-codebase"
```

If `commit_docs` is `false`, skip with a note:

> Skipping git commit (commit_docs: false in config).

## Step 7: Present results and next steps

Show a summary table of documents produced:

| Document | Lines | Status |
|----------|-------|--------|
| STACK.md | N | OK |
| INTEGRATIONS.md | N | OK |
| ARCHITECTURE.md | N | OK |
| STRUCTURE.md | N | OK |
| CONVENTIONS.md | N | OK |
| TESTING.md | N | OK |
| CONCERNS.md | N | OK |

Suggest next steps:

- Run `/gsd-new-project.md` to set up project planning (if not already done)
- Run `/gsd-progress.md` to check project status and continue

## Behavioral Guidelines

- **Inform on spawn.** Tell the user agents are spawning and may take a few minutes.
- **Handle partial failures.** Partial results are better than no results. Report what succeeded.
- **Do not read produced documents.** They are for downstream commands, not for display here.
- **Keep it concise.** The orchestration module does the heavy lifting.
- **Never ask the user to run commands.** Always execute commands yourself.
