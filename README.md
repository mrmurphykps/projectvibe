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

## API summary

- `POST /api/auth/login` `{ channel, pin }`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/github/issues` `{ title, body }` (requires auth + server GitHub config)
