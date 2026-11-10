import { randomBytes, scryptSync } from 'node:crypto';
import { body, equal, json } from '../http.mjs';

const SESSION_SECONDS = 8 * 3600;
const MAX_SESSIONS = 128;

export function createAdminAuth(password, origin) {
  const salt = randomBytes(32),
    hash = scryptSync(password, salt, 32);
  const attempts = new Map();
  const sessions = new Map();

  function sessionToken(req) {
    return String(req.headers.cookie || '')
      .split(';')
      .map((value) => value.trim())
      .find((value) => value.startsWith('stul_admin='))
      ?.slice('stul_admin='.length);
  }

  function authorized(req) {
    const token = sessionToken(req);
    const expiry = sessions.get(token);
    if (expiry === undefined) return false;
    if (expiry > Date.now()) return true;
    sessions.delete(token);
    return false;
  }

  function cookie(value, age) {
    return `stul_admin=${value}; HttpOnly; SameSite=Strict; Path=/admin; Max-Age=${age}${origin.protocol === 'https:' ? '; Secure' : ''}`;
  }
  async function login(req, res) {
    const address = req.socket.remoteAddress || 'unknown',
      now = Date.now();
    for (const [key, item] of attempts)
      if (item.until < now) attempts.delete(key);
    const attempt = attempts.get(address) || {
      count: 0,
      until: now + 15 * 60e3,
    };
    if (attempt.count >= 10) {
      json(res, 429, { error: 'Příliš mnoho pokusů. Zkus to za 15 minut.' });
      return;
    }
    attempt.count++;
    attempts.set(address, attempt);
    const b = await body(req);
    if (
      typeof b.password !== 'string' ||
      b.password.length > 1024 ||
      !equal(scryptSync(b.password, salt, 32), hash)
    ) {
      json(res, 401, { error: 'Nesprávné heslo správce instalace.' });
      return;
    }
    attempts.delete(address);
    const issuedAt = Date.now();
    for (const [token, expiry] of sessions)
      if (expiry <= issuedAt) sessions.delete(token);
    if (sessions.size >= MAX_SESSIONS)
      sessions.delete(sessions.keys().next().value);
    const token = randomBytes(32).toString('hex');
    sessions.set(token, issuedAt + SESSION_SECONDS * 1000);
    res.setHeader('Set-Cookie', cookie(token, SESSION_SECONDS));
    json(res, 200, { ok: true });
  }
  function logout(req, res) {
    sessions.delete(sessionToken(req));
    res.setHeader('Set-Cookie', cookie('', 0));
    json(res, 200, { ok: true });
  }
  return { authorized, login, logout };
}
