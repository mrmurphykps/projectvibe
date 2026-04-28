import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

const PORT = process.env.PORT || 8787;
const SESSION_TTL_MS = 15 * 60 * 1000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = Number(process.env.MAX_FAILED_ATTEMPTS || 5);
const LOCKOUT_MS = Number(process.env.LOCKOUT_MS || 10 * 60 * 1000);
const SESSION_COOKIE = 'pv_session';
const STATUS_ORDER = ['submitted', 'processing', 'ready', 'released'];
const CHANNELS = ['pupil-01', 'pupil-02', 'pupil-03'];
const TEACHER_ACCOUNT = 'teacher';
const RELEASE_DECISIONS = ['approve', 'hold'];
const STATE_FILE = path.resolve('data/channel-state.json');

// SHA-256 hashes only; no plaintext PINs are stored.
const PIN_HASHES = {
  'pupil-01': process.env.PUPIL_01_PIN_HASH || '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
  'pupil-02': process.env.PUPIL_02_PIN_HASH || 'fe2592b42a727cd5f2f7a8c36b9f3b5978a5d4b0e0f7f5f6764f2f3f2fbf59cf',
  'pupil-03': process.env.PUPIL_03_PIN_HASH || 'b59c67bf196a4758191e42f76670ceba34a8062bda8d3f9f0f4a5f09f5f6f87f',
  [TEACHER_ACCOUNT]: process.env.TEACHER_PIN_HASH || '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4'
};

const sessions = new Map();
const failuresByIp = new Map();
const failuresByChannel = new Map();
const lockoutsByIp = new Map();
const lockoutsByChannel = new Map();

const getIp = (req) => req.headers['cf-connecting-ip'] || req.ip || 'unknown';

const now = () => Date.now();

const hashPin = (pin) => crypto.createHash('sha256').update(String(pin)).digest('hex');

function getInitialChannelState() {
  return {
    channels: {
      'pupil-01': { status: 'submitted', submissions: [], release: { decision: 'hold', approvedRequestId: null } },
      'pupil-02': { status: 'submitted', submissions: [], release: { decision: 'hold', approvedRequestId: null } },
      'pupil-03': { status: 'submitted', submissions: [], release: { decision: 'hold', approvedRequestId: null } }
    }
  };
}

async function readChannelState() {
  try {
    const raw = await fs.readFile(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const initial = getInitialChannelState();

    for (const channel of CHANNELS) {
      const incoming = parsed?.channels?.[channel] || {};
      initial.channels[channel].status = STATUS_ORDER.includes(incoming.status)
        ? incoming.status
        : initial.channels[channel].status;
      initial.channels[channel].submissions = Array.isArray(incoming.submissions)
        ? incoming.submissions
        : [];
      const decision = incoming?.release?.decision;
      initial.channels[channel].release.decision = RELEASE_DECISIONS.includes(decision)
        ? decision
        : 'hold';
      initial.channels[channel].release.approvedRequestId = incoming?.release?.approvedRequestId || null;
    }

    return initial;
  } catch {
    return getInitialChannelState();
  }
}

async function writeChannelState(state) {
  await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
  await fs.writeFile(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function pruneFailures(record) {
  const cutoff = now() - RATE_WINDOW_MS;
  record.attempts = record.attempts.filter((ts) => ts >= cutoff);
}

function registerFailure(map, key) {
  const record = map.get(key) || { attempts: [] };
  record.attempts.push(now());
  pruneFailures(record);
  map.set(key, record);
  return record.attempts.length;
}

function clearFailures(map, key) {
  map.delete(key);
}

function maybeSetLockout(lockoutMap, key, failures) {
  if (failures >= MAX_FAILED_ATTEMPTS) {
    lockoutMap.set(key, now() + LOCKOUT_MS);
  }
}

function getLockoutRemainingMs(lockoutMap, key) {
  const until = lockoutMap.get(key);
  if (!until) return 0;
  if (until <= now()) {
    lockoutMap.delete(key);
    return 0;
  }
  return until - now();
}

function requireSession(req, res, next) {
  const token = req.cookies[SESSION_COOKIE];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const session = sessions.get(token);
  if (!session || session.expiresAt <= now()) {
    sessions.delete(token);
    res.clearCookie(SESSION_COOKIE);
    return res.status(401).json({ error: 'Session expired' });
  }

  req.session = session;
  return next();
}

function requireSessionChannelMatch(req, res, next) {
  if (req.session.channel !== req.params.channel) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  return next();
}

function requireTeacherSession(req, res, next) {
  if (req.session.channel !== TEACHER_ACCOUNT) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  return next();
}

app.get(['/pupil-01', '/pupil-02', '/pupil-03'], (_req, res) => {
  res.sendFile('pupil.html', { root: 'public' });
});

app.get('/teacher', (_req, res) => {
  res.sendFile('teacher.html', { root: 'public' });
});

app.get('/api/channels/state', async (_req, res) => {
  const state = await readChannelState();
  res.json(state);
});

app.post('/api/channels/:channel/request', requireSession, requireSessionChannelMatch, async (req, res) => {
  const { channel } = req.params;
  const { message } = req.body || {};

  if (!CHANNELS.includes(channel)) {
    return res.status(400).json({ error: 'Unknown channel' });
  }

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const state = await readChannelState();
  const requestId = crypto.randomUUID();

  state.channels[channel].submissions.unshift({
    id: requestId,
    message: message.trim(),
    submittedAt: new Date().toISOString()
  });
  state.channels[channel].status = 'submitted';
  state.channels[channel].release.decision = 'hold';

  await writeChannelState(state);
  return res.json({ ok: true, requestId });
});

app.post('/api/channels/:channel/status', requireSession, requireTeacherSession, async (req, res) => {
  const { channel } = req.params;
  const { status } = req.body || {};

  if (!CHANNELS.includes(channel)) {
    return res.status(400).json({ error: 'Unknown channel' });
  }
  if (!STATUS_ORDER.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const state = await readChannelState();
  state.channels[channel].status = status;
  await writeChannelState(state);
  return res.json({ ok: true });
});

app.post('/api/channels/:channel/release', requireSession, requireTeacherSession, async (req, res) => {
  const { channel } = req.params;
  const { decision } = req.body || {};

  if (!CHANNELS.includes(channel)) {
    return res.status(400).json({ error: 'Unknown channel' });
  }
  if (!RELEASE_DECISIONS.includes(decision)) {
    return res.status(400).json({ error: 'Invalid decision' });
  }

  const state = await readChannelState();
  const latest = state.channels[channel].submissions[0] || null;

  state.channels[channel].release.decision = decision;
  state.channels[channel].release.approvedRequestId = decision === 'approve' ? latest?.id || null : null;

  await writeChannelState(state);
  return res.json({ ok: true });
});

app.post('/api/auth/login', (req, res) => {
  const { channel, pin } = req.body || {};
  const ip = getIp(req);

  if (!PIN_HASHES[channel]) {
    return res.status(400).json({ error: 'Unknown channel' });
  }

  const ipLockout = getLockoutRemainingMs(lockoutsByIp, ip);
  const channelLockout = getLockoutRemainingMs(lockoutsByChannel, channel);
  if (ipLockout > 0 || channelLockout > 0) {
    const retryAfterMs = Math.max(ipLockout, channelLockout);
    return res.status(429).json({
      error: 'Temporarily locked out',
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000)
    });
  }

  const submittedHash = hashPin(pin || '');
  const valid = crypto.timingSafeEqual(
    Buffer.from(submittedHash, 'hex'),
    Buffer.from(PIN_HASHES[channel], 'hex')
  );

  if (!valid) {
    const ipFailures = registerFailure(failuresByIp, ip);
    const channelFailures = registerFailure(failuresByChannel, channel);
    maybeSetLockout(lockoutsByIp, ip, ipFailures);
    maybeSetLockout(lockoutsByChannel, channel, channelFailures);

    return res.status(401).json({ error: 'Invalid credentials' });
  }

  clearFailures(failuresByIp, ip);
  clearFailures(failuresByChannel, channel);
  lockoutsByIp.delete(ip);
  lockoutsByChannel.delete(channel);

  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    channel,
    ip,
    createdAt: now(),
    expiresAt: now() + SESSION_TTL_MS
  });

  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: SESSION_TTL_MS,
    path: '/'
  });

  return res.json({ ok: true, channel, expiresInSeconds: SESSION_TTL_MS / 1000 });
});

app.post('/api/auth/logout', requireSession, (req, res) => {
  const token = req.cookies[SESSION_COOKIE];
  sessions.delete(token);
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireSession, (req, res) => {
  res.json({ channel: req.session.channel, expiresAt: req.session.expiresAt });
});

app.post('/api/github/issues', requireSession, async (req, res) => {
  const githubToken = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;

  if (!githubToken || !repo) {
    return res.status(500).json({ error: 'Server-side GitHub integration not configured' });
  }

  const { title, body } = req.body || {};
  const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title,
      body,
      labels: [req.session.channel, 'pupil-request']
    })
  });

  if (!response.ok) {
    const text = await response.text();
    return res.status(502).json({ error: 'GitHub issue creation failed', details: text });
  }

  const data = await response.json();
  return res.json({ ok: true, issueUrl: data.html_url, issueNumber: data.number });
});

app.listen(PORT, () => {
  console.log(`projectvibe backend listening on :${PORT}`);
});
