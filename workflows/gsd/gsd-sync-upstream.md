---
description: Check for upstream GSD updates and sync with latest version
---

# /gsd-sync-upstream -- Sync with Upstream GSD

This workflow checks if a newer version of Cline-GSD is available and guides the user through updating. The Cline-GSD project tracks upstream GSD (glittercowboy/get-shit-done) as a reference implementation. Updates are delivered via npm re-installation.

## Step 1: Check current version

Read the local package.json to determine the currently installed version.

```bash
node -e "
import { getInstalledVersion } from './src/upstream-sync.js';
const result = await getInstalledVersion('.');
console.log(JSON.stringify(result, null, 2));
"
```

Report: "Current version: {version}"

If the version cannot be read, report the error and stop. This usually means the workflow is being run from the wrong directory.

## Step 2: Check latest upstream version

Compare the local version against the latest published version on npm.

```bash
node -e "
import { checkUpstreamVersion, getInstalledVersion, compareVersions } from './src/upstream-sync.js';
const local = await getInstalledVersion('.');
const upstream = await checkUpstreamVersion();
if (local.success && upstream.success) {
  const cmp = compareVersions(local.data.version, upstream.data.version);
  console.log(JSON.stringify({ local: local.data.version, upstream: upstream.data.version, ...cmp }, null, 2));
} else {
  console.log('Could not check:', local.error || upstream.error);
}
"
```

Report comparison results:

- If **up-to-date**: "You're running the latest version ({version}). No update needed."
- If **behind**: "Update available: {current} -> {latest}"
- If **ahead**: "Local version ({current}) is ahead of published ({latest}). This is expected during development."
- If **check failed**: "Could not check upstream version. This may be a network issue or the package is not yet published."

## Step 3: Guide update (if needed)

### If update available:

```
## Update Available

**Current:** {current}
**Latest:** {latest}

### To update:

```bash
npx cline-gsd@latest
```

This will:
1. Download the latest version
2. Re-install workflows to your Cline config directory
3. Preserve your .planning/ directory and project state

### What's protected:
- `.planning/` directory (all project state)
- Your `config.json` settings
- Your project-specific files

### What gets updated:
- `workflows/gsd/` files (workflow definitions)
- `src/` module files (helper code)
- `bin/` installer files
```

### If up-to-date:

```
No update needed.

---

**Also available:**
- `/gsd-progress` -- check project status
- `/gsd-verify-work` -- verify completed work
```

## Behavioral Guidelines

- **Never auto-update.** Always show the user what will change and let them decide.
- The `npx cline-gsd@latest` command handles the actual update. This workflow is just for checking and guidance.
- Protected files (`.planning/`, `config.json`) are never overwritten by the installer.
- If the package is not yet published to npm, that's expected during development. Report it gracefully.
- If the user is ahead of published (development build), acknowledge it as normal.
