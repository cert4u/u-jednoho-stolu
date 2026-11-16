import { body, json } from '../http.mjs';
import { createPjAccounts, emailAddress } from './pj-accounts.mjs';
import { createPjEmailChanges } from './pj-email-change.mjs';
import { createPjTables } from './pj-tables.mjs';

function days(value, fallback) {
  if (!value) return fallback;
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount < 1 || amount > 3650)
    throw new Error('Retence veřejných stolů musí být 1 až 3650 dní.');
  return amount;
}

function validQuota(limit) {
  return limit === null || (Number.isSafeInteger(limit) && limit > 0);
}

async function smtp() {
  const { default: mailer } = await import('nodemailer');
  let url;
  try {
    url = new URL(process.env.STUL_SMTP_URL || 'invalid:');
  } catch {
    throw new Error('Neplatné nastavení STUL_SMTP_URL.');
  }
  const from = emailAddress(process.env.STUL_SMTP_FROM);
  if (
    !['smtp:', 'smtps:'].includes(url.protocol) ||
    !url.hostname ||
    !from ||
    url.search ||
    url.hash
  )
    throw new Error(
      'Veřejný režim vyžaduje platné STUL_SMTP_URL a STUL_SMTP_FROM.',
    );
  const transport = mailer.createTransport({
    host: url.hostname,
    port: Number(url.port) || (url.protocol === 'smtps:' ? 465 : 587),
    secure: url.protocol === 'smtps:',
    requireTLS: url.protocol === 'smtp:',
    ...(url.username && {
      auth: {
        user: decodeURIComponent(url.username),
        pass: decodeURIComponent(url.password),
      },
    }),
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 10_000,
  });
  return async (to, subject, text) => {
    await transport.sendMail({ from, to, subject, text });
  };
}

export async function createPublicPj({ db, origin, maintenance, deletions }) {
  if (origin.protocol !== 'https:')
    throw new Error('Veřejný režim PJ vyžaduje HTTPS v PUBLIC_ORIGIN.');
  const send = await smtp();
  const accounts = createPjAccounts(db, send, origin);
  const emailChanges = createPjEmailChanges(db, accounts, send, origin);
  const cleanup = process.env.STUL_PJ_CLEANUP === '1';
  const tables = createPjTables(db, {
    deletions,
    inactiveDays: days(process.env.STUL_PJ_INACTIVE_DAYS, 90),
    archiveDays: days(process.env.STUL_PJ_ARCHIVE_DAYS, 30),
    cleanup,
  });
  const attempts = new Map();
  let lastHour = 0;
  let outgoing = 0;

  function limited(req, kind, max) {
    const now = Date.now();
    for (const [key, attempt] of attempts)
      if (attempt.until <= now) attempts.delete(key);
    const key = kind + ':' + (req.socket.remoteAddress || 'unknown');
    const item = attempts.get(key) || { count: 0, until: now + 60_000 };
    if (item.count >= max || (!attempts.has(key) && attempts.size >= 4096))
      return true;
    item.count++;
    attempts.set(key, item);
    return false;
  }

  function reserveEmail(count = 1) {
    const now = Date.now();
    if (now - lastHour >= 3_600_000) {
      lastHour = now;
      outgoing = 0;
    }
    if (outgoing + count > 60) return false;
    outgoing += count;
    return true;
  }

  async function payload(req, res) {
    try {
      const value = await body(req);
      if (value && typeof value === 'object' && !Array.isArray(value))
        return value;
    } catch {
      // The same response covers invalid JSON and oversize requests.
    }
    json(res, 400, { error: 'Neplatný požadavek.' });
    return null;
  }

  function gate(req, res) {
    if (req.headers.origin !== origin.origin) {
      json(res, 403, { error: 'Neplatný původ požadavku.' });
      return false;
    }
    if (maintenance.blocksWrites()) {
      json(res, 503, { error: 'Probíhá údržba. Zkus to za chvíli.' });
      return false;
    }
    return true;
  }

  function authHeaders(req) {
    const user = accounts.profile(req);
    if (user?.status === 'approved') return { 'x-stul-pj-account': user.id };
    return {};
  }

  async function handle(req, res, url) {
    const path = url.pathname.slice('/pj/api/'.length);
    if (req.method === 'GET' && path === 'mode')
      return json(res, 200, { enabled: true });
    if (req.method === 'GET' && path === 'profile') {
      const user = accounts.profile(req);
      return json(res, 200, {
        user: user || null,
        emailChange: user ? emailChanges.pending(user.id) : null,
        quota: user?.status === 'approved' ? tables.quota(user.id) : null,
        cleanup,
        rooms: user?.status === 'approved' ? tables.list(user.id) : [],
      });
    }
    if (req.method !== 'POST') return json(res, 404, { error: 'Nenalezeno.' });
    if (!gate(req, res)) return;
    const finish = maintenance.trackMutation(true);
    try {
      const values = await payload(req, res);
      if (!values) return;
      if (path === 'request' || path === 'login') {
        const email = emailAddress(values.email);
        if (!email) return json(res, 400, { error: 'Zadej platný e-mail.' });
        if (limited(req, 'email', 12) || !reserveEmail())
          return json(res, 429, {
            error: 'Příliš mnoho pokusů. Zkus to později.',
          });
        const name =
          typeof values.name === 'string'
            ? values.name.trim().slice(0, 60)
            : '';
        const note =
          typeof values.note === 'string'
            ? values.note.trim().slice(0, 300)
            : '';
        const account =
          path === 'request'
            ? accounts.register(email, name, note)
            : accounts.find(email);
        // Always acknowledge requests alike, including addresses without an account.
        const finishMail = maintenance.trackMutation(true);
        void accounts
          .sendLink(account)
          .catch(() => console.warn('pj_signin_delivery_failed'))
          .finally(finishMail);
        return json(res, 202, { ok: true });
      }
      if (path === 'confirm') {
        if (limited(req, 'confirm', 25))
          return json(res, 429, {
            error: 'Příliš mnoho pokusů. Zkus to později.',
          });
        const session = accounts.confirm(values.secret);
        if (!session)
          return json(res, 400, { error: 'Odkaz vypršel nebo už byl použit.' });
        res.setHeader('Set-Cookie', accounts.cookie(session));
        return json(res, 200, { ok: true });
      }
      if (path === 'confirm-email-change') {
        if (limited(req, 'confirm', 25))
          return json(res, 429, {
            error: 'Příliš mnoho pokusů. Zkus to později.',
          });
        const result = emailChanges.confirm(values.secret);
        return result
          ? json(res, 200, result)
          : json(res, 400, {
              error: 'Odkaz vypršel, byl zrušený nebo už použitý.',
            });
      }
      if (path === 'logout') {
        res.setHeader('Set-Cookie', accounts.logout(req));
        return json(res, 200, { ok: true });
      }
      const user = accounts.profile(req);
      if (user?.status !== 'approved')
        return json(res, 403, { error: 'Přihlas se jako schválený PJ.' });
      if (path === 'request-email-change') {
        const target = emailAddress(values.email);
        if (!target || target === user.email)
          return json(res, 400, {
            error: 'Zadej novou platnou e-mailovou adresu.',
          });
        if (limited(req, 'email', 12) || !reserveEmail(2))
          return json(res, 429, {
            error: 'Příliš mnoho pokusů. Zkus to později.',
          });
        try {
          return (await emailChanges.start(user.id, user.email, target, 'self'))
            ? json(res, 200, { ok: true })
            : json(res, 409, {
                error:
                  'Změnu teď nelze zahájit. Adresa může být obsazená nebo už probíhá ověření.',
              });
        } catch (error) {
          return json(res, 503, { error: error.message });
        }
      }
      if (path === 'cancel-email-change')
        return emailChanges.cancel(user.id)
          ? json(res, 200, { ok: true })
          : json(res, 409, { error: 'Tuto změnu teď nelze zrušit.' });
      const id = values.room;
      if (typeof id !== 'string' || !/^[A-F0-9]{10}$/.test(id))
        return json(res, 400, { error: 'Neplatný kód stolu.' });
      if (path === 'open' || path === 'backup') {
        const session = tables.session(user.id, id, path === 'backup');
        return session
          ? json(res, 200, session)
          : json(res, 404, { error: 'Tento stůl není dostupný.' });
      }
      if (path === 'claim') {
        if (typeof values.token !== 'string')
          return json(res, 400, { error: 'Chybí přístup PJ ke stolu.' });
        const error = tables.claim(user.id, id, values.token);
        return error ? json(res, 409, { error }) : json(res, 200, { ok: true });
      }
      if (path === 'invite') {
        if (!['read', 'rotate', 'pause', 'resume'].includes(values.operation))
          return json(res, 400, { error: 'Neplatná akce u pozvánky.' });
        const invite = tables.invitation(user.id, id, values.operation);
        return invite
          ? json(res, 200, {
              token: invite.token,
              paused: Boolean(invite.paused),
            })
          : json(res, 404, { error: 'Tento stůl není dostupný.' });
      }
      if (path === 'completion') {
        if (typeof values.completed !== 'boolean')
          return json(res, 400, { error: 'Chybí stav dohrání kampaně.' });
        return tables.setCompleted(user.id, id, values.completed)
          ? json(res, 200, { ok: true })
          : json(res, 404, { error: 'Tento stůl není dostupný.' });
      }
      if (['archive', 'restore', 'keep', 'delete'].includes(path)) {
        const title = typeof values.title === 'string' ? values.title : '';
        return tables.change(user.id, id, path, title)
          ? json(res, 200, { ok: true })
          : json(res, 409, {
              error: 'Stůl se mezitím změnil nebo ti nepatří.',
            });
      }
      return json(res, 404, { error: 'Nenalezeno.' });
    } finally {
      finish();
    }
  }

  async function admin(req, res, url) {
    if (req.method === 'GET') {
      const id = url.searchParams.get('pj');
      const selection = url.searchParams.get('period');
      if (selection !== null && !['all', '30', '90'].includes(selection))
        return json(res, 400, { error: 'Neplatné období herních statistik.' });
      const days =
        selection === '30' || selection === '90' ? Number(selection) : null;
      return json(
        res,
        200,
        id ? tables.detail(id, days) : tables.overview(days),
      );
    }
    if (req.method !== 'POST')
      return json(res, 405, { error: 'Neplatná metoda.' });
    if (!gate(req, res)) return;
    const finish = maintenance.trackMutation(true);
    try {
      const values = await payload(req, res);
      if (!values) return;
      if (values.action === 'set-quota') {
        const { id, tables: tableLimit, bytes: byteLimit } = values;
        if (
          typeof id !== 'string' ||
          !validQuota(tableLimit) ||
          !validQuota(byteLimit)
        )
          return json(res, 400, {
            error:
              'Limit zadej jako kladné celé číslo, nebo použij výchozí nastavení.',
          });
        const updated = accounts.transaction(() => {
          const changed = db
            .prepare(
              'UPDATE pj_accounts SET table_limit = ?, bytes_limit = ? WHERE id = ?',
            )
            .run(tableLimit, byteLimit, id).changes;
          if (changed) accounts.recordEvent(id, 'quota-updated');
          return Boolean(changed);
        });
        return updated
          ? json(res, 200, { ok: true })
          : json(res, 404, { error: 'Účet PJ neexistuje.' });
      }
      if (values.action === 'recover-email') {
        const current = emailAddress(values.currentEmail);
        const target = emailAddress(values.email);
        if (
          typeof values.id !== 'string' ||
          !current ||
          !target ||
          current === target
        )
          return json(res, 400, {
            error: 'Potvrď původní adresu a zadej platnou novou adresu.',
          });
        if (!reserveEmail(2))
          return json(res, 429, {
            error: 'Limit odesílání e-mailů je dočasně vyčerpaný.',
          });
        try {
          return (await emailChanges.start(
            values.id,
            current,
            target,
            'recovery',
          ))
            ? json(res, 200, { ok: true })
            : json(res, 409, {
                error:
                  'Obnovu nelze zahájit. Zkontroluj stav účtu, e-maily a probíhající ověření.',
              });
        } catch (error) {
          return json(res, 503, { error: error.message });
        }
      }
      if (values.action === 'cancel-email-change') {
        return typeof values.id === 'string' &&
          emailChanges.cancel(values.id, true)
          ? json(res, 200, { ok: true })
          : json(res, 409, { error: 'Změna už není aktivní.' });
      }
      if (values.action === 'invite') {
        const email = emailAddress(values.email);
        if (!email) return json(res, 400, { error: 'Zadej platný e-mail.' });
        const name =
          typeof values.name === 'string'
            ? values.name.trim().slice(0, 60)
            : '';
        try {
          return (await accounts.invite(email, name))
            ? json(res, 200, { ok: true })
            : json(res, 409, {
                error: 'Pozastavený účet nejdřív znovu povol.',
              });
        } catch (error) {
          return json(res, 503, { error: error.message });
        }
      }
      const decision =
        typeof values.id === 'string' && typeof values.action === 'string'
          ? accounts.decide(values.id, values.action)
          : null;
      if (!decision)
        return json(res, 409, {
          error: 'Stav žádosti se změnil nebo akce není dostupná.',
        });
      if (values.action === 'approve') {
        let mailSent = true;
        try {
          await send(
            decision.email,
            'Účet PJ je schválený · U jednoho stolu',
            `Účet můžeš použít na ${new URL('/pj', origin).href}.`,
          );
        } catch {
          mailSent = false;
        }
        return json(res, 200, { ok: true, mailSent });
      }
      return json(res, 200, { ok: true });
    } finally {
      finish();
    }
  }

  let sweeping = false;
  async function sweep(now = Date.now()) {
    if (sweeping || maintenance.blocksWrites()) return;
    sweeping = true;
    const finish = maintenance.trackMutation(true);
    try {
      accounts.clean(now);
      await tables.sweep(now, send, () => !maintenance.blocksWrites());
    } finally {
      finish();
      sweeping = false;
    }
  }

  return { handle, admin, authHeaders, sweep };
}
