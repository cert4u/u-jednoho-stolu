export const time = (value) =>
  value ? new Date(value).toLocaleString('cs') : '—';
const integer = new Intl.NumberFormat('cs');
const decimal = new Intl.NumberFormat('cs', { maximumFractionDigits: 1 });

const dateOnly = new Intl.DateTimeFormat('cs', { timeZone: 'UTC' });
export const formatPlayDate = (value) =>
  value ? dateOnly.format(new Date(value + 'T00:00:00Z')) : '—';
export const formatAverage = (value) =>
  value === null ? '—' : decimal.format(value);

export function size(bytes) {
  if (bytes < 1024) return integer.format(bytes) + ' B';
  if (bytes >= 1024 ** 3) return decimal.format(bytes / 1024 ** 3) + ' GiB';
  if (bytes >= 1024 ** 2) return decimal.format(bytes / 1024 ** 2) + ' MiB';
  return decimal.format(bytes / 1024) + ' KiB';
}

export function element(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

function metric(label, value, hint) {
  const card = element('div');
  card.className = 'admin-metric';
  card.append(
    element('strong', integer.format(value)),
    element('span', label),
    element('small', hint),
  );
  return card;
}

function bar(label, value, max, display) {
  const row = element('div');
  row.className = 'admin-bar-row';
  const progress = element('progress');
  progress.max = Math.max(1, max);
  progress.value = value;
  progress.setAttribute('aria-label', label);
  progress.setAttribute('aria-valuetext', display);
  row.append(element('span', label), element('strong', display), progress);
  return row;
}

export function renderOverview({ counts, accounts, capacity, sampledAt }) {
  const approved = accounts.filter(
    (account) => account.status === 'approved',
  ).length;
  const requests = accounts.filter(
    (account) => account.status === 'requested',
  ).length;
  const navCount = document.getElementById('pj-nav-count');
  navCount.hidden = requests === 0;
  navCount.textContent = requests || '';
  document.getElementById('pj-sampled').textContent =
    'Aktualizováno ' + time(sampledAt);
  document
    .getElementById('pj-overview')
    .replaceChildren(
      metric(
        'Otevřené stoly',
        counts.active,
        counts.recent30 + ' s aktivitou za 30 dní',
      ),
      metric(
        'Archivované stoly',
        counts.archived,
        counts.legacy + ' stolů celkem bez přiřazeného PJ',
      ),
      metric('Schválení PJ', approved, requests + ' žádostí ke schválení'),
      metric(
        'Nové stoly za 30 dní',
        counts.created30,
        'Z aktuálně uložených stolů',
      ),
    );
  const buckets = [
    ['Posledních 7 dní', counts.recent7],
    ['Před 8 až 30 dny', counts.recent30 - counts.recent7],
    ['Před 31 až 90 dny', counts.recent90 - counts.recent30],
    [
      'Před více než 90 dny',
      counts.active - counts.recent90 - counts.unknownActivity,
    ],
    ['Bez záznamu', counts.unknownActivity],
  ];
  document
    .getElementById('pj-activity')
    .replaceChildren(
      ...buckets.map(([label, value]) =>
        bar(label, value, counts.active, integer.format(value)),
      ),
      element(
        'small',
        'Každý stůl je v jedné skupině podle poslední uložené aktivity.',
      ),
    );
  document
    .getElementById('pj-capacity')
    .replaceChildren(
      bar(
        'Kampaně',
        counts.total,
        capacity.tables,
        integer.format(counts.total) + ' / ' + integer.format(capacity.tables),
      ),
      bar(
        'Data kampaní',
        counts.bytes,
        capacity.bytes,
        size(counts.bytes) + ' / ' + size(capacity.bytes),
      ),
      element(
        'small',
        'Kapacitu využívají i archivy. Údaj zahrnuje uložená data kampaní.',
      ),
    );
}

export function adminTable(columns, rows) {
  const table = element('table');
  table.className = 'admin-table';
  const heading = table.createTHead().insertRow();
  for (const column of columns) {
    const cell = element('th', column);
    cell.scope = 'col';
    heading.append(cell);
  }
  const body = table.createTBody();
  for (const values of rows) {
    const row = body.insertRow();
    for (const [index, value] of values.entries()) {
      const cell = row.insertCell();
      cell.dataset.label = columns[index];
      if (typeof value === 'string') cell.textContent = value;
      else cell.append(value);
    }
  }
  return table;
}

function roomState(room) {
  const state = element('span', room.archivedAt ? 'V archivu' : 'Otevřený');
  if (room.completedOn)
    state.append(
      element('small', 'Dohráno ' + formatPlayDate(room.completedOn)),
    );
  return state;
}

function columnWithCode(room) {
  const label = element('span', room.title || 'Bez názvu');
  label.append(element('small', room.id));
  return label;
}

export function renderRooms(rooms, data) {
  const owners = new Map(
    data.accounts.map((account) => [account.id, account.name || account.email]),
  );
  const candidateIds = new Set(data.candidates.map((room) => room.id));
  const cleanupDate = (room) => {
    if (candidateIds.has(room.id))
      return room.archivedAt ? 'Ke smazání' : 'K archivaci';
    if (room.deleteAt) return 'Smazání ' + time(room.deleteAt);
    if (room.archiveAt) return 'Archivace ' + time(room.archiveAt);
    return '—';
  };
  return rooms.length
    ? adminTable(
        ['Stůl', 'PJ', 'Stav', 'Poslední aktivita', 'Data', 'Úklid'],
        rooms.map((room) => [
          columnWithCode(room),
          owners.get(room.ownerId) || '—',
          roomState(room),
          time(room.lastActivityAt),
          size(room.bytes),
          cleanupDate(room),
        ]),
      )
    : element('p', 'Filtru neodpovídá žádný stůl.');
}

export function renderOwnerRooms(rooms) {
  return rooms.length
    ? adminTable(
        [
          'Stůl',
          'Stav',
          'Hráčské postavy',
          'Herní dny',
          'Naposledy hráno',
          'Data',
        ],
        rooms.map((room) => [
          columnWithCode(room),
          roomState(room),
          room.players + ' u stolu · ' + room.archivedPlayers + ' v archivu',
          integer.format(room.playDays),
          formatPlayDate(room.lastPlayedOn),
          size(room.bytes),
        ]),
      )
    : element('p', 'Žádný stůl.');
}
