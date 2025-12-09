# Jira Release Compliance Tool

A TypeScript-based validation tool that cross-references Git commits with Jira tickets to ensure release completeness and accuracy.

## Overview

This tool validates and documents releases by:

- **Extracting Jira ticket numbers** from Git commit messages across multiple repositories
- **Fetching ticket details** from Jira API (fix versions, summaries, issue types, subtasks)
- **Validating release completeness** by verifying all tickets marked with a specific fixVersion are included in commits
- **Identifying issues**:
  - Commits without Jira ticket references
  - Tickets with non-matching fixVersions
  - Tickets with HIGHER fixVersions (work from future releases accidentally included)
  - Missing tickets (marked for release in Jira but not in commits)

## Why It Matters

- ✅ **Ensures completeness**: Verifies all planned work made it into the release
- 🚫 **Prevents mistakes**: Catches accidentally included future work or missing implementations
- 📝 **Provides documentation**: Creates a clear record of tickets/features per release
- 🔗 **Maintains traceability**: Links code changes to business requirements
- 📊 **Supports compliance**: Helps prove what was delivered in each version
- 🚦 **Quality gate**: Can be integrated into CI/CD pipelines

---

## Setup

1. **Copy environment template**:

   ```bash
   cp .env.template .env
   ```

2. **Configure `.env` file**:

   ```env
   JIRA_API_DOMAIN=your-domain
   JIRA_API_EMAIL=your-email@example.com
   JIRA_API_TOKEN=your-api-token
   PATHS_TO_PROJECTS=/path/to/project
   ```

   - Get your [JIRA API Token](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/)
   - For multiple repositories: `PATHS_TO_PROJECTS=/path/to/project1,/path/to/project2`

3. **Install dependencies**:
   ```bash
   npm install
   # or
   yarn install
   ```

---

## Usage

Both `--from` and `--to` accept git tags, branches, or commit references (e.g., `v1.13.0`, `HEAD`, `develop`, `main`).

### Single Repository Examples

```bash
# Basic comparison
yarn start --from=3.5.0 --to=release-next --fixVersion=3.6.0

# With ticket keys and URLs
yarn start --from=3.5.0 --to=release-next --fixVersion=3.6.0 --logTickets --logUrls

# Include all details
yarn start --from=3.5.0 --to=release-next --fixVersion=3.6.0 --logTickets --logSummaries --logCommits --logUrls --logAuthors
```

### Multiple Repositories

Specify different version ranges per repository using comma-separated values:

```bash
# Different ranges for each repository
yarn start --from=3.5.0,3.5.2 --to=release-next,main --fixVersion=3.6.0 --logTickets

# Same range for all repositories
yarn start --from=3.5.0 --to=main --fixVersion=3.6.0 --logTickets
```

**Note**: Values are applied to repositories in the order they appear in `PATHS_TO_PROJECTS`.

---

## Command-Line Options

### Required

| Option         | Description                                | Example            |
| -------------- | ------------------------------------------ | ------------------ |
| `--from`       | Starting git tag/branch for comparison     | `--from=v1.0.0`    |
| `--to`         | Ending git tag/branch for comparison       | `--to=v1.1.0`      |
| `--fixVersion` | fixVersion to validate (checks compliance) | `--fixVersion=1.1` |

For multiple repositories, use comma-separated values for `--from` and `--to`: `--from=v1.0.0,v0.9.0`

### Optional

| Option              | Description                                             | Default     |
| ------------------- | ------------------------------------------------------- | ----------- |
| `--logUrls`         | Print URLs of tickets                                   | `true`      |
| `--logTickets`      | Print ticket numbers                                    | `false`     |
| `--logSummaries`    | Print ticket summaries                                  | `false`     |
| `--logCommits`      | Print all commits                                       | `false`     |
| `--logAuthors`      | Print commit authors for commits without ticket numbers | `false`     |
| `--includeSubtasks` | Include subtasks in output                              | `false`     |
| `--excludePattern`  | Regex pattern to exclude commits (case insensitive)     | `(NO-TASK)` |

### Examples with Options

```bash
# Full detail report
yarn start --from=v1.0.0 --to=v1.1.0 \
  --fixVersion=1.1 \
  --logTickets \
  --logSummaries \
  --logCommits \
  --logUrls \
  --includeSubtasks

# Fix version compliance check
yarn start --from=3.5.0 --to=release-next \
  --fixVersion=3.6 \
  --logTickets \
  --logUrls

# Custom exclude pattern
yarn start --from=3.5.0 --to=release-next \
  --fixVersion=3.6 \
  --logTickets \
  --excludePattern="SKIP|IGNORE|NO-TASK"

# Multiple repositories with authors
yarn start --from=3.5.0,3.5.1 --to=release-next \
  --fixVersion=3.6 \
  --logTickets \
  --logUrls \
  --logAuthors
```

### Sample Output

```
================================================================================
🔍 JIRA Release Compliance Check
================================================================================
📍 Version ranges per repository:
  → project1: 3.5.0 → release-next
  → project2: 3.5.1 → release-next
================================================================================

✓ Found 58 unique ticket(s) in 124 commit(s)

📝 All commits:
--------------------------------------------------------------------------------
  a1b2c3d  [project1]  SMPL-1234 Fix login issue
  e4f5g6h  [project1]  SMPL-1235 Update user profile
  i7j8k9l  [project2]  SMPL-1236 Add new feature
  ...

⚠ 3 commit(s) without tickets:
--------------------------------------------------------------------------------
  m0n1o2p  [project1]  Update dependencies (John Doe)
  q3r4s5t  [project2]  Fix typo in documentation (Jane Smith)
  ...

🔍 Checking fixVersion compliance: 3.6.0
--------------------------------------------------------------------------------
  Total tasks with fixVersion "3.6.0": 45
  ✓ Found in commits: 44
  ✗ Missing from commits: 1

⚠️  WARNING: 1 task(s) with fixVersion "3.6.0" are NOT in commits
--------------------------------------------------------------------------------
  3.6.0 [Story] SMPL-9990 Feature not yet committed
    → SMPL-9998 [Subtask] Implement backend

❌ ERROR: 58 task(s) found in commits with non matching fixVersion (1 with HIGHER version):
--------------------------------------------------------------------------------
  3.6 [Story] SMPL-2494 Implement new feature https://your-domain.atlassian.net/browse/SMPL-2494
  3.3 [Task] SMPL-2479 Bug fix https://your-domain.atlassian.net/browse/SMPL-2479
  --- [Story] SMPL-1800 Legacy feature https://your-domain.atlassian.net/browse/SMPL-1800
    → SMPL-1800-1 [Subtask] Update tests
  ...

================================================================================
✓ Complete
================================================================================
```
