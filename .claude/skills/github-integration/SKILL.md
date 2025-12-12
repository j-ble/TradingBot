---
name: github-integration
description: Comprehensive GitHub API access for repository management, pull requests, issues, code search, and team collaboration. Use when working with GitHub repositories or searching for code examples.
---

# GitHub Integration Skill

## When to Use This Skill

Trigger this skill when you need to:
- Create or manage GitHub repositories, branches, or files
- Work with pull requests (create, review, merge)
- Track issues and project management
- Search for code examples or implementations across GitHub
- Manage releases, tags, and commits
- Collaborate with teams

## Available Tool Categories

### Repository Management
- `create_repository`, `fork_repository`, `create_branch`, `list_branches`
- `get_file_contents`, `create_or_update_file`, `delete_file`, `push_files`
- `search_repositories` - Find repos by name, description, topics, stars, language

### Issues & Project Management
- `issue_read`, `issue_write`, `search_issues`, `list_issues`
- `add_issue_comment`, `sub_issue_write`, `get_label`
- `assign_copilot_to_issue` - Assign GitHub Copilot to work on issues

### Pull Requests
- `create_pull_request`, `list_pull_requests`, `search_pull_requests`
- `pull_request_read` - Get PR details, diff, status, files, comments, reviews
- `update_pull_request`, `merge_pull_request`
- `pull_request_review_write`, `add_comment_to_pending_review`
- `request_copilot_review` - Request automated code review

### Code Search & History
- `search_code` - Fast, precise code search across ALL GitHub repositories
- `search_users` - Find users by username, location, followers
- `list_commits`, `get_commit` - Commit history with diffs and stats
- `list_tags`, `get_tag`, `list_releases`, `get_latest_release`

### Account & Teams
- `get_me` - Get authenticated user details
- `get_teams`, `get_team_members` - Team collaboration

## Common Trading Bot Use Cases

### Code Reviews & Quality
```
When implementing new trading features:
1. Create feature branch: create_branch
2. Push code: push_files (batch upload)
3. Create PR: create_pull_request
4. Request review: request_copilot_review
5. Merge: merge_pull_request
```

### Finding Code Examples
```
To learn how others implement similar features:
- search_code with query: "liquidity sweep detection language:python"
- search_repositories for trading bot projects
- get_file_contents to read implementation details
```

### Issue Tracking
```
Track bugs and features:
- issue_write to create new issues
- add_issue_comment for updates
- sub_issue_write to break down complex features
- assign_copilot_to_issue for AI assistance
```

## Best Practices

1. **Batch Operations**: Use `push_files` instead of multiple `create_or_update_file` calls
2. **Search Before Creating**: Use `search_code` to find existing solutions
3. **Progressive PR Reviews**: Request Copilot review before human review
4. **Meaningful Commits**: Group related changes in single commits
5. **Rate Limits**: Be mindful of GitHub API rate limits (5000 requests/hour for authenticated)

## Security Notes

- GitHub tools access both public and private repositories (if authenticated)
- Never commit API keys or credentials
- Use `.gitignore` for sensitive files (`.env`, `config.json`)
- Review diffs before merging PRs

## Related Skills

See also:
- **git-ops** skill for local repository operations
- **mcp-management** skill for loading additional GitHub-related tools

---

**Auto-loaded**: Yes (essential for trading bot development)
**Token Impact**: ~40k tokens (included in startup context)
