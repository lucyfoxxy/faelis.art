import http from 'node:http';
import { createHmac, createHash, randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import nodemailer from 'nodemailer';

const config = {
  host: process.env.GUESTBOOK_HOST || '127.0.0.1',
  port: intEnv('GUESTBOOK_PORT', 8787),
  dbPath: process.env.GUESTBOOK_DB || '/srv/faelis.art/data/guestbook.sqlite',
  publicOrigin: trimOrigin(process.env.GUESTBOOK_PUBLIC_ORIGIN || 'https://faelis.art'),
  ipSecret: process.env.GUESTBOOK_IP_SECRET || '',
  mailMode: process.env.GUESTBOOK_MAIL_MODE || 'smtp',
  moderationTo: process.env.GUESTBOOK_MODERATION_TO || '',
  mailFrom: process.env.GUESTBOOK_MAIL_FROM || 'Faelis Guestbook <guestbook@faelis.art>',
  rateLimit: intEnv('GUESTBOOK_RATE_LIMIT', 5),
  rateWindowSeconds: intEnv('GUESTBOOK_RATE_WINDOW_SECONDS', 3600),
  minFillMs: intEnv('GUESTBOOK_MIN_FILL_MS', 1500),
};

if (!config.ipSecret || config.ipSecret === 'change-me') {
  throw new Error('GUESTBOOK_IP_SECRET must be configured');
}
if (!['smtp', 'log'].includes(config.mailMode)) {
  throw new Error('GUESTBOOK_MAIL_MODE must be "smtp" or "log"');
}
if (config.mailMode === 'smtp' && !config.moderationTo) {
  throw new Error('GUESTBOOK_MODERATION_TO must be configured');
}

mkdirSync(dirname(config.dbPath), { recursive: true });
const db = new DatabaseSync(config.dbPath);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS guestbook_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    message TEXT NOT NULL,
    website TEXT,
    private_message TEXT,
    contact TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
    moderation_token_hash TEXT UNIQUE,
    ip_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    moderated_at INTEGER,
    approved_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS guestbook_entries_public_idx
    ON guestbook_entries(status, approved_at DESC, id DESC);
  CREATE INDEX IF NOT EXISTS guestbook_entries_rate_idx
    ON guestbook_entries(ip_hash, created_at DESC);
`);

const mailer = config.mailMode === 'smtp' ? nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: intEnv('SMTP_PORT', 25),
  secure: boolEnv('SMTP_SECURE', false),
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS || '',
  } : undefined,
}) : null;

const publicListStmt = db.prepare(`
  SELECT public_id, name, message, website, approved_at
  FROM guestbook_entries
  WHERE status = 'approved'
  ORDER BY approved_at DESC, id DESC
  LIMIT ?
`);
const rateStmt = db.prepare(`
  SELECT COUNT(*) AS count
  FROM guestbook_entries
  WHERE ip_hash = ? AND created_at >= ?
`);
const insertStmt = db.prepare(`
  INSERT INTO guestbook_entries (
    public_id, name, message, website, private_message, contact,
    moderation_token_hash, ip_hash, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const pendingByTokenStmt = db.prepare(`
  SELECT id, public_id, name, message, website, private_message, contact, created_at
  FROM guestbook_entries
  WHERE moderation_token_hash = ? AND status = 'pending'
`);
const approveStmt = db.prepare(`
  UPDATE guestbook_entries
  SET status = 'approved', moderated_at = ?, approved_at = ?, moderation_token_hash = NULL
  WHERE id = ? AND status = 'pending'
`);
const rejectStmt = db.prepare(`
  UPDATE guestbook_entries
  SET status = 'rejected', moderated_at = ?, moderation_token_hash = NULL,
      private_message = NULL, contact = NULL
  WHERE id = ? AND status = 'pending'
`);
const deleteStmt = db.prepare("DELETE FROM guestbook_entries WHERE id = ? AND status = 'pending'");

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, { ok: true });
    }
    if (url.pathname === '/api/guestbook' && req.method === 'GET') {
      return listEntries(url, res);
    }
    if (url.pathname === '/api/guestbook' && req.method === 'POST') {
      return await createEntry(req, res);
    }

    const match = url.pathname.match(/^\/api\/guestbook\/moderate\/([A-Za-z0-9_-]{20,})$/);
    if (match && req.method === 'GET') {
      return moderationPage(match[1], res);
    }
    if (match && req.method === 'POST') {
      return await moderateEntry(match[1], req, res);
    }

    return json(res, 404, { error: 'not_found' });
  } catch (error) {
    console.error('[guestbook]', error);
    if (!res.headersSent) json(res, error.status || 500, { error: error.code || 'internal_error' });
    else res.end();
  }
});

server.listen(config.port, config.host, () => {
  console.log(`[guestbook] listening on http://${config.host}:${config.port}`);
  console.log(`[guestbook] database: ${config.dbPath}`);
});

function listEntries(url, res) {
  const limit = clamp(Number.parseInt(url.searchParams.get('limit') || '30', 10), 1, 50);
  const entries = publicListStmt.all(limit).map((row) => ({
    id: row.public_id,
    name: row.name,
    message: row.message,
    website: row.website || null,
    approvedAt: new Date(row.approved_at * 1000).toISOString(),
  }));
  return json(res, 200, { entries });
}

async function createEntry(req, res) {
  const body = await readBody(req, 16 * 1024);
  const data = parseBody(req, body);

  if (clean(data.company, 200)) {
    return json(res, 202, { ok: true, status: 'pending' });
  }

  const startedAt = Number(data.startedAt || data.started_at || 0);
  if (!Number.isFinite(startedAt) || startedAt <= 0 || Date.now() - startedAt < config.minFillMs) {
    return json(res, 400, { error: 'too_fast', message: 'Please take a moment before submitting.' });
  }

  const name = required(data.name, 'name', 60);
  const message = required(data.message, 'message', 2000);
  const privateMessage = optional(data.privateMessage ?? data.private_message, 2000);
  const contact = optional(data.contact, 320);
  const website = normalizeWebsite(optional(data.website, 500));
  const now = Math.floor(Date.now() / 1000);
  const ipHash = hashIp(clientIp(req));
  const since = now - config.rateWindowSeconds;
  const recent = Number(rateStmt.get(ipHash, since)?.count || 0);

  if (recent >= config.rateLimit) {
    return json(res, 429, { error: 'rate_limited', message: 'Too many entries. Please try again later.' });
  }

  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const publicId = randomBytes(9).toString('base64url');
  const result = insertStmt.run(
    publicId, name, message, website, privateMessage, contact,
    tokenHash, ipHash, now,
  );

  try {
    await sendModerationMail({ name, message, website, privateMessage, contact, token, createdAt: now });
  } catch (error) {
    deleteStmt.run(result.lastInsertRowid);
    console.error('[guestbook.mail]', error);
    return json(res, 503, { error: 'mail_unavailable', message: 'Could not submit the entry right now.' });
  }

  return json(res, 202, { ok: true, status: 'pending' });
}

function moderationPage(token, res) {
  const entry = pendingByTokenStmt.get(hashToken(token));
  if (!entry) {
    return html(res, 404, moderationShell('Link unavailable', '<p>This moderation link is invalid or has already been used.</p>'));
  }

  const body = `
    <h1>Guestbook moderation</h1>
    <dl>
      <dt>Name</dt><dd>${escapeHtml(entry.name)}</dd>
      <dt>Public message</dt><dd>${nl2br(entry.message)}</dd>
      ${entry.website ? `<dt>Website</dt><dd>${escapeHtml(entry.website)}</dd>` : ''}
      ${entry.private_message ? `<dt>Private message</dt><dd>${nl2br(entry.private_message)}</dd>` : ''}
      ${entry.contact ? `<dt>Contact</dt><dd>${escapeHtml(entry.contact)}</dd>` : ''}
    </dl>
    <div class="actions">
      <form method="post"><button name="action" value="approve" class="approve">Approve</button></form>
      <form method="post"><button name="action" value="reject" class="reject">Reject</button></form>
    </div>`;
  return html(res, 200, moderationShell(`Moderate ${entry.name}`, body));
}

async function moderateEntry(token, req, res) {
  const entry = pendingByTokenStmt.get(hashToken(token));
  if (!entry) {
    return html(res, 404, moderationShell('Link unavailable', '<p>This moderation link is invalid or has already been used.</p>'));
  }

  const body = await readBody(req, 4 * 1024);
  const data = parseBody(req, body);
  const now = Math.floor(Date.now() / 1000);

  if (data.action === 'approve') {
    approveStmt.run(now, now, entry.id);
    return html(res, 200, moderationShell('Approved', `<h1>Approved 💜</h1><p>${escapeHtml(entry.name)} is now visible in the guestbook.</p>`));
  }
  if (data.action === 'reject') {
    rejectStmt.run(now, entry.id);
    return html(res, 200, moderationShell('Rejected', '<h1>Rejected</h1><p>The entry was rejected. Private message and contact data were discarded.</p>'));
  }
  return html(res, 400, moderationShell('Invalid action', '<p>Unknown moderation action.</p>'));
}

async function sendModerationMail(entry) {
  const link = `${config.publicOrigin}/api/guestbook/moderate/${entry.token}`;
  const text = [
    'New Faelis guestbook entry', '',
    `Name: ${entry.name}`,
    `Created: ${new Date(entry.createdAt * 1000).toISOString()}`,
    entry.website ? `Website: ${entry.website}` : null,
    '', 'PUBLIC:', entry.message,
    entry.privateMessage ? `\nPRIVATE:\n${entry.privateMessage}` : null,
    entry.contact ? `\nCONTACT:\n${entry.contact}` : null,
    '', `Moderate: ${link}`,
  ].filter((line) => line !== null).join('\n');

  if (config.mailMode === 'log') {
    console.log(`\n[guestbook.mail:log]\n${text}\n`);
    return;
  }

  await mailer.sendMail({
    from: config.mailFrom,
    to: config.moderationTo,
    subject: `Guestbook: ${entry.name}`,
    text,
    html: `
      <h2>New Faelis guestbook entry</h2>
      <p><strong>Name:</strong> ${escapeHtml(entry.name)}</p>
      ${entry.website ? `<p><strong>Website:</strong> ${escapeHtml(entry.website)}</p>` : ''}
      <h3>Public</h3><p>${nl2br(entry.message)}</p>
      ${entry.privateMessage ? `<h3>Private</h3><p>${nl2br(entry.privateMessage)}</p>` : ''}
      ${entry.contact ? `<h3>Contact</h3><p>${escapeHtml(entry.contact)}</p>` : ''}
      <p><a href="${escapeHtml(link)}">Open moderation page</a></p>
      <p><small>The link only opens a confirmation page. Approval/rejection requires a POST from there.</small></p>`,
  });
}

function parseBody(req, body) {
  const type = String(req.headers['content-type'] || '').split(';', 1)[0].trim();
  if (type === 'application/json') {
    try { return JSON.parse(body || '{}'); }
    catch { throw httpError(400, 'invalid_json'); }
  }
  if (type === 'application/x-www-form-urlencoded') {
    return Object.fromEntries(new URLSearchParams(body));
  }
  throw httpError(415, 'unsupported_media_type');
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(httpError(413, 'payload_too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function required(value, field, max) {
  const out = clean(value, max);
  if (!out) throw httpError(400, `${field}_required`);
  if (String(value ?? '').trim().length > max) throw httpError(400, `${field}_too_long`);
  return out;
}
function optional(value, max) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (raw.length > max) throw httpError(400, 'field_too_long');
  return raw;
}
function clean(value, max) {
  return String(value ?? '').trim().slice(0, max);
}
function normalizeWebsite(value) {
  if (!value) return null;
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  let url;
  try { url = new URL(candidate); }
  catch { throw httpError(400, 'website_invalid'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw httpError(400, 'website_invalid');
  return url.toString();
}
function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',').at(-1)?.trim();
  return forwarded || req.socket.remoteAddress || 'unknown';
}
function hashIp(ip) {
  return createHmac('sha256', config.ipSecret).update(ip).digest('hex');
}
function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}
function intEnv(name, fallback) {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function boolEnv(name, fallback) {
  const value = process.env[name];
  if (value == null || value === '') return fallback;
  return /^(1|true|yes|on)$/i.test(value);
}
function trimOrigin(value) { return value.replace(/\/+$/, ''); }
function clamp(value, min, max) { return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min)); }
function httpError(status, code) { const error = new Error(code); error.status = status; error.code = code; return error; }
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function nl2br(value) { return escapeHtml(value).replace(/\n/g, '<br>'); }
function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(payload));
}
function html(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" });
  res.end(payload);
}
function moderationShell(title, body) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title><style>
    :root{color-scheme:dark}body{font:16px/1.5 system-ui,sans-serif;max-width:760px;margin:4rem auto;padding:0 1.5rem;background:#17111d;color:#f4eafa}main{background:#271a31;padding:2rem;border-radius:18px}dt{font-weight:700;color:#dba9ed;margin-top:1rem}dd{margin:.25rem 0 0;white-space:normal}.actions{display:flex;gap:1rem;margin-top:2rem}.actions form{flex:1}button{width:100%;padding:.8rem 1rem;border:0;border-radius:12px;font:inherit;font-weight:700;cursor:pointer}.approve{background:#8bd49c;color:#132318}.reject{background:#e58a9a;color:#2c1116}</style><main>${body}</main></html>`;
}

process.on('SIGTERM', () => { server.close(() => { db.close(); process.exit(0); }); });
process.on('SIGINT', () => { server.close(() => { db.close(); process.exit(0); }); });
