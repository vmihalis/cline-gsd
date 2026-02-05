# Phase 2: Agent Infrastructure - Research

**Researched:** 2026-02-05
**Domain:** CLI subagent spawning, cross-platform process management, file-based inter-agent communication
**Confidence:** HIGH

## Summary

This phase implements the agent infrastructure that enables the main Cline context to spawn parallel CLI subagents for read-only research and mapping tasks. Research covered Cline CLI headless mode, bash/PowerShell process management, cross-platform spawning patterns, and upstream GSD's agent architecture.

The Cline CLI supports headless mode via the `-y`/`--yolo` flag, which auto-approves all actions and streams output to stdout. Agents are spawned as background processes (`cline -y "prompt" &`) and tracked via PIDs. Results are written to `.planning/` subdirectories as specified in CONTEXT.md. The orchestrator waits for all agents using `wait` and reads their file outputs.

**Primary recommendation:** Use the Cline CLI headless mode (`cline -y "prompt"`) for spawning agents, with bash `&` for background execution and `wait` for completion detection. Agents write results to predetermined file paths (e.g., `.planning/codebase/STACK.md`), returning only a confirmation message to stdout. For Windows compatibility, use PowerShell's `Start-Process -NoNewWindow` with `Wait-Process`.

## Standard Stack

The established approach for this domain:

### Core Components
| Component | Version/Pattern | Purpose | Why Standard |
|-----------|-----------------|---------|--------------|
| Cline CLI | 2.0+ | Agent runtime | Official CLI with headless mode support |
| `-y` flag | Built-in | Auto-approve actions | Enables unattended operation |
| Bash `&` + `wait` | POSIX | Process management | Standard Unix background job control |
| PowerShell `Start-Process` | 7.x | Windows spawning | Cross-platform PowerShell Core |

### Supporting Components
| Component | Purpose | When to Use |
|-----------|---------|-------------|
| `$!` / `$PID` | PID capture | Track each spawned agent |
| `jobs -p` | List background PIDs | Wait on all agents |
| Exit codes | Success/failure detection | Error handling |
| `.planning/` directory | Agent output location | File-based communication |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Background `&` | `cline instance new` | Instance commands removed in CLI 2.0 |
| Shell `wait` | Node.js child_process | Adds dependency, shell is simpler |
| File outputs | stdout JSON | Files persist, easier to debug/resume |

**No new dependencies required** - this phase uses shell primitives and existing Cline CLI.

## Architecture Patterns

### Agent Spawn Pattern (Unix/Mac/Linux)
```bash
# Spawn agents in parallel, capture PIDs
cline -y "Analyze stack and write to .planning/codebase/STACK.md" &
PID1=$!
cline -y "Analyze architecture and write to .planning/codebase/ARCHITECTURE.md" &
PID2=$!
cline -y "Analyze conventions and write to .planning/codebase/CONVENTIONS.md" &
PID3=$!

# Wait for all agents to complete
FAIL=0
for pid in $PID1 $PID2 $PID3; do
  wait $pid || let "FAIL+=1"
done

# Check results
if [ $FAIL -gt 0 ]; then
  echo "Warning: $FAIL agents failed"
fi
```

### Agent Spawn Pattern (Windows PowerShell)
```powershell
# Spawn agents in parallel
$processes = @()
$processes += Start-Process -FilePath "cline" -ArgumentList '-y "Analyze stack..."' -PassThru -NoNewWindow
$processes += Start-Process -FilePath "cline" -ArgumentList '-y "Analyze architecture..."' -PassThru -NoNewWindow

# Wait for all to complete
$processes | ForEach-Object { $_ | Wait-Process }

# Check exit codes
$failures = ($processes | Where-Object { $_.ExitCode -ne 0 }).Count
if ($failures -gt 0) {
  Write-Host "Warning: $failures agents failed"
}
```

### Agent Prompt Structure
Agents receive a structured prompt that:
1. Defines their role and scope
2. Specifies the exact output file path
3. Includes context from upstream (phase info, constraints)
4. Requests a completion confirmation to stdout

```
You are a GSD codebase mapper agent.

TASK: Analyze the project's technology stack.

OUTPUT FILE: .planning/codebase/STACK.md

INCLUDE:
- Languages and versions
- Frameworks and libraries
- Build tools and scripts
- Package managers

When complete, write the file and respond with only:
"COMPLETE: .planning/codebase/STACK.md (N lines)"
```

### File Output Convention
Following upstream GSD patterns:
```
.planning/
├── codebase/           # Mapping agent outputs
│   ├── STACK.md
│   ├── ARCHITECTURE.md
│   ├── STRUCTURE.md
│   ├── CONVENTIONS.md
│   └── CONCERNS.md
├── research/           # Research agent outputs
│   ├── ECOSYSTEM.md
│   └── FEASIBILITY.md
└── phases/
    └── XX-name/
        └── XX-RESEARCH.md   # Phase-specific research
```

### Orchestrator Collection Pattern
After `wait` completes:
```bash
# Verify outputs exist
for file in .planning/codebase/*.md; do
  if [ -f "$file" ]; then
    lines=$(wc -l < "$file")
    echo "Collected: $file ($lines lines)"
  else
    echo "Missing: $file"
  fi
done
```

### Anti-Patterns to Avoid
- **Parsing stdout for results:** Use file outputs; stdout is for status only
- **Single agent for all work:** Spawn parallel agents for independent tasks
- **Ignoring exit codes:** Track failures; some agents may fail
- **Hardcoded paths:** Use relative paths from project root
- **Missing output verification:** Always check files exist before reading
- **Synchronous spawning:** Use `&` to start agents in parallel, not sequentially

## Don't Hand-Roll

Problems with existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Background execution | Custom daemon | Shell `&` | Standard, no dependencies |
| Process waiting | Polling loops | Shell `wait` | Blocks until completion, returns exit code |
| Cross-platform spawn | Platform detection | PowerShell Core + Bash | PowerShell 7 works everywhere |
| Agent output format | Custom protocol | Markdown files | Human-readable, debuggable, git-friendly |
| Parallelism limit | Custom scheduler | Shell job control | OS handles process limits |

**Key insight:** Shell primitives (`&`, `wait`, `$!`) solve background process management. Don't add Node.js child_process or other dependencies for what shells do natively.

## Common Pitfalls

### Pitfall 1: Lost PIDs
**What goes wrong:** Can't wait on specific agents because PID wasn't captured
**Why it happens:** Not storing `$!` immediately after spawning
**How to avoid:** Always capture `$!` right after each `&` command
**Warning signs:** `wait` without arguments (waits on all, loses individual status)

### Pitfall 2: Shell Variable Scope
**What goes wrong:** PIDs captured in subshell aren't available in parent
**Why it happens:** Pipes create subshells: `command | while read` loses variables
**How to avoid:** Use arrays or temp files instead of piped loops
**Warning signs:** Empty PID variables after spawn loop

### Pitfall 3: Race Condition on Output Files
**What goes wrong:** Reading output files before agent finishes writing
**Why it happens:** File exists but isn't complete
**How to avoid:** Wait for process completion before reading; agents should write atomically
**Warning signs:** Truncated or empty output files

### Pitfall 4: Windows Path Issues
**What goes wrong:** Paths with backslashes fail in prompts
**Why it happens:** Mixed path separators in shell commands
**How to avoid:** Use forward slashes in prompts (works everywhere)
**Warning signs:** "file not found" errors only on Windows

### Pitfall 5: Agent Context Window Exhaustion
**What goes wrong:** Agent fails mid-task without output
**Why it happens:** Large codebase exceeds agent's context window
**How to avoid:** Scope agent tasks narrowly; use multiple focused agents
**Warning signs:** Incomplete outputs, agent exits without "COMPLETE" message

### Pitfall 6: Permission Prompts in Headless Mode
**What goes wrong:** Agent hangs waiting for permission
**Why it happens:** `-y` flag not passed or action not covered by auto-approve
**How to avoid:** Always use `-y` flag; test agent prompts manually first
**Warning signs:** Agent process running but no progress

## Code Examples

### Minimal Agent Spawn (Bash)
```bash
# Source: Standard POSIX shell patterns
# Spawn single agent in background
cline -y "Analyze package.json and write .planning/codebase/STACK.md" &
PID=$!

# Wait for completion
wait $PID
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "Agent completed successfully"
else
  echo "Agent failed with code $EXIT_CODE"
fi
```

### Parallel Agents with Failure Tracking
```bash
# Source: Adapted from jzawodn bash patterns
FAIL=0
PIDS=()

# Spawn multiple agents
cline -y "Stack analysis -> .planning/codebase/STACK.md" &
PIDS+=($!)
cline -y "Architecture analysis -> .planning/codebase/ARCHITECTURE.md" &
PIDS+=($!)
cline -y "Conventions analysis -> .planning/codebase/CONVENTIONS.md" &
PIDS+=($!)

# Wait for all, track failures
for pid in "${PIDS[@]}"; do
  wait $pid || ((FAIL++))
done

echo "Completed with $FAIL failures"
```

### Cross-Platform Wrapper Function
```bash
# Detect platform and spawn appropriately
spawn_agent() {
  local prompt="$1"

  if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    # Windows Git Bash / Cygwin
    cline -y "$prompt" &
    echo $!
  elif command -v pwsh &> /dev/null && [[ "$OSTYPE" == "msys" ]]; then
    # PowerShell available
    pwsh -Command "Start-Process cline -ArgumentList '-y \"$prompt\"' -PassThru" &
    echo $!
  else
    # Unix-like
    cline -y "$prompt" &
    echo $!
  fi
}

# Usage
PID=$(spawn_agent "Analyze stack...")
wait $PID
```

### Agent Output Verification
```bash
# Verify expected outputs exist and have content
verify_outputs() {
  local dir="$1"
  shift
  local files=("$@")
  local missing=0

  for file in "${files[@]}"; do
    path="$dir/$file"
    if [ -f "$path" ]; then
      lines=$(wc -l < "$path")
      echo "OK: $file ($lines lines)"
    else
      echo "MISSING: $file"
      ((missing++))
    fi
  done

  return $missing
}

# Usage after agents complete
verify_outputs ".planning/codebase" "STACK.md" "ARCHITECTURE.md" "CONVENTIONS.md"
```

### Timeout Handling
```bash
# Spawn with timeout (requires GNU coreutils timeout)
spawn_with_timeout() {
  local timeout_secs="$1"
  local prompt="$2"

  timeout "$timeout_secs" cline -y "$prompt" &
  echo $!
}

# Usage: 5 minute timeout
PID=$(spawn_with_timeout 300 "Analyze stack...")
wait $PID
if [ $? -eq 124 ]; then
  echo "Agent timed out"
fi
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `cline instance new` | Direct `cline -y` + `&` | CLI 2.0 (2026) | Instance commands removed |
| Claude Code Task tool | Shell background jobs | N/A for Cline | Different architecture |
| stdout JSON parsing | File-based outputs | GSD pattern | Human-readable, persistent |
| Single long-running agent | Multiple parallel agents | GSD pattern | Better context isolation |

**Cline CLI 2.0 Changes:**
- Instance management commands removed (no `cline instance new`)
- Headless mode (`-y`) is the standard for automation
- Multiple terminal windows for parallel instances (official pattern)

**Upstream GSD Pattern:**
- Claude Code uses `Task()` tool to spawn subagents
- Cline adaptation uses `cline -y` + shell background jobs
- Same file output convention (`.planning/` structure)

## Platform-Specific Notes

### macOS / Linux
- Standard bash works out of the box
- Use `$!` for PID, `wait` for completion
- `timeout` command available via GNU coreutils

### Windows
- Git Bash: Standard bash patterns work
- PowerShell: Use `Start-Process -PassThru` + `Wait-Process`
- CMD: Not recommended; use PowerShell or Git Bash
- WSL: Treat as Linux

### Cross-Platform Strategy
1. **Primary:** Write bash scripts (works in Git Bash on Windows)
2. **Fallback:** Provide PowerShell equivalents for native Windows
3. **Detection:** Use `$OSTYPE` or `os.platform()` if in Node.js context

## Open Questions

Things that couldn't be fully resolved:

1. **Agent context window behavior**
   - What we know: Each `cline -y` invocation gets fresh context
   - What's unclear: Exact context limits, how much codebase fits
   - Recommendation: Test with large repos; scope tasks narrowly

2. **Error recovery patterns**
   - What we know: Exit codes indicate success/failure
   - What's unclear: Best retry strategy for transient failures
   - Recommendation: Log failures; allow manual retry initially

3. **Concurrent agent limits**
   - What we know: OS handles process limits; Claude Code caps at 7-10
   - What's unclear: Cline-specific or API rate limits
   - Recommendation: Start with 3-4 parallel agents; increase if stable

## Sources

### Primary (HIGH confidence)
- [Cline CLI Overview](https://docs.cline.bot/cline-cli/overview) - Headless mode, -y flag
- [Cline CLI Three Core Flows](https://docs.cline.bot/cline-cli/three-core-flows) - Automation patterns
- [Cline CLI 2.0 Announcement](https://cline.bot/blog/announcing-cline-cli-2-0) - Instance command removal, parallel patterns
- [Bash wait patterns](https://gist.github.com/jzawodn/27452) - PID tracking, failure counting
- [PowerShell Wait-Process](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/wait-process) - Windows equivalent

### Secondary (MEDIUM confidence)
- [DeepWiki Cline CLI](https://deepwiki.com/cline/cline/12-cli-tool) - Multi-instance architecture
- [DeepWiki Orchestration](https://deepwiki.com/cline/prompts/5-orchestration-and-automation) - Parallel patterns
- [Upstream GSD Repository](https://github.com/glittercowboy/get-shit-done) - Agent architecture patterns
- [ClaudeLog Task Tools](https://claudelog.com/mechanics/task-agent-tools/) - Task tool mechanics (Claude Code reference)

### Tertiary (LOW confidence)
- WebSearch results on cross-platform shell spawning 2026
- Community patterns from Threads/Medium on parallel Cline instances

## Metadata

**Confidence breakdown:**
- Agent spawning: HIGH - Direct from Cline CLI docs
- File output patterns: HIGH - Matches upstream GSD
- Cross-platform: MEDIUM - Bash works, PowerShell patterns from MS docs
- Pitfalls: MEDIUM - Derived from shell best practices
- Error handling: LOW - General patterns, needs validation

**Research date:** 2026-02-05
**Valid until:** 2026-03-05 (30 days - stable domain)
