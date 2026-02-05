# Requirements: Cline-GSD

**Defined:** 2026-02-05
**Core Value:** Enable Cline users to build complex projects with structured, spec-driven workflow

## v1 Requirements

Requirements for initial release. Full port of GSD to Cline.

### Installation

- [x] **INST-01**: User can install via `npx cline-gsd`
- [x] **INST-02**: Installer detects platform (Mac, Windows, Linux)
- [x] **INST-03**: Installer verifies Cline CLI is installed
- [x] **INST-04**: Installer copies workflows to user's Cline config directory
- [x] **INST-05**: User can run `/gsd-health` to verify installation

### Core Workflow Commands

- [ ] **CMD-01**: `/gsd:new-project` — questioning, PROJECT.md, config, requirements, roadmap
- [ ] **CMD-02**: `/gsd:plan-phase N` — research + create PLAN.md for phase N
- [ ] **CMD-03**: `/gsd:execute-phase N` — run all plans in phase with atomic commits
- [ ] **CMD-04**: `/gsd:progress` — show project state, suggest next action
- [ ] **CMD-05**: `/gsd:discuss-phase N` — gather context before planning

### Codebase Analysis

- [ ] **MAP-01**: `/gsd:map-codebase` — spawn parallel mappers for brownfield analysis
- [ ] **MAP-02**: Mappers write STACK.md, ARCHITECTURE.md, STRUCTURE.md, etc.
- [ ] **MAP-03**: Mapping works via CLI subagents (`cline "prompt" &`)

### Verification & Debug

- [ ] **VER-01**: `/gsd:verify-work` — post-execution UAT verification
- [ ] **VER-02**: `/gsd:debug` — systematic debugging with checkpoint state
- [ ] **VER-03**: Verifier checks must-haves against actual codebase

### Agent System

- [x] **AGT-01**: Parallel agent spawning via `cline "prompt" &` + `wait`
- [x] **AGT-02**: Agents write results to files (not stdout)
- [x] **AGT-03**: Parent collects and synthesizes agent outputs
- [ ] **AGT-04**: Research agents run before planning (if enabled)
- [ ] **AGT-05**: Plan checker validates plans before execution
- [ ] **AGT-06**: Model orchestration — cheap models for research, quality for planning

### State Management

- [x] **STATE-01**: `.planning/` directory structure matches GSD
- [x] **STATE-02**: STATE.md tracks project memory across sessions
- [ ] **STATE-03**: Atomic git commits per completed task
- [x] **STATE-04**: ROADMAP.md with phases and success criteria
- [x] **STATE-05**: PLAN.md with atomic task breakdown

### Execution Model

- [ ] **EXEC-01**: Execution happens in main Cline context (not subagents)
- [ ] **EXEC-02**: Plans execute sequentially or in waves
- [ ] **EXEC-03**: Each task produces atomic commit
- [ ] **EXEC-04**: SUMMARY.md generated after plan completion

### Upstream Compatibility

- [ ] **SYNC-01**: File structure compatible with upstream GSD
- [ ] **SYNC-02**: Can pull improvements from glittercowboy/get-shit-done
- [ ] **SYNC-03**: Templates and references match upstream format

## v2 Requirements

Deferred to future release.

### Enhanced Features

- **V2-01**: Internal subagent support (when `bee/subagents` merges)
- **V2-02**: VS Code extension integration
- **V2-03**: Cline-specific optimizations diverging from upstream
- **V2-04**: GUI for project visualization

## Out of Scope

| Feature | Reason |
|---------|--------|
| Modifying Cline core | We adapt to existing capabilities |
| Agents that edit code | Cline CLI agents are read-only |
| Claude Code support | Original GSD handles that |
| OpenCode/Gemini CLI support | Original GSD handles that |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INST-01 | Phase 1 | Complete |
| INST-02 | Phase 1 | Complete |
| INST-03 | Phase 1 | Complete |
| INST-04 | Phase 1 | Complete |
| INST-05 | Phase 1 | Complete |
| SYNC-01 | Phase 1 | Complete |
| SYNC-03 | Phase 1 | Complete |
| AGT-01 | Phase 2 | Complete |
| AGT-02 | Phase 2 | Complete |
| AGT-03 | Phase 2 | Complete |
| STATE-01 | Phase 3 | Complete |
| STATE-02 | Phase 3 | Complete |
| STATE-04 | Phase 3 | Complete |
| STATE-05 | Phase 3 | Complete |
| CMD-01 | Phase 4 | Pending |
| CMD-04 | Phase 4 | Pending |
| MAP-01 | Phase 5 | Pending |
| MAP-02 | Phase 5 | Pending |
| MAP-03 | Phase 5 | Pending |
| CMD-02 | Phase 6 | Pending |
| CMD-05 | Phase 6 | Pending |
| AGT-04 | Phase 6 | Pending |
| AGT-05 | Phase 6 | Pending |
| AGT-06 | Phase 6 | Pending |
| CMD-03 | Phase 7 | Pending |
| EXEC-01 | Phase 7 | Pending |
| EXEC-02 | Phase 7 | Pending |
| EXEC-03 | Phase 7 | Pending |
| EXEC-04 | Phase 7 | Pending |
| STATE-03 | Phase 7 | Pending |
| VER-01 | Phase 8 | Pending |
| VER-02 | Phase 8 | Pending |
| VER-03 | Phase 8 | Pending |
| SYNC-02 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 34 total
- Mapped to phases: 34
- Unmapped: 0

---
*Requirements defined: 2026-02-05*
*Last updated: 2026-02-05 after roadmap creation*
