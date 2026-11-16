import {
  element,
  formatAverage,
  formatPlayDate,
  renderOverview,
  renderOwnerRooms,
  renderRooms,
  size,
  time,
} from './pj-stats.js';

const el = (id) => document.getElementById(id);
const labels = {
  requested: 'Čeká na schválení',
  invited: 'Čeká na ověření',
  approved: 'Schválený',
  rejected: 'Zamítnutý',
  suspended: 'Pozastavený',
  approve: 'Schválení',
  reject: 'Zamítnutí',
  suspend: 'Pozastavení',
  reactivate: 'Znovu povoleno',
  invite: 'Pozvánka',
  'quota-updated': 'Změna limitů PJ',
  'email-recovery-requested': 'Zahájení obnovy e-mailu',
  'email-recovered': 'Ověřená obnova e-mailu',
  'email-changed': 'Ověřená změna e-mailu',
  'email-change-cancelled': 'Zrušení změny e-mailu',
};
const plural = new Intl.PluralRules('cs');
const unitCount = (value, forms) => value + ' ' + forms[plural.select(value)];
const pageSize = 30;
let generation = 0;
let data;
let roomLimit = pageSize;

function status(message) {
  for (const id of ['pj-status', 'pj-overview-status', 'pj-tables-status'])
    el(id).textContent = message;
}
function showPublic(enabled) {
  for (const node of document.querySelectorAll(
    '[data-public-link], #public-overview, #pj-management, #pj-tables',
  ))
    node.hidden = !enabled;
  window.dispatchEvent(new Event('stul-admin-public-mode'));
}

async function api(values, id, period = 'all') {
  const params = new URLSearchParams({ period });
  if (id) params.set('pj', id);
  const query = values ? '' : '?' + params;
  const response = await fetch(
    '/admin/api/pj' + query,
    values
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        }
      : {},
  );
  if (!values && !id && [401, 404].includes(response.status)) return null;
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Požadavek se nepodařil.');
  return result;
}

async function action(values) {
  status('');
  try {
    const result = await api(values);
    await refresh();
    status(
      result.mailSent === false
        ? 'Účet je schválený. Oznámení se nepodařilo doručit.'
        : 'Změna byla uložena.',
    );
    return true;
  } catch (error) {
    status(error.message);
    return false;
  }
}

function button(label, run) {
  const node = element('button', label);
  node.type = 'button';
  node.className = 'secondary';
  node.addEventListener('click', async () => {
    node.disabled = true;
    try {
      await run();
    } finally {
      node.disabled = false;
    }
  });
  return node;
}

function facts(values) {
  const list = element('dl');
  for (const [label, value] of values) {
    const item = element('div');
    item.append(element('dt', label), element('dd', value));
    list.append(item);
  }
  return list;
}

const mib = 1024 ** 2;

function quotaValue(input, multiplier = 1) {
  const value = input.trim().replace(',', '.');
  if (!value) return null;
  const pattern = multiplier === 1 ? /^\d+$/ : /^\d+(?:\.\d+)?$/;
  const amount = Math.round(Number(value) * multiplier);
  return pattern.test(value) && Number.isSafeInteger(amount) && amount > 0
    ? amount
    : NaN;
}

async function editQuota(account) {
  const { tableOverride, byteOverride } = account.quota;
  const values = await window.stulAdminDialog.ask({
    title: 'Limity účtu PJ',
    message:
      'Do limitů patří i archivované stoly. Prázdné pole použije výchozí limit instance pro účty PJ.',
    fields: [
      {
        name: 'tables',
        label: 'Nejvýš stolů',
        value: tableOverride === null ? '' : String(tableOverride),
        maxLength: 16,
      },
      {
        name: 'mib',
        label: 'Nejvýš dat v MiB',
        value:
          byteOverride === null
            ? ''
            : (byteOverride / mib).toFixed(20).replace(/\.?0+$/, ''),
        maxLength: 32,
      },
    ],
    submit: 'Uložit limity',
  });
  if (!values) return;
  const tables = quotaValue(values.tables);
  const bytes = quotaValue(values.mib, mib);
  if (Number.isNaN(tables) || Number.isNaN(bytes)) {
    status(
      'Zadej kladný počet stolů a kladný objem dat. Prázdné pole převezme výchozí nastavení.',
    );
    return;
  }
  await action({ action: 'set-quota', id: account.id, tables, bytes });
}

function accountCard(account, opened) {
  const detail = element('details');
  detail.className = 'pj-account-card';
  detail.dataset.pjId = account.id;
  const summary = element('summary');
  const line = element('span');
  line.className = 'pj-account-summary';
  const state = element('span', labels[account.status]);
  state.className = 'admin-chip';
  state.dataset.state = account.status;
  line.append(
    element('strong', account.name || account.email),
    state,
    element(
      'small',
      unitCount(account.play.playedRooms, {
        one: 'hraný stůl',
        few: 'hrané stoly',
        other: 'hraných stolů',
      }) +
        ' · ' +
        unitCount(account.play.activeDays, {
          one: 'herní den',
          few: 'herní dny',
          other: 'herních dní',
        }),
    ),
  );
  summary.append(line);
  detail.append(
    summary,
    facts([
      ['Hrané stoly', account.play.playedRooms],
      ['Dohrané jeskyně', account.play.completedRooms],
      ['Unikátní herní dny', account.play.activeDays],
      [
        'Průměr herních dní na hraný stůl',
        formatAverage(account.play.averageDays),
      ],
      [
        'První a poslední hra',
        account.play.firstPlayedOn
          ? formatPlayDate(account.play.firstPlayedOn) +
            ' – ' +
            formatPlayDate(account.play.lastPlayedOn)
          : '—',
      ],
    ]),
    facts([
      ['Otevřené / v archivu', account.active + ' / ' + account.archived],
      ['E-mail', account.email],
      ['Přidáno', time(account.createdAt)],
      ['Schváleno', time(account.approvedAt)],
      ['Poslední aktivita', time(account.lastActivityAt)],
      ['Otevřené s aktivitou za 30 dní', account.recent30],
      ['Nejbližší archivace', time(account.nextArchiveAt)],
      [
        'Využití stolů',
        account.active +
          account.archived +
          (account.quota.tableLimit === null
            ? ' · bez individuálního limitu'
            : ' / ' + account.quota.tableLimit),
      ],
      [
        'Data kampaní',
        size(account.bytes) +
          (account.quota.byteLimit === null
            ? ' · bez individuálního limitu'
            : ' / ' + size(account.quota.byteLimit)),
      ],
    ]),
  );
  if (account.note) detail.append(element('p', account.note));
  const actions = element('div');
  actions.className = 'actions';
  const change = (text, command, question) =>
    button(text, async () => {
      if (question && !(await window.stulAdminDialog.confirm(question))) return;
      await action({ action: command, id: account.id });
    });
  if (
    ['approved', 'invited', 'requested', 'suspended'].includes(account.status)
  )
    actions.append(button('Nastavit limity', () => editQuota(account)));
  if (account.status === 'requested')
    actions.append(
      change('Schválit', 'approve'),
      change('Zamítnout', 'reject', 'Zamítnout tuto žádost o účet PJ?'),
    );
  if (account.status === 'approved')
    actions.append(
      change(
        'Pozastavit',
        'suspend',
        'Pozastavit účet a odvolat jeho přihlášení PJ?',
      ),
    );
  if (account.status === 'approved' && account.emailChangeMode !== 'recovery') {
    actions.append(
      button('Obnovit účet na nový e-mail', async () => {
        const values = await window.stulAdminDialog.ask({
          title: 'Obnova účtu PJ',
          message:
            'Před zahájením ověř totožnost PJ mimo aplikaci. Obnova okamžitě odhlásí původní přístupy PJ. Po potvrzení nové adresy zůstanou stoly u stejného účtu.',
          fields: [
            {
              name: 'currentEmail',
              label: 'Dosavadní e-mail',
              required: true,
              type: 'email',
              maxLength: 254,
            },
            {
              name: 'email',
              label: 'Nový e-mail',
              required: true,
              type: 'email',
              maxLength: 254,
            },
          ],
          submit: 'Odeslat ověření na nový e-mail',
        });
        if (!values) return;
        if (values.currentEmail.trim().toLowerCase() !== account.email) {
          status('Zadaná dosavadní adresa neodpovídá účtu.');
          return;
        }
        if (
          await action({ action: 'recover-email', id: account.id, ...values })
        )
          status('Ověřovací odkaz byl odeslán na novou adresu.');
      }),
    );
  }
  if (account.emailChangeMode) {
    detail.append(
      element(
        'p',
        account.emailChangeMode === 'recovery'
          ? 'Čeká se na potvrzení nové adresy při obnově účtu.'
          : 'PJ čeká na ověření změny e-mailu.',
      ),
    );
    actions.append(
      change(
        'Zrušit ověřování e-mailu',
        'cancel-email-change',
        'Zrušit probíhající změnu e-mailu? Vydané odkazy přestanou platit.',
      ),
    );
  }
  if (account.status === 'suspended')
    actions.append(change('Znovu povolit', 'reactivate'));
  const rooms = element('div');
  detail.append(actions, rooms);
  let pending = false;
  detail.addEventListener('toggle', async () => {
    if (!detail.open || pending || rooms.childNodes.length) return;
    pending = true;
    try {
      const period = data?.playPeriod?.days;
      const result = await api(undefined, account.id, period ?? 'all');
      rooms.replaceChildren(renderOwnerRooms(result.rooms));
    } catch (error) {
      status(error.message);
    } finally {
      pending = false;
    }
  });
  detail.open = opened;
  return detail;
}

function searchText(input) {
  return input
    .toLocaleLowerCase('cs')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function renderAccounts() {
  if (!data) return;
  const queue = el('pj-queue');
  const view = el('pj-accounts');
  const opened = new Set(
    [...document.querySelectorAll('details[data-pj-id][open]')].map(
      (panel) => panel.dataset.pjId,
    ),
  );
  const requests = data.accounts.filter(
    (account) => account.status === 'requested',
  );
  const filter = el('pj-account-filter').value;
  const term = searchText(el('pj-search').value.trim());
  const sorting = el('pj-account-sort').value;
  const byName = (a, b) =>
    (a.name || a.email).localeCompare(b.name || b.email, 'cs');
  const comparisons = {
    activity: (a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0),
    name: byName,
    bytes: (a, b) => b.bytes - a.bytes,
    active: (a, b) => b.active - a.active,
    played: (a, b) => b.play.playedRooms - a.play.playedRooms,
    playedDays: (a, b) => b.play.activeDays - a.play.activeDays,
    completed: (a, b) => b.play.completedRooms - a.play.completedRooms,
  };
  const matches = data.accounts
    .filter(
      (account) =>
        account.status !== 'requested' &&
        (!filter || account.status === filter) &&
        searchText(account.name + ' ' + account.email).includes(term),
    )
    .sort((a, b) => comparisons[sorting](a, b) || byName(a, b));
  queue.replaceChildren(
    ...(requests.length
      ? requests.map((item) => accountCard(item, opened.has(item.id)))
      : [element('p', 'Žádná ověřená žádost nečeká.')]),
  );
  view.replaceChildren(
    ...(matches.length
      ? matches.map((item) => accountCard(item, opened.has(item.id)))
      : [element('p', 'Filtru neodpovídá žádný účet.')]),
  );
}

function renderTables() {
  if (!data) return;
  const term = searchText(el('pj-table-search').value.trim());
  const filter = el('pj-table-filter').value;
  const byName = (a, b) =>
    (a.title || '').localeCompare(b.title || '', 'cs') ||
    a.id.localeCompare(b.id);
  const comparisons = {
    activity: (a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0),
    bytes: (a, b) => b.bytes - a.bytes,
    name: byName,
  };
  const ownerSearch = new Map(
    data.accounts.map((owner) => [owner.id, owner.name + ' ' + owner.email]),
  );
  const candidates = new Set(data.candidates.map((room) => room.id));
  const matches = data.rooms
    .filter((room) => {
      if (filter === 'active' && room.archivedAt) return false;
      if (filter === 'archived' && !room.archivedAt) return false;
      if (filter === 'completed' && !room.completedOn) return false;
      if (filter === 'legacy' && room.ownerId) return false;
      if (filter === 'cleanup' && !candidates.has(room.id)) return false;
      return searchText(
        [room.title, room.id, ownerSearch.get(room.ownerId)].join(' '),
      ).includes(term);
    })
    .sort(
      (a, b) => comparisons[el('pj-table-sort').value](a, b) || byName(a, b),
    );
  el('pj-room-list').replaceChildren(
    renderRooms(matches.slice(0, roomLimit), data),
  );
  el('pj-table-results').textContent = matches.length
    ? `Zobrazeno ${Math.min(roomLimit, matches.length)} z ${matches.length} stolů · ${candidates.size} k úklidu`
    : `${data.rooms.length} stolů celkem · ${candidates.size} k úklidu`;
  el('pj-more-rooms').hidden = matches.length <= roomLimit;
}

function renderPeriod(period) {
  el('pj-period-range').textContent = period.from
    ? formatPlayDate(period.from) + ' až ' + formatPlayDate(period.through)
    : 'Všechny evidované herní dny';
}

async function refresh() {
  const request = ++generation;
  const period = el('pj-period').value;
  const range = el('pj-period-range');
  range.textContent = 'Načítám období…';
  try {
    const result = await api(undefined, undefined, period);
    if (request !== generation) return;
    data = result;
    showPublic(Boolean(data));
    if (!data) return;
    status('');
    renderPeriod(data.playPeriod);
    renderOverview(data);
    renderAccounts();
    renderTables();
    el('pj-retention').textContent =
      `${data.cleanup ? 'Automatický úklid je zapnutý' : 'Režim náhledu úklidu'} · ${data.inactiveDays} dní neaktivity · ${data.archiveDays} dní v archivu`;
    const events = element('ul');
    const emails = new Map(
      data.accounts.map((account) => [account.id, account.email]),
    );
    for (const event of data.events)
      events.append(
        element(
          'li',
          `${time(event.happenedAt)} · ${labels[event.action]} · ${emails.get(event.accountId) || event.accountId}`,
        ),
      );
    el('pj-history').replaceChildren(
      data.events.length ? events : element('p', 'Žádná zaznamenaná akce.'),
    );
  } catch (error) {
    if (request !== generation) return;
    if (data?.playPeriod) {
      el('pj-period').value = data.playPeriod.days ?? 'all';
      renderPeriod(data.playPeriod);
    } else {
      range.textContent = 'Zvolené období se nepodařilo načíst.';
    }
    status(error.message);
  }
}

el('pj-period').addEventListener('change', () => void refresh());
for (const id of ['pj-refresh', 'pj-overview-refresh', 'pj-tables-refresh'])
  el(id).addEventListener('click', () => void refresh());
for (const id of ['pj-search', 'pj-account-filter', 'pj-account-sort'])
  el(id).addEventListener('input', renderAccounts);
for (const id of ['pj-table-search', 'pj-table-filter', 'pj-table-sort'])
  el(id).addEventListener('input', () => {
    roomLimit = pageSize;
    renderTables();
  });
el('pj-more-rooms').addEventListener('click', () => {
  roomLimit += pageSize;
  renderTables();
});
el('pj-invite').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('button');
  const values = new FormData(form);
  submit.disabled = true;
  try {
    if (
      await action({
        action: 'invite',
        email: values.get('email'),
        name: values.get('name'),
      })
    )
      form.reset();
  } finally {
    submit.disabled = false;
  }
});
window.addEventListener('stul-admin-session', () => void refresh());
window.addEventListener('stul-admin-logout', () => {
  generation++;
  data = undefined;
  roomLimit = pageSize;
  el('pj-period').value = 'all';
  showPublic(false);
  status('');
  for (const id of [
    'pj-overview',
    'pj-activity',
    'pj-capacity',
    'pj-queue',
    'pj-accounts',
    'pj-room-list',
    'pj-history',
  ])
    el(id).replaceChildren();
});
if (!el('panel').hidden) void refresh();
