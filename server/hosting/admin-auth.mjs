import { createHmac, randomBytes, scryptSync } from 'node:crypto';
import { body, equal, json } from '../http.mjs';

export function createAdminAuth(password, origin) {
  const salt = randomBytes(32),
    hash = scryptSync(password, salt, 32),
    sessionKey = randomBytes(32);
  const attempts = new Map();
  function session(value) {
    return createHmac('sha256', sessionKey).update(value).digest('hex');
  }
  function authorized(req) {
    const cookie =
      String(req.headers.cookie || '')
        .split(';')
        .map((s) => s.trim())
        .find((s) => s.startsWith('stul_admin='))
        ?.slice(11) || '';
    const [expiry, nonce, signature] = cookie.split('.');
    return (
      Number(expiry) > Date.now() &&
      Number(expiry) < Date.now() + 8 * 3600e3 + 1000 &&
      equal(signature, session(`${expiry}.${nonce}`))
    );
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
    const value = `${now + 8 * 3600e3}.${randomBytes(24).toString('hex')}`;
    res.setHeader('Set-Cookie', cookie(`${value}.${session(value)}`, 8 * 3600));
    json(res, 200, { ok: true });
    return;
  }
  function logout(res) {
    res.setHeader('Set-Cookie', cookie('', 0));
    json(res, 200, { ok: true });
  }
  return { authorized, login, logout };
}
