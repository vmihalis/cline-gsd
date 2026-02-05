# Phase 2: Agent Infrastructure - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable the main Cline context to spawn parallel CLI subagents that write results to files, then collect those outputs. This is the foundation for parallel research, mapping, and other multi-agent workflows.

</domain>

<decisions>
## Implementation Decisions

### Output Strategy
- Follow upstream GSD patterns exactly
- Agents write to `.planning/` subdirectories based on purpose (`.planning/research/`, `.planning/codebase/`, `.planning/phases/XX-name/`)
- Files named by content type (`STACK.md`, `RESEARCH.md`), not timestamps
- No auto-cleanup — files are project artifacts, overwritten when re-run
- Orchestrator reads from known paths after completion

### Spawn/Wait Mechanism
- Adapt for Cline CLI: use `cline "prompt" &` instead of Claude Code's Task tool
- Use shell `wait` on PIDs for completion detection
- Agents return confirmation to stdout, write actual output to files

### Cross-Platform
- Must work on Mac, Linux, Windows
- Implementation details at Claude's discretion

### Claude's Discretion
- Specific shell commands for spawning and waiting
- How to handle Cline CLI differences across platforms
- Error handling when agents fail, timeout, or produce invalid output
- Any wrapper scripts or helpers needed for reliability

</decisions>

<specifics>
## Specific Ideas

- "Follow what get shit done does and only make changes that are absolutely necessary for Cline"
- Reference upstream GSD patterns in `glittercowboy/get-shit-done` repository

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-agent-infrastructure*
*Context gathered: 2026-02-05*
