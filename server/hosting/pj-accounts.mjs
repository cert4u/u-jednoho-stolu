import { createHash, randomBytes, randomUUID } from 'node:crypto';

const day = 86_400_000;
const loginLifetime = 15 * 60_000;
const sessionLifetime = 14 * day;

export function digest(secret) {
  return createHash('sha256').update(secret).digest('hex');
}

export function emailAddress(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (
    email.length > 254 ||
    !/^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(email)
  )
    return null;
  const [local, domain] = email.split('@');
  if (
    local.length > 64 ||
    local.startsWith('.') ||
    local.endsWith('.') ||
    local.includes('..') ||
    domain
      .split('.')
      .some(
        (label) =>
          label.length > 63 || label.startsWith('-') || label.endsWith('-'),
      )
  )
    return null;
  return email;
}

export function createPjAccounts(db, send, origin) {
  function transaction(run) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = run();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  function find(email) {
    return db.prepare('SELECT * FROM pj_accounts WHERE email = ?').get(email);
  }

  function register(email, name, note) {
    db.prepare(
      `
      INSERT INTO pj_accounts(id, email, name, note, status, created_at)
      SELECT ?, ?, ?, ?, 'requested', ?
      WHERE NOT EXISTS (SELECT 1 FROM pj_email_changes WHERE target_email = ? AND expires_at > ?)
      ON CONFLICT(email) DO NOTHING
    `,
    ).run(randomUUID(), email, name, note, Date.now(), email, Date.now());
    return find(email);
  }

  async function sendLink(account) {
    if (!account || ['rejected', 'suspended'].includes(account.status)) return;
    const now = Date.now();
    if (
      db
        .prepare(
          "SELECT 1 FROM pj_email_changes WHERE account_id = ? AND mode = 'recovery' AND expires_at > ?",
        )
        .get(account.id, now)
    )
      return;
    const secret = randomBytes(32).toString('base64url');
    const hash = digest(secret);
    const created = db
      .prepare(
        `
      INSERT INTO pj_signins (digest, account_id, expires_at, issued_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET digest = excluded.digest,
        expires_at = excluded.expires_at, issued_at = excluded.issued_at
      WHERE pj_signins.issued_at <= ?
    `,
      )
      .run(hash, account.id, now + loginLifetime, now, now - 60_000);
    if (!created.changes) return;
    try {
      const url = new URL('/pj', origin);
      url.hash = 'prihlaseni=' + secret;
      await send(
        account.email,
        'Přihlášení PJ · U jednoho stolu',
        `Otevři ${url.href}\n\nOdkaz platí 15 minut. Na stránce potvrď přihlášení.`,
      );
    } catch {
      db.prepare('DELETE FROM pj_signins WHERE digest = ?').run(hash);
      throw new Error('E-mail se nepodařilo odeslat. Zkus to později.');
    }
  }

  function confirm(secret) {
    if (typeof secret !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(secret))
      return null;
    return transaction(() => {
      const now = Date.now();
      const link = db
        .prepare(
          `
        DELETE FROM pj_signins WHERE digest = ? AND expires_at > ? RETURNING account_id
      `,
        )
        .get(digest(secret), now);
      if (!link) return null;
      const profile = db
        .prepare(
          `
        UPDATE pj_accounts SET verified_at = coalesce(verified_at, ?),
          status = CASE WHEN status = 'invited' THEN 'approved' ELSE status END
        WHERE id = ? AND status NOT IN ('rejected','suspended') RETURNING id
      `,
        )
        .get(now, link.account_id);
      if (!profile) return null;
      const session = randomBytes(32).toString('base64url');
      db.prepare('INSERT INTO pj_sessions VALUES (?, ?, ?)').run(
        digest(session),
        profile.id,
        now + sessionLifetime,
      );
      return session;
    });
  }

  function getToken(req) {
    const token = String(req.headers.cookie || '').match(
      /(?:^|;\s*)stul_pj=([A-Za-z0-9_-]{43})(?=;|$)/,
    )?.[1];
    return token ? digest(token) : null;
  }

  function profile(req) {
    return db
      .prepare(
        `
      SELECT a.id, a.email, a.name, a.status FROM pj_sessions s JOIN pj_accounts a ON a.id = s.account_id
      WHERE s.digest = ? AND s.expires_at > ? AND a.status NOT IN ('suspended','rejected')
    `,
      )
      .get(getToken(req), Date.now());
  }

  function cookie(token, age = sessionLifetime / 1000) {
    return `stul_pj=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${origin.protocol === 'https:' ? '; Secure' : ''}`;
  }

  function logout(req) {
    db.prepare('DELETE FROM pj_sessions WHERE digest = ?').run(getToken(req));
    return cookie('', 0);
  }

  function revokeAccess(id) {
    db.prepare('DELETE FROM pj_sessions WHERE account_id = ?').run(id);
    db.prepare('DELETE FROM pj_signins WHERE account_id = ?').run(id);
  }

  function recordEvent(id, action, at = Date.now()) {
    db.prepare(
      'INSERT INTO pj_admin_events (account_id, action, happened_at) VALUES (?, ?, ?)',
    ).run(id, action, at);
  }

  async function invite(email, name) {
    const now = Date.now();
    const account = transaction(() => {
      const previous = find(email);
      if (previous?.status === 'suspended') return null;
      if (!previous && !register(email, name, ''))
        throw new Error('Tuto adresu právě ověřuje jiný účet PJ.');
      const next = db
        .prepare(
          `
        UPDATE pj_accounts SET status = CASE WHEN verified_at IS NULL THEN 'invited' ELSE 'approved' END,
          approved_at = coalesce(approved_at, ?) WHERE email = ? RETURNING *
      `,
        )
        .get(now, email);
      recordEvent(next.id, 'invite', now);
      return next;
    });
    if (!account) return false;
    await sendLink(account);
    return true;
  }

  function decide(id, action) {
    const transitions = {
      approve: ['approved', 'requested'],
      reject: ['rejected', 'requested'],
      suspend: ['suspended', 'approved'],
      reactivate: ['approved', 'suspended'],
    };
    const transition = Object.hasOwn(transitions, action)
      ? transitions[action]
      : null;
    if (!transition) return null;
    const [target, previous] = transition;
    return transaction(() => {
      const now = Date.now();
      const result = db
        .prepare(
          `
        UPDATE pj_accounts SET status = ?,
          approved_at = CASE WHEN ? = 'approved' THEN coalesce(approved_at, ?) ELSE approved_at END
        WHERE id = ? AND status = ? AND verified_at IS NOT NULL RETURNING id, email
      `,
        )
        .get(target, target, now, id, previous);
      if (!result) return null;
      if (target !== 'approved') {
        revokeAccess(id);
        db.prepare('DELETE FROM pj_email_changes WHERE account_id = ?').run(id);
      }
      recordEvent(id, action, now);
      return result;
    });
  }

  function clean(now) {
    db.prepare('DELETE FROM pj_sessions WHERE expires_at <= ?').run(now);
    db.prepare('DELETE FROM pj_signins WHERE expires_at <= ?').run(now);
    db.prepare('DELETE FROM pj_email_changes WHERE expires_at <= ?').run(now);
    db.prepare(
      `
      DELETE FROM pj_accounts WHERE status = 'requested' AND verified_at IS NULL
      AND created_at <= ? AND NOT EXISTS (SELECT 1 FROM pj_signins WHERE account_id = pj_accounts.id)
    `,
    ).run(now - 14 * day);
  }

  return {
    transaction,
    revokeAccess,
    recordEvent,
    find,
    register,
    sendLink,
    confirm,
    profile,
    cookie,
    logout,
    invite,
    decide,
    clean,
  };
}
