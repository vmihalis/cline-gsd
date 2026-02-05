# Roadmap: Cline-GSD

## Overview

This roadmap transforms GSD (Get Shit Done) into a Cline-compatible framework. The journey starts with installation infrastructure and CLI agent patterns, builds up the state management and workflow commands, then adds verification and upstream compatibility. Each phase delivers a complete, testable capability that builds toward a full GSD port.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Installation & Foundation** - npx installer, platform detection, file structure
- [x] **Phase 2: Agent Infrastructure** - Parallel CLI subagent spawning and result collection
- [x] **Phase 3: State Management** - .planning/ directory, STATE.md, ROADMAP.md tracking
- [x] **Phase 4: New Project Workflow** - /gsd:new-project command with questioning and config
- [x] **Phase 5: Codebase Mapping** - /gsd:map-codebase for brownfield projects
- [ ] **Phase 6: Planning Workflow** - /gsd:plan-phase with research and plan validation
- [ ] **Phase 7: Execution Workflow** - /gsd:execute-phase with atomic commits
- [ ] **Phase 8: Verification & Polish** - /gsd:verify-work, /gsd:debug, upstream sync

## Phase Details

### Phase 1: Installation & Foundation
**Goal**: Users can install Cline-GSD and verify it works
**Depends on**: Nothing (first phase)
**Requirements**: INST-01, INST-02, INST-03, INST-04, INST-05, SYNC-01, SYNC-03
**Success Criteria** (what must be TRUE):
  1. User can run `npx cline-gsd` and complete installation
  2. Installer correctly detects Mac, Windows, or Linux platform
  3. Installer warns if Cline CLI is not found
  4. Workflows appear in user's Cline config directory after install
  5. User can run `/gsd-health` and see confirmation that Cline-GSD is ready
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Package scaffolding and npx entry point
- [x] 01-02-PLAN.md — Platform detection and Cline verification
- [x] 01-03-PLAN.md — Workflow file installation and health check

### Phase 2: Agent Infrastructure
**Goal**: Cline can spawn parallel CLI subagents that write results to files
**Depends on**: Phase 1
**Requirements**: AGT-01, AGT-02, AGT-03
**Success Criteria** (what must be TRUE):
  1. Main context can spawn multiple `cline "prompt" &` processes
  2. Spawned agents write their outputs to designated files (not stdout)
  3. Main context can `wait` for agents and collect their file outputs
  4. Agent spawning works reliably across platforms (Mac, Linux, Windows)
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md — Cross-platform agent spawning module and documentation
- [x] 02-02-PLAN.md — Output verification, collection, and integration test

### Phase 3: State Management
**Goal**: Project state persists across sessions via .planning/ directory
**Depends on**: Phase 1
**Requirements**: STATE-01, STATE-02, STATE-04, STATE-05
**Success Criteria** (what must be TRUE):
  1. `.planning/` directory structure matches upstream GSD
  2. STATE.md accurately tracks current phase, plan, and progress
  3. ROADMAP.md contains phases with success criteria
  4. PLAN.md files contain atomic task breakdowns
  5. Progress bar in STATE.md reflects actual completion percentage
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md — Directory initialization and template file creation
- [x] 03-02-PLAN.md — State file parsing and reading functions
- [x] 03-03-PLAN.md — State update operations and integration test

### Phase 4: New Project Workflow
**Goal**: Users can initialize new projects with structured questioning and check progress
**Depends on**: Phase 1, Phase 3
**Requirements**: CMD-01, CMD-04
**Success Criteria** (what must be TRUE):
  1. `/gsd-new-project.md` launches deep questioning methodology
  2. PROJECT.md is created with core value, requirements, and constraints
  3. config.json is created with user preferences (depth, mode, etc.)
  4. `/gsd-progress.md` shows current project state and suggests next action
  5. User can resume project after closing and reopening Cline
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md — Project-init helper module and new-project workflow
- [x] 04-02-PLAN.md — Progress workflow and integration test

### Phase 5: Codebase Mapping
**Goal**: Users can analyze existing codebases via parallel mappers
**Depends on**: Phase 2, Phase 3
**Requirements**: MAP-01, MAP-02, MAP-03
**Success Criteria** (what must be TRUE):
  1. `/gsd:map-codebase` spawns parallel mapping agents
  2. Mappers produce STACK.md, ARCHITECTURE.md, STRUCTURE.md files
  3. Mapping uses CLI subagents (cline "prompt" &) for parallelization
  4. Mapping outputs are synthesized into coherent codebase understanding
**Plans**: 2 plans

Plans:
- [x] 05-01-PLAN.md — Mapper orchestration module and Cline workflow
- [x] 05-02-PLAN.md — Integration test and package.json update

### Phase 6: Planning Workflow
**Goal**: Users can create validated plans with research support
**Depends on**: Phase 2, Phase 3, Phase 4
**Requirements**: CMD-02, CMD-05, AGT-04, AGT-05, AGT-06
**Success Criteria** (what must be TRUE):
  1. `/gsd:discuss-phase N` gathers context before planning
  2. `/gsd:plan-phase N` creates PLAN.md with atomic tasks
  3. Research agents run before planning when enabled in config
  4. Plan checker validates plans before execution
  5. Model orchestration uses cheaper models for research, quality for planning
**Plans**: 3 plans

Plans:
- [ ] 06-01-PLAN.md — Discuss-phase helper module and workflow
- [ ] 06-02-PLAN.md — Plan-phase orchestration module and workflow
- [ ] 06-03-PLAN.md — Integration test and package.json update

### Phase 7: Execution Workflow
**Goal**: Users can execute plans with atomic commits per task
**Depends on**: Phase 3, Phase 6
**Requirements**: CMD-03, EXEC-01, EXEC-02, EXEC-03, EXEC-04, STATE-03
**Success Criteria** (what must be TRUE):
  1. `/gsd:execute-phase N` runs all plans in sequence
  2. Execution happens in main Cline context (not subagents)
  3. Each completed task produces an atomic git commit
  4. Plans execute sequentially or in waves as configured
  5. SUMMARY.md is generated after plan completion
**Plans**: TBD

Plans:
- [ ] 07-01: Execute-phase orchestration
- [ ] 07-02: Atomic commit implementation
- [ ] 07-03: Summary generation and state updates

### Phase 8: Verification & Polish
**Goal**: Users can verify work and sync with upstream GSD
**Depends on**: Phase 7
**Requirements**: VER-01, VER-02, VER-03, SYNC-02
**Success Criteria** (what must be TRUE):
  1. `/gsd:verify-work` performs post-execution UAT verification
  2. `/gsd:debug` provides systematic debugging with checkpoint state
  3. Verifier checks must-haves against actual codebase
  4. Repository can pull improvements from glittercowboy/get-shit-done
  5. Upstream changes can be merged without breaking Cline-specific code
**Plans**: TBD

Plans:
- [ ] 08-01: Verify-work command and UAT checks
- [ ] 08-02: Debug command with checkpoints
- [ ] 08-03: Upstream sync mechanism and documentation

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Installation & Foundation | 3/3 | Complete | 2026-02-05 |
| 2. Agent Infrastructure | 2/2 | Complete | 2026-02-05 |
| 3. State Management | 3/3 | Complete | 2026-02-05 |
| 4. New Project Workflow | 2/2 | Complete | 2026-02-05 |
| 5. Codebase Mapping | 2/2 | Complete | 2026-02-05 |
| 6. Planning Workflow | 0/3 | Not started | - |
| 7. Execution Workflow | 0/3 | Not started | - |
| 8. Verification & Polish | 0/3 | Not started | - |

---
*Roadmap created: 2026-02-05*
*Last updated: 2026-02-05*
