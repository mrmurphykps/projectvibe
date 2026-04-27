#!/usr/bin/env node
const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'projectvibe';
const GITHUB_REPO = process.env.GITHUB_REPO || 'projectvibe';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const CHANNEL_SESSION_TOKENS = parseJsonMap(process.env.CHANNEL_SESSION_TOKENS, {
  'pupil-01': 'replace-me'
});

const AUDIT_FILE = path.join(__dirname, 'data', 'submission-audit.json');

function parseJsonMap(raw, fallback) {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function safeEquals(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function sanitizeMessage(message) {
  return String(message)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000);
}

function createSummary(message) {
  const trimmed = message.slice(0, 120);
  return trimmed.length < message.length ? `${trimmed}...` : trimmed;
}

async function readJsonBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1_000_000) {
      throw new Error('Request body too large');
    }
  }
  return JSON.parse(body || '{}');
}

async function createGithubIssue(channelId, message) {
  if (!GITHUB_TOKEN) {
    throw new Error('Missing GITHUB_TOKEN');
  }

  const summary = createSummary(message);
  const issueTitle = `[${channelId}] Request: ${summary}`;
  const issueBody = [
    `Channel: ${channelId}`,
    '',
    'Full prompt:',
    '',
    message
  ].join('\n');

  const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`, {
    method: 'POST',
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'projectvibe-submit-api',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: issueTitle,
      body: issueBody,
      labels: [channelId, 'pending-teacher']
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub issue creation failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

async function appendAuditRecord(record) {
  await fs.mkdir(path.dirname(AUDIT_FILE), { recursive: true });

  let existing = [];
  try {
    const raw = await fs.readFile(AUDIT_FILE, 'utf8');
    existing = JSON.parse(raw);
    if (!Array.isArray(existing)) existing = [];
  } catch {
    existing = [];
  }

  existing.push(record);
  await fs.writeFile(AUDIT_FILE, JSON.stringify(existing, null, 2));
}

async function getAuditRecords() {
  try {
    const raw = await fs.readFile(AUDIT_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isAuthorizedChannel(channelId, sessionToken) {
  const expectedToken = CHANNEL_SESSION_TOKENS[channelId];
  if (!expectedToken) return false;
  return safeEquals(expectedToken, sessionToken);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (req.method === 'POST' && url.pathname === '/api/submit') {
    try {
      const body = await readJsonBody(req);
      const channelId = String(body.channelId || '').trim();
      const sessionToken = String(body.sessionToken || '');
      const sanitizedMessage = sanitizeMessage(body.message || '');

      if (!/^pupil-\d{2}$/.test(channelId)) {
        return sendJson(res, 400, { error: 'Invalid channelId format' });
      }

      if (!sessionToken) {
        return sendJson(res, 401, { error: 'Missing session token' });
      }

      if (!isAuthorizedChannel(channelId, sessionToken)) {
        return sendJson(res, 403, { error: 'Channel authorization failed' });
      }

      if (!sanitizedMessage) {
        return sendJson(res, 400, { error: 'Message is required' });
      }

      const issue = await createGithubIssue(channelId, sanitizedMessage);
      const auditRecord = {
        timestamp: new Date().toISOString(),
        channelId,
        issueUrl: issue.html_url
      };

      await appendAuditRecord(auditRecord);
      return sendJson(res, 201, {
        ok: true,
        issueUrl: issue.html_url,
        audit: auditRecord
      });
    } catch (error) {
      return sendJson(res, 500, { error: error.message || 'Unknown server error' });
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/submissions') {
    const records = await getAuditRecords();
    return sendJson(res, 200, { submissions: records });
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`Submit API listening on port ${PORT}`);
});
