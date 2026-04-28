# projectvibe backend (canonical)

`backend/server.js` is the single source of truth for the backend.

> Legacy `api-server.js` has been removed to prevent split behavior and stale API paths.

## Run

```bash
npm install
npm start
```

Then open `http://localhost:8787`.

## Scripts

- `npm start` → runs canonical backend (`backend/server.js`)
- `npm run start:backend` → explicit canonical backend start
- `npm run check` → syntax check for canonical backend

## Environment variables

- `PORT` (default `8787`)
- `PUPIL_01_PIN_HASH`, `PUPIL_02_PIN_HASH`, `PUPIL_03_PIN_HASH` (SHA-256 hashes)
- `TEACHER_PIN_HASH` (SHA-256 hash)
- `MAX_FAILED_ATTEMPTS` (default `5`)
- `LOCKOUT_MS` (default `600000`)
- `GITHUB_TOKEN` (server-side only)
- `GITHUB_REPO` (e.g. `owner/projectvibe`)

Example hash generation:

```bash
node -e "console.log(require('crypto').createHash('sha256').update('1234').digest('hex'))"
```

## API summary (canonical)

Auth:
- `POST /api/auth/login` `{ channel, pin }`
- `GET /api/auth/me`
- `POST /api/auth/logout`

Channel workflow:
- `GET /api/channels/state`
- `POST /api/channels/:channel/request` `{ message }` (requires matching session)
- `POST /api/channels/:channel/status` `{ status }` (teacher session)
- `POST /api/channels/:channel/release` `{ decision }` (teacher session)

GitHub integration:
- `POST /api/github/issues` `{ title, body }` (requires auth + server GitHub config)

## GitHub automation workflows

This repo includes three automation workflows:

- `.github/workflows/agent-on-ready-label.yml`
  - Trigger: issue labeled `ready-for-agent`
  - Actions: runs integration check (`npm run check`), opens an automation PR, and transitions labels.
- `.github/workflows/label-transitions.yml`
  - Trigger: issue/PR events
  - Actions: auto-transitions issue labels `pending-teacher` → `in-progress` → `ready-to-review`.
- `.github/workflows/merge-and-deploy-on-teacher-approval.yml`
  - Trigger: approved PR review by configured teacher account
  - Actions: enables PR auto-merge and optionally triggers deploy webhook.

### Required GitHub configuration

- Repository variable: `TEACHER_GITHUB_LOGIN`
- Optional repository secret: `DEPLOY_WEBHOOK_URL`
