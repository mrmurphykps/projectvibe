# projectvibe MVP backend

Lightweight Node/Express backend for PIN authentication with security controls.

## Security properties implemented

- Stores only SHA-256 hashed PINs for `pupil-01`, `pupil-02`, `pupil-03`.
- Never stores or returns plaintext PINs.
- Per-IP failed-attempt tracking over a rolling 10-minute window.
- Per-channel failed-attempt tracking over a rolling 10-minute window.
- Temporary lockouts when failures exceed the threshold.
- Short-lived sessions via HTTP-only cookies after successful auth.
- GitHub token is read only from server environment variables and used only server-side.

## Run

```bash
npm install
npm start
```

Then open `http://localhost:8787`.

## Environment variables

- `PORT` (default `8787`)
- `PUPIL_01_PIN_HASH`, `PUPIL_02_PIN_HASH`, `PUPIL_03_PIN_HASH` (SHA-256 hashes)
- `MAX_FAILED_ATTEMPTS` (default `5`)
- `LOCKOUT_MS` (default `600000`)
- `GITHUB_TOKEN` (server-side only)
- `GITHUB_REPO` (e.g. `owner/projectvibe`)

Example hash generation:

```bash
node -e "console.log(require('crypto').createHash('sha256').update('1234').digest('hex'))"
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
