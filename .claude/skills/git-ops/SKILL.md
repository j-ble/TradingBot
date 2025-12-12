---
name: git-ops
description: Local Git repository management for version control, branch operations, and commit history analysis. Use for pre-commit validation and local repository workflows.
---

# Git Operations Skill

## When to Use This Skill

Trigger this skill when you need to:
- Check working tree status before commits
- Inspect staged/unstaged changes
- View commit history and diffs
- Create and switch branches locally
- Stage files and create commits
- Analyze commit contents

## Available Tools

### Repository Status
- `git_status` - Show working tree status (modified, staged, untracked files)
- `git_diff` - Show differences between branches or commits
- `git_diff_staged` - Show changes staged for commit
- `git_diff_unstaged` - Show unstaged changes in working directory

### Branch Management
- `git_create_branch` - Create new branch from optional base branch
- `git_checkout` - Switch branches

### Staging & Committing
- `git_add` - Stage files for commit
- `git_commit` - Record changes to repository
- `git_reset` - Unstage all staged changes

### History & Inspection
- `git_log` - View commit history (configurable max count)
- `git_show` - Show contents of a specific commit
- `git_init` - Initialize new Git repository

## Trading Bot Use Cases

### Pre-Commit Workflow
```
Before committing code:
1. git_status - Check what files changed
2. git_diff_unstaged - Review changes
3. git_add - Stage files: ["lib/scanners/4h_scanner.js"]
4. git_diff_staged - Verify staged changes
5. git_commit - Create commit with message

Pro Tip: Always review diffs before committing
```

### Feature Branch Workflow
```
Creating a new feature:
1. git_status - Ensure clean working directory
2. git_create_branch - Create "feature/trailing-stops" from "main"
3. git_checkout - Switch to new branch
4. [Make changes]
5. git_add, git_commit
```

### Inspecting Changes
```
Review recent changes:
1. git_log - View last 10 commits
2. git_show - Inspect specific commit by SHA
3. git_diff - Compare current branch with main

Useful for understanding recent modifications
```

## Best Practices

1. **Always Review**: Use `git_diff` before `git_add`
2. **Meaningful Messages**: Write clear commit messages explaining "why" not "what"
3. **Small Commits**: Commit related changes together, but keep commits focused
4. **Clean Status**: Check `git_status` frequently
5. **Branch Strategy**: Use feature branches for new features

## Limitations & Notes

- **Local Only**: These tools operate on local repository only
- **No Remote Ops**: For push/pull, use system `git` commands via Bash tool
- **No Authentication**: No credentials required (local operations)
- **Repo Path Required**: Must specify repo path for each operation

## Example Workflows

### Commit New Trading Feature
```
Scenario: Added FVG detection logic

1. git_status
   Output: Modified: lib/scanners/fvg_detector.js
           Untracked: tests/fvg_detector.test.js

2. git_diff_unstaged
   Review changes to ensure quality

3. git_add
   files: ["lib/scanners/fvg_detector.js", "tests/fvg_detector.test.js"]

4. git_commit
   message: "Add Fair Value Gap detection with 3-candle pattern

   Implements FVG scanner that:
   - Detects bullish/bearish gaps >0.1% of price
   - Tracks gap fill events
   - Integrates with confluence state machine"

5. git_log (max_count: 5)
   Verify commit appears in history
```

### Switch to Bugfix Branch
```
Scenario: Need to fix stop loss calculation bug

1. git_status
   Ensure clean working directory (no uncommitted changes)

2. git_create_branch
   branch_name: "bugfix/stop-loss-calculation"
   base_branch: "main"

3. git_checkout
   branch_name: "bugfix/stop-loss-calculation"

4. [Fix the bug]

5. git_add, git_commit, then use GitHub tools for PR
```

## Integration with GitHub Skill

Git operations work in tandem with github-integration skill:
- **Local**: Use git-ops for local changes, branches, commits
- **Remote**: Use github-integration for push, PR creation, merging

## Security & Best Practices

- **No Credentials in Commits**: Check diffs for sensitive data before committing
- **.gitignore**: Ensure `.env`, API keys, and config files are ignored
- **Review Diffs**: Always inspect changes before staging
- **Commit Message Quality**: Follow project conventions (see CLAUDE.md)

## Related Skills

See also:
- **github-integration** skill for remote operations and PRs
- **mcp-management** skill for git-related MCP servers

---

**Auto-loaded**: Yes (essential for version control)
**Token Impact**: ~5k tokens (included in startup context)
**Scope**: Local repository operations only
**Note**: For remote operations (push/pull), use Bash tool with git commands
