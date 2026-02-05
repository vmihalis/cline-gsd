# Phase 1: Installation & Foundation - Research

**Researched:** 2026-02-05
**Domain:** npx CLI installer, Node.js cross-platform tooling
**Confidence:** HIGH

## Summary

This phase implements an npx installer for Cline-GSD that sets up workflow files on the user's machine. Research covered npx package creation, terminal output styling, platform detection, Cline CLI integration, and file operations with error handling.

The installer will be a lightweight Node.js CLI that: (1) detects the platform, (2) checks for Cline CLI, (3) copies workflow files to the correct location, and (4) provides a `/gsd:health` workflow for verification. The upstream GSD project (glittercowboy/get-shit-done) provides a reference implementation, though Cline-GSD targets specifically Cline rather than multiple runtimes.

**Primary recommendation:** Build a single-purpose Node.js CLI using picocolors for terminal output, ora for spinners, and native Node.js APIs (fs, os, path) for cross-platform file operations. Store workflows in `~/.cline/commands/gsd/` following Cline CLI's configuration structure.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | >=20.0.0 | Runtime | Cline CLI requires Node 20+, matches ecosystem |
| picocolors | ^1.1.1 | Terminal colors | 14x smaller than chalk, 2x faster, zero deps |
| ora | ^8.x | Spinners/progress | De facto standard for elegant CLI spinners |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| command-exists | ^1.2.9 | Check CLI availability | Verify Cline CLI installed |
| node:fs | built-in | File operations | Copy/delete/read files |
| node:os | built-in | Platform detection | os.platform(), os.homedir() |
| node:path | built-in | Path handling | Cross-platform path joins |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| picocolors | chalk | chalk is larger (45kB vs 3kB) but more features |
| ora | cli-spinners | ora wraps cli-spinners with easier API |
| command-exists | manual exec | command-exists handles Windows edge cases |

**Installation:**
```bash
npm install picocolors ora command-exists
```

## Architecture Patterns

### Recommended Project Structure
```
cline-gsd/
├── bin/
│   └── install.js          # Entry point (#!/usr/bin/env node)
├── src/
│   ├── platform.js         # Platform detection
│   ├── installer.js        # Core installation logic
│   ├── health.js           # Health check implementation
│   └── output.js           # Terminal output helpers
├── workflows/
│   └── gsd/                # Workflow files to copy
│       ├── health.md       # /gsd:health command
│       └── [other].md      # Future commands
├── package.json            # bin field points to bin/install.js
├── CHANGELOG.md            # For post-update display
└── README.md
```

### Pattern 1: npx Entry Point
**What:** Configure package.json bin field for npx execution
**When to use:** Always - this is how npx finds the executable
**Example:**
```json
// package.json
{
  "name": "cline-gsd",
  "version": "1.0.0",
  "bin": {
    "cline-gsd": "bin/install.js"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

```javascript
// bin/install.js
#!/usr/bin/env node
import { runInstaller } from '../src/installer.js';
runInstaller(process.argv.slice(2));
```

### Pattern 2: Platform-Aware Paths
**What:** Detect platform and construct correct file paths
**When to use:** All file operations
**Example:**
```javascript
// Source: Node.js os/path documentation
import os from 'node:os';
import path from 'node:path';

function getClineConfigDir() {
  const homeDir = os.homedir();
  // Cline CLI stores config in ~/.cline/
  // Can be overridden with CLINE_DIR environment variable
  const clineDir = process.env.CLINE_DIR || path.join(homeDir, '.cline');
  return clineDir;
}

function getGsdCommandsDir() {
  return path.join(getClineConfigDir(), 'commands', 'gsd');
}
```

### Pattern 3: Progress Output with Spinners
**What:** Show progress steps with colored checkmarks
**When to use:** Each installation step
**Example:**
```javascript
// Source: ora and picocolors GitHub READMEs
import ora from 'ora';
import pc from 'picocolors';

async function installStep(label, action) {
  const spinner = ora(label).start();
  try {
    await action();
    spinner.succeed(pc.green(label));
    return true;
  } catch (error) {
    spinner.fail(pc.red(label));
    console.error(pc.yellow(`  ${error.message}`));
    return false;
  }
}

// Usage
await installStep('Detecting platform...', detectPlatform);
await installStep('Copying workflows...', copyWorkflows);
```

### Pattern 4: Atomic Rollback on Failure
**What:** Clean up partial installations on error
**When to use:** When any step fails during installation
**Example:**
```javascript
const createdPaths = [];

function trackCreated(filePath) {
  createdPaths.push(filePath);
}

async function rollback() {
  for (const p of createdPaths.reverse()) {
    try {
      await fs.rm(p, { recursive: true, force: true });
    } catch {
      // Best effort cleanup
    }
  }
}

async function install() {
  try {
    await copyFile(src, dest);
    trackCreated(dest);
    // ... more operations
  } catch (error) {
    await rollback();
    throw error;
  }
}
```

### Anti-Patterns to Avoid
- **Hardcoded paths:** Always use `os.homedir()` and `path.join()`, never `/home/user/` strings
- **Silent failures:** Always report what went wrong, never swallow errors
- **Platform-specific separators:** Never use `\` or `/` directly, use `path.sep` or `path.join()`
- **Blocking I/O:** Use async fs methods (`fs/promises`) for better performance
- **Global state:** Pass context explicitly rather than using module-level variables

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Terminal colors | ANSI escape codes | picocolors | Color support detection, terminal compatibility |
| Progress spinners | console.log with emojis | ora | Handles cursor, clears line, TTY detection |
| Check command exists | `which` shell command | command-exists | Windows uses `where`, handles edge cases |
| Platform detection | Environment sniffing | os.platform() | Reliable, covers all platforms |
| Home directory | Hard-coded paths | os.homedir() | Handles Windows USERPROFILE, Unix HOME |

**Key insight:** Cross-platform CLI tooling has many subtle edge cases (Windows vs Unix paths, TTY vs pipe output, color support). Using established libraries avoids weeks of debugging platform-specific bugs.

## Common Pitfalls

### Pitfall 1: Windows Path Separators
**What goes wrong:** Paths with backslashes fail on Windows or look wrong in output
**Why it happens:** Windows uses `\`, Unix uses `/`, mixing them causes issues
**How to avoid:** Always use `path.join()` and `path.sep`, never string concatenation
**Warning signs:** Paths with mixed `/` and `\` in logs

### Pitfall 2: TTY Detection for Colors
**What goes wrong:** Colors/spinners break when piped to file or in CI
**Why it happens:** Not all output streams support ANSI codes
**How to avoid:** Use `pc.isColorSupported` check, ora handles this automatically
**Warning signs:** Garbled output in CI logs, escape codes visible

### Pitfall 3: Missing Node.js Version Check
**What goes wrong:** Cryptic syntax errors on older Node versions
**Why it happens:** ESM, top-level await require Node 14+, Cline CLI requires 20+
**How to avoid:** Add `engines` field to package.json, check early in installer
**Warning signs:** User complaints about "unexpected token" errors

### Pitfall 4: Permission Errors on Install
**What goes wrong:** EACCES errors when writing to config directory
**Why it happens:** User home directory has correct perms, but subdirs might not
**How to avoid:** Use `fs.mkdir` with `recursive: true`, catch EACCES specifically
**Warning signs:** "Permission denied" in error logs

### Pitfall 5: Assuming Directory Exists
**What goes wrong:** ENOENT when trying to write files
**Why it happens:** `~/.cline/commands/gsd/` may not exist on fresh install
**How to avoid:** Always `mkdir -p` (recursive) before copying files
**Warning signs:** "No such file or directory" errors

### Pitfall 6: Not Handling Existing Installation
**What goes wrong:** Old files left behind, version conflicts
**Why it happens:** Update doesn't clean up files renamed/removed in new version
**How to avoid:** Remove entire gsd directory before copying new version
**Warning signs:** Stale workflow files after update

## Code Examples

Verified patterns from official sources:

### Platform Detection
```javascript
// Source: Node.js os documentation
import os from 'node:os';

function getPlatform() {
  const platform = os.platform();
  switch (platform) {
    case 'darwin': return 'mac';
    case 'win32': return 'windows';
    case 'linux': return 'linux';
    default: return 'unknown';
  }
}
```

### Check Cline CLI Installed
```javascript
// Source: command-exists GitHub
import commandExists from 'command-exists';

async function checkClineCli() {
  try {
    await commandExists('cline');
    return { installed: true, version: await getClineVersion() };
  } catch {
    return { installed: false, version: null };
  }
}

async function getClineVersion() {
  const { execSync } = await import('node:child_process');
  try {
    const output = execSync('cline version', { encoding: 'utf8' });
    return output.trim();
  } catch {
    return 'unknown';
  }
}
```

### Copy Workflow Files
```javascript
// Source: Node.js fs/promises documentation
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function copyWorkflows(destDir) {
  const srcDir = path.join(__dirname, '..', 'workflows', 'gsd');

  // Ensure destination exists
  await fs.mkdir(destDir, { recursive: true });

  // Copy all workflow files
  const files = await fs.readdir(srcDir);
  for (const file of files) {
    if (file.endsWith('.md')) {
      await fs.copyFile(
        path.join(srcDir, file),
        path.join(destDir, file)
      );
    }
  }
}
```

### Colored Output with Checkmarks
```javascript
// Source: picocolors GitHub
import pc from 'picocolors';

const symbols = {
  success: pc.green('✓'),
  error: pc.red('✖'),
  warning: pc.yellow('⚠'),
  info: pc.blue('ℹ')
};

function logSuccess(msg) {
  console.log(`${symbols.success} ${msg}`);
}

function logError(msg) {
  console.log(`${symbols.error} ${pc.red(msg)}`);
}

function logWarning(msg) {
  console.log(`${symbols.warning} ${pc.yellow(msg)}`);
}
```

### Health Check Workflow File
```markdown
---
description: Verify Cline-GSD installation status
---

# /gsd:health - Installation Health Check

Check that Cline-GSD is properly installed and ready to use.

## Steps

1. **Verify workflow files exist**
   - Check ~/.cline/commands/gsd/ directory
   - List all .md files present

2. **Check Cline CLI availability**
   - Run `cline version`
   - Report version or warn if not found

3. **Validate workflow syntax**
   - Parse each workflow file
   - Check for YAML frontmatter errors

4. **Report status**
   - Show checklist of verified items
   - Display Cline-GSD version
   - Display Cline CLI version (if available)

## Output Format

✓ Workflows installed (N files)
✓ Cline CLI found (version X.Y.Z)
✓ Workflow syntax valid
✓ Cline-GSD version 1.0.0

Ready to use! Try /gsd:progress to get started.
```

### CLI Argument Parsing
```javascript
// Simple flag parsing without dependencies
function parseArgs(argv) {
  const args = {
    verbose: false,
    force: false,
    help: false
  };

  for (const arg of argv) {
    switch (arg) {
      case '--verbose':
      case '-v':
        args.verbose = true;
        break;
      case '--force':
      case '-f':
        args.force = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
    }
  }

  return args;
}
```

### Display Changelog After Update
```javascript
import fs from 'node:fs/promises';
import path from 'node:path';
import pc from 'picocolors';

async function showChangelog() {
  const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
  try {
    const content = await fs.readFile(changelogPath, 'utf8');
    // Extract latest version section (first ## heading)
    const match = content.match(/^## \[?\d+\.\d+\.\d+\]?.*?\n([\s\S]*?)(?=\n## |$)/m);
    if (match) {
      console.log(pc.cyan('\n--- What\'s New ---'));
      console.log(match[1].trim());
      console.log(pc.cyan('------------------\n'));
    }
  } catch {
    // Changelog not found, skip silently
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| chalk for colors | picocolors | 2023+ | 14x smaller, 2x faster |
| CommonJS | ES Modules | Node 14+ | Use `"type": "module"` |
| callbacks | async/await | Node 10+ | Cleaner error handling |
| fs sync methods | fs/promises | Node 14+ | Non-blocking I/O |
| require() | import | ESM standard | Top-level await support |

**Deprecated/outdated:**
- `chalk` v4: While still popular, picocolors is preferred for new CLIs
- `commander`/`yargs`: Overkill for simple installers, use manual parsing
- CommonJS: ESM is the standard for new Node.js projects

## Cline CLI Integration Details

### Configuration Locations
| Platform | Cline Config Directory |
|----------|----------------------|
| All | `~/.cline/` (default) |
| All | Override with `CLINE_DIR` env var |

### Cline CLI Verification
```bash
# Check if installed
cline version

# Expected output format
# cline vX.Y.Z
```

### Workflow Files Location
Cline-GSD workflows should be placed in:
```
~/.cline/commands/gsd/
├── health.md           # /gsd:health
├── new-project.md      # /gsd:new-project (future)
└── [other workflows]
```

### Cline Rules vs Commands
- **Rules** (`.clinerules/`): Project-specific AI behavior guidelines
- **Commands** (`commands/gsd/`): Executable workflows triggered by `/gsd:*`

GSD workflows are **commands**, not rules.

## Upstream GSD Compatibility

The upstream [glittercowboy/get-shit-done](https://github.com/glittercowboy/get-shit-done) project:
- Publishes as `npx get-shit-done-cc`
- Supports Claude Code, OpenCode, Gemini CLI
- Uses `bin/install.js` as entry point
- Stores commands in `~/.claude/commands/gsd/` for Claude Code

**Cline-GSD differences:**
- Single target: Cline CLI only
- Location: `~/.cline/commands/gsd/` instead of `~/.claude/`
- Simpler installer (no multi-runtime support)
- Same workflow file format (Markdown with YAML frontmatter)

## Open Questions

Things that couldn't be fully resolved:

1. **Cline CLI command registration**
   - What we know: Commands go in `~/.cline/commands/`
   - What's unclear: Does Cline auto-discover commands or need registration?
   - Recommendation: Test with a simple command file, check docs.cline.bot

2. **Workflow file format specifics**
   - What we know: Markdown with YAML frontmatter, Claude Code style
   - What's unclear: Cline-specific frontmatter fields vs Claude Code
   - Recommendation: Start with minimal frontmatter (description only)

3. **VS Code extension vs CLI workflows**
   - What we know: Cline has both VS Code extension and CLI
   - What's unclear: Do they share the same commands directory?
   - Recommendation: Target CLI first (`~/.cline/`), test with extension

## Sources

### Primary (HIGH confidence)
- [Cline CLI Installation](https://docs.cline.bot/cline-cli/installation) - Installation requirements, config paths
- [Cline CLI Reference](https://docs.cline.bot/cline-cli/cli-reference) - Command structure, CLINE_DIR env var
- [picocolors GitHub](https://github.com/alexeyraspopov/picocolors) - API, usage patterns
- [ora GitHub](https://github.com/sindresorhus/ora) - Spinner API, methods
- [Node.js os documentation](https://nodejs.org/api/os.html) - os.homedir(), os.platform()
- [Node.js fs/promises documentation](https://nodejs.org/api/fs.html) - File operations

### Secondary (MEDIUM confidence)
- [glittercowboy/get-shit-done](https://github.com/glittercowboy/get-shit-done) - Upstream reference implementation
- [command-exists GitHub](https://github.com/mathisonian/command-exists) - Cross-platform command checking
- [Cline Rules documentation](https://docs.cline.bot/features/cline-rules) - Rules vs commands structure
- [cross-platform-node-guide](https://github.com/ehmicky/cross-platform-node-guide) - Path handling patterns

### Tertiary (LOW confidence)
- WebSearch results on npx best practices 2026
- WebSearch results on Node.js CLI error handling patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Direct from official docs and GitHub READMEs
- Architecture: HIGH - Based on upstream GSD and Node.js conventions
- Cline CLI paths: MEDIUM - Docs confirmed, but command registration untested
- Pitfalls: HIGH - Well-documented cross-platform issues

**Research date:** 2026-02-05
**Valid until:** 2026-03-05 (30 days - stable domain)
