# Cline-GSD

## What This Is

A port of the Get Shit Done (GSD) framework to work with Cline instead of Claude Code. Cline-GSD brings the same spec-driven development workflow — deep questioning, research, requirements, roadmaps, planning, and execution — to Cline users. It tracks upstream GSD while adapting the architecture to use Cline's CLI subagents for parallel execution.

## Core Value

Enable Cline users to build complex projects with the same structured, spec-driven workflow that GSD provides for Claude Code — without context rot, with atomic commits, and with clear project state tracking.

## Requirements

### Validated

<!-- Existing GSD capabilities being ported -->

- ✓ Deep questioning methodology for project initialization — existing
- ✓ PROJECT.md, REQUIREMENTS.md, ROADMAP.md templates — existing
- ✓ STATE.md for project memory across sessions — existing
- ✓ Phase-based roadmap structure — existing
- ✓ PLAN.md atomic task breakdown — existing
- ✓ Atomic git commits per task — existing
- ✓ Research agents for domain exploration — existing
- ✓ Codebase mapping for brownfield projects — existing

### Active

<!-- New work required for Cline adaptation -->

- [ ] Adapt agent spawning to use `cline "prompt" &` CLI pattern
- [ ] Convert GSD commands to Cline workflows (`.clinerules/workflows/`)
- [ ] Adapt `@file` context loading to Cline's `@` mention syntax
- [ ] Create npx installer that sets up Cline-GSD in user's config
- [ ] Ensure parallel CLI agents write to files (not stdout)
- [ ] Handle execution in main context (agents are read-only)
- [ ] Test full workflow end-to-end in Cline
- [ ] Write installation and usage documentation

### Out of Scope

- Modifying Cline core — we adapt to Cline's existing capabilities
- Waiting for `bee/subagents` branch — use CLI subagents now
- VS Code extension integration — CLI-only, requires `cline` command
- Supporting agents that edit code — Cline CLI agents are read-only

## Context

**Why this exists:** User is sponsored by Cline but loves the GSD workflow. Needs to use Cline but doesn't want to lose the structured development methodology.

**Technical discovery:** Cline CLI 2.0 supports parallel agent execution via bash background jobs (`cline -y "prompt" &` + `wait`). The `-y` flag enables headless/non-interactive mode. This makes a near-direct port possible.

**Key architectural difference:**
- Claude Code: `Task` tool spawns in-process agents with shared context
- Cline: `cline "prompt" &` spawns separate CLI processes that write to files

**Cline's internal subagent system** (`bee/subagents` branch) is in development but not merged. We're not waiting for it — CLI subagents work now.

**Reference codebase:** The Cline source at `../cline/` provides implementation details for slash commands, workflows, and CLI subagent patterns.

## Constraints

- **Cline CLI 2.0 required**: Users must have `cline` command installed (not just VS Code extension)
- **Track upstream**: Must be able to pull improvements from `glittercowboy/get-shit-done`
- **CLI subagent limitation**: Agents can research and write docs, but cannot edit code files
- **Cline workflow system**: Simpler than Claude Code skills — workflows inject prompts, don't orchestrate
- **Public release**: Needs documentation and polish for Cline community

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use CLI subagents, not wait for internal subagents | CLI subagents work now, internal not merged | — Pending |
| Execution in main context | CLI agents are read-only, can't edit code | — Pending |
| npx installation | Consistent with upstream GSD, familiar pattern | — Pending |
| Track upstream GSD | Benefit from improvements, maintain compatibility | — Pending |

---
*Last updated: 2026-02-05 after initialization*
