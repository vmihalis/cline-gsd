---
description: Verify Cline-GSD installation status
---

# /gsd:health - Installation Health Check

Check that Cline-GSD is properly installed and ready to use.

## Verification Steps

1. **Check workflow files exist**
   - Look for ~/.cline/commands/gsd/ directory
   - List all .md workflow files present
   - Report count of installed workflows

2. **Verify Cline CLI**
   - Run `cline --version` via Bash tool
   - Report version or note if not found

3. **Check VERSION file**
   - Read ~/.cline/commands/gsd/VERSION if exists
   - Report Cline-GSD version

4. **Validate workflow syntax**
   - Parse YAML frontmatter in each workflow
   - Report any syntax errors found

## Output Format

Present results as a checklist:

```
Cline-GSD Health Check
----------------------
[checkmark] Workflows installed (N files)
[checkmark] Cline CLI found (version X.Y.Z)
[checkmark] Cline-GSD version 1.0.0
[checkmark] Workflow syntax valid

Status: Ready to use!
```

Or if issues found:
```
[X] Issue description
    Suggestion: how to fix
```

## Next Steps

If all checks pass, suggest: "Try /gsd:help to see available commands"
If issues found, provide specific fix instructions.
