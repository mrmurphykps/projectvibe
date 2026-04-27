# Project Vibe MVP

A teacher-controlled classroom coding request system for three pupils.

This repository is being set up as a GitHub Pages MVP.

## Submission API

This repo now includes a lightweight Node server with:

- `POST /api/submit` to accept pupil submissions.
- `GET /api/submissions` to return audit metadata for the teacher panel.

### `POST /api/submit`

Request body:

```json
{
  "channelId": "pupil-01",
  "message": "Please add a button that changes the page color.",
  "sessionToken": "1234"
}
```

Behavior:

- Validates `channelId` format and session token against channel-specific auth.
- Sanitizes `message` before processing.
- Creates a GitHub Issue in `projectvibe/projectvibe` with labels:
  - `<channelId>` (example `pupil-01`)
  - `pending-teacher`
- Uses title format: `[pupil-01] Request: <short summary>`.
- Includes full prompt in the issue body.
- Writes audit metadata to `data/submission-audit.json`:
  - `timestamp`
  - `channelId`
  - `issueUrl`

### Environment variables

- `GITHUB_TOKEN` (required): GitHub token with issue write access.
- `GITHUB_OWNER` (optional): defaults to `projectvibe`.
- `GITHUB_REPO` (optional): defaults to `projectvibe`.
- `CHANNEL_SESSION_TOKENS` (optional JSON map):

```json
{"pupil-01":"1234","pupil-02":"2345","pupil-03":"3456"}
```

### Run locally

```bash
npm start
```

Server defaults to port `3000` (override with `PORT`).

## Agent workflow, review gates, and release flow

This repo now includes GitHub Actions automation for issue→PR→release:

1. **Issue label triggers agent run**
   - Label an issue with `ready-for-agent`.
   - Workflow: `.github/workflows/agent-on-labeled-issue.yml`
   - It will:
     - move issue label state to `in-progress`
     - run Codex against the issue
     - push changes on a new `agent/issue-...` branch
     - open a PR
     - move issue label state to `ready-to-review`

2. **Teacher review is required before merge**
   - Workflow: `.github/workflows/teacher-review-gate.yml`
   - Set repository variable `TEACHER_GITHUB_USERS` to a comma-separated list (example: `teacher1,teacher2`).
   - Then set branch protection on `main` to require status check **Teacher review gate / require-teacher-approval**.

3. **Post-merge issue release label**
   - Workflow: `.github/workflows/release-label-on-merge.yml`
   - When a merged PR body includes `Closes #<issue>`, linked issues are labeled `released`.

4. **Automatic Pages deployment after merge**
   - Workflow: `.github/workflows/pages-deploy.yml`
   - Pushes to `main` trigger a GitHub Pages deploy automatically.

### Label/state lifecycle

- `pending-teacher` → initial submission state
- `ready-for-agent` → teacher-approved for automation
- `in-progress` → agent execution running
- `ready-to-review` → PR opened and waiting on teacher review
- `released` → merged and deployed
