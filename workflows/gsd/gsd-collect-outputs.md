---
description: Documents how to verify and collect agent outputs after spawning
---

# Collect Agent Outputs

This workflow documents how to verify and collect agent outputs after spawning CLI subagents.

## Overview

After agents complete (via `waitForAgents`), the orchestrator needs to:
1. Verify output files exist before reading
2. Collect content from existing files
3. Report results for synthesis

## Verification Pattern

Before reading output files, verify they exist:

```bash
for file in .planning/codebase/*.md; do
  if [ -f "$file" ]; then
    lines=$(wc -l < "$file")
    echo "OK: $file ($lines lines)"
  else
    echo "MISSING: $file"
  fi
done
```

### Using the Collection Module

```javascript
import { verifyOutputs, collectOutputs, reportResults } from './src/agent-collect.js';

// Verify expected outputs exist
const verifications = await verifyOutputs([
  '.planning/codebase/STACK.md',
  '.planning/codebase/ARCHITECTURE.md',
  '.planning/codebase/CONVENTIONS.md'
]);

// Generate summary report
const { total, found, missing, report } = reportResults(verifications);
console.log(report);

// Collect content from existing files
const existing = verifications.filter(v => v.exists).map(v => v.path);
const outputs = await collectOutputs(existing);
```

## Expected Output Locations

Agent outputs follow the upstream GSD pattern:

```
.planning/
├── codebase/           # Codebase mapping outputs
│   ├── STACK.md        # Technology stack analysis
│   ├── ARCHITECTURE.md # Project architecture overview
│   ├── STRUCTURE.md    # Directory structure documentation
│   ├── CONVENTIONS.md  # Code conventions and patterns
│   └── CONCERNS.md     # Technical debt and concerns
├── research/           # Research agent outputs
│   ├── ECOSYSTEM.md    # Ecosystem/library research
│   └── FEASIBILITY.md  # Feasibility studies
└── phases/
    └── XX-name/        # Phase-specific outputs
        └── XX-RESEARCH.md   # Phase research documents
```

## Error Handling

When outputs are missing or incomplete:

### 1. Check Agent Exit Codes

Use the results from `waitForAgents`:

```javascript
const results = await waitForAgents(agents);

const failures = results.filter(r => !r.success);
if (failures.length > 0) {
  console.error(`${failures.length} agents failed:`);
  failures.forEach(f => {
    console.error(`  PID ${f.pid}: exit code ${f.exitCode}`);
  });
}
```

### 2. Verify vs Collect Pattern

Always verify before collecting:

```javascript
// Verify first
const verifications = await verifyOutputs(expectedFiles);
const { missing } = reportResults(verifications);

if (missing > 0) {
  // Handle missing outputs
  console.warn(`${missing} outputs missing`);
}

// Only collect existing files
const existingPaths = verifications
  .filter(v => v.exists)
  .map(v => v.path);

const outputs = await collectOutputs(existingPaths);
```

### 3. Recovery Options

When agents fail or outputs are missing:

- **Re-run failed agents:** Spawn again with same prompt
- **Proceed with partial results:** If some outputs are optional
- **Manual intervention:** If agent repeatedly fails

## Synthesis Pattern

After collecting outputs, the orchestrator synthesizes results:

```javascript
// Example: Aggregate codebase mapping outputs
const outputs = await collectOutputs([
  '.planning/codebase/STACK.md',
  '.planning/codebase/ARCHITECTURE.md',
  '.planning/codebase/CONVENTIONS.md'
]);

// Filter to successful reads
const valid = outputs.filter(o => o.content !== null);

// Build combined context
const context = valid
  .map(o => `## ${o.path}\n\n${o.content}`)
  .join('\n\n---\n\n');

// Use in downstream prompts or planning
```

## Workflow Integration

This collection pattern is used by:

- **gsd-map-codebase:** Spawns mapping agents, collects STACK/ARCHITECTURE/etc
- **gsd-research:** Spawns research agents, collects ECOSYSTEM/FEASIBILITY
- **gsd-plan-phase:** Uses collected outputs as context for planning

## API Reference

### verifyOutputs(files)

Verifies expected output files exist.

**Parameters:**
- `files`: Array of file paths (strings)

**Returns:** `Promise<Array<{path, exists, lines, bytes}>>`

### collectOutputs(files)

Reads content from output files.

**Parameters:**
- `files`: Array of file paths

**Returns:** `Promise<Array<{path, content, error}>>`
- `content` is `null` if file doesn't exist or can't be read
- `error` contains the error message if read failed

### reportResults(verifications)

Generates a summary report.

**Parameters:**
- `verifications`: Array from `verifyOutputs`

**Returns:** `{total, found, missing, report}`
- `report` is a formatted string for display
