---
description: Verify Cline-GSD installation status
---

# /gsd-health.md - Installation Health Check

Check that Cline-GSD is properly installed and ready to use.

## Verification Steps

1. **Check workflow files exist**
   - Look for ~/Documents/Cline/Workflows/ directory
   - List all gsd-*.md workflow files present
   - Report count of installed GSD workflows

2. **Check VERSION file**
   - Read ~/Documents/Cline/Workflows/gsd-VERSION if exists
   - Report Cline-GSD version

3. **Validate workflow syntax**
   - Parse YAML frontmatter in each gsd-*.md workflow
   - Report any syntax errors found

## Output Format

Present results as a checklist:

```
Cline-GSD Health Check
----------------------
✓ Workflows installed (N files)
✓ Cline-GSD version 1.0.0
✓ Workflow syntax valid

Status: Ready to use!
```

Or if issues found:
```
✗ Issue description
  Suggestion: how to fix
```

## Next Steps

If all checks pass, suggest: "Try /gsd-help.md to see available commands"
If issues found, provide specific fix instructions.
