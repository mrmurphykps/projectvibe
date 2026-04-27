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
