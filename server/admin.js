const el = id => document.getElementById(id);
const channelNames = { stable: 'Stable', preview: 'Preview', development: 'Development' };
const statuses = { passed: 'prošlo', failed: 'neprošlo', pending: 'probíhá', unknown: 'nedoloženo' };
const sizeFormat = new Intl.NumberFormat('cs', { maximumFractionDigits: 1 });
let state, selectedCommit, refreshing = false, submitting = false, backupList = [];

async function api(endpoint, data) {
  const response = await fetch('/admin/api/' + endpoint, {
    method: data ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const result = await response.json();
  if (response.status === 401) {
    state = selectedCommit = undefined;
    window.dispatchEvent(new Event('stul-admin-logout'));
    backupList = [];
    el('login').hidden = false;
    el('panel').hidden = true;
  }
  if (!response.ok) throw new Error(result.error || 'Požadavek se nezdařil.');
  return result;
}

const set = (id, value) => { el(id).textContent = value; };
const showError = error => set('message', error.message);
const time = value => value ? new Date(value).toLocaleString('cs') : 'Neznámý čas';
function size(bytes) {
  if (!Number.isFinite(bytes)) return 'Nedostupné';
  const [amount, unit] = bytes >= 1024 ** 3 ? [bytes / 1024 ** 3, 'GiB']
    : bytes >= 1024 ** 2 ? [bytes / 1024 ** 2, 'MiB'] : [bytes / 1024, 'KiB'];
  return sizeFormat.format(amount) + ' ' + unit;
}

function link(id, href) {
  const safe = typeof href === 'string' && href.startsWith('https://github.com/cert4u/u-jednoho-stolu/');
  el(id).hidden = !safe;
  if (safe) el(id).href = href;
  else el(id).removeAttribute('href');
}

function locked() {
  return submitting || state?.maintenance || state?.locked || state?.job?.active;
}

function render() {
  if (!state) return;
  const s = state;
  const supported = s.protocol === 1;
  const dev = s.channel === 'development';
  const target = dev ? selectedCommit : s.latest;
  const label = target?.tag || target?.sha.slice(0, 12);
  const blocked = !supported && s.updaterAvailable ? 'Aktualizuj službu updateru podle provozního návodu.'
    : dev ? (target?.sha === s.installed.revision ? 'Tento commit už je nainstalovaný.' : '')
      : (s.releaseError || s.updateBlocked || '');
  set('installed', s.installed.version);
  set('revision', s.installed.revision.slice(0, 12));
  set('channel', channelNames[s.channel] || 'Nedostupný');
  set('health', s.maintenance ? 'Údržba' : 'V provozu');
  set('database', size(s.storage?.databaseBytes));
  set('storage', size(s.storage?.freeBytes));
  set('last-backup', backupList.length ? time(backupList[0].createdAt) : 'Žádná');
  set('latest', label ? `${s.installed.version} → ${label}` : dev ? 'Vyber konkrétní vývojový commit.' : 'Vydání není k dispozici.');
  set('update-blocked', blocked);
  el('development').hidden = !dev;
  el('resolve').disabled = locked();
  el('notes').hidden = !target?.notes;
  set('notes', target?.notes || '');
  link('release', target?.url);
  link('ci', target?.ci?.url);
  const flag = value => value === true ? 'ano' : value === false ? 'ne' : 'neuvedeno';
  const req = target?.requirements;
  el('release-facts').hidden = !target;
  set('release-facts', target ? [
    `CI commitu ${statuses[target.ci?.status] || statuses.unknown}`,
    ...(target.tag ? [`Migrace ${flag(req?.migrations)}`, `Nový updater ${flag(req?.updater)}`,
      `Změna konfigurace ${flag(req?.config)}`] : []),
  ].join(' · ') : '');
  el('update').disabled = Boolean(locked() || !supported || !target || blocked);
  set('update', dev ? 'Nainstalovat vývojový commit' : 'Aktualizovat');
  el('rollback').disabled = Boolean(locked() || !supported || !s.canRollback);
  el('snapshot').disabled = Boolean(locked());
  set('progress', s.job ? [s.job.phase, ...(s.job.logs || [])].join('\n') : 'Zatím bez aktualizace.');
  set('retention', s.automaticKeep ? `Uchovává se posledních ${s.automaticKeep} automatických záloh a záloha pro návrat verze.`
    : 'Automatické zálohy se uchovávají bez limitu.');
  set('updater', s.updaterAvailable ? (supported ? `Dostupný · protokol ${s.protocol}` : 'Vyžaduje aktualizaci') : 'Nedostupný');
  set('hosting', s.hostingConfig ? `Verze ${s.hostingConfig}` : 'Starší nebo nezjištěná');
  set('voice', s.voiceConfigured ? 'Nastavený pro hlasové hovory' : 'Vypnutý');
  for (const button of el('backup-list').querySelectorAll('button'))
    button.disabled = Boolean(locked() || !supported);
}

async function readBackups() {
  backupList = (await api('backups')).snapshots;
  const list = el('backup-list');
  list.replaceChildren();
  if (!backupList.length) {
    const item = document.createElement('li');
    item.textContent = 'Zatím žádná záloha.';
    list.append(item);
  }
  for (const snapshot of backupList) {
    const item = document.createElement('li');
    const title = document.createElement('strong');
    title.textContent = `${snapshot.manual ? 'Ruční' : 'Automatická'} · ${time(snapshot.createdAt)} · ${size(snapshot.size)}`;
    const actions = document.createElement('div');
    actions.className = 'backup-actions';
    const download = document.createElement('a');
    download.href = '/admin/api/backup?' + new URLSearchParams({ name: snapshot.name });
    download.textContent = 'Stáhnout';
    const restore = document.createElement('button');
    restore.className = 'secondary';
    restore.textContent = 'Obnovit databázi';
    restore.onclick = () => {
      const confirmation = prompt(`Obnova nahradí databázi celého stolu. Aktuální stav zůstane v samostatné záloze.\n\nPro potvrzení zadej přesný název:\n${snapshot.name}`);
      if (confirmation === null) return;
      if (confirmation !== snapshot.name) { set('message', 'Název zálohy nesouhlasí.'); return; }
      void action('restore', { snapshot: snapshot.name, confirmSnapshot: confirmation });
    };
    actions.append(download, restore);
    item.append(title, actions);
    list.append(item);
  }
  render();
}

async function refresh(force = false, loadBackups = false) {
  if (refreshing) return;
  refreshing = true;
  try {
    const previous = state;
    state = await api(force ? 'status?refresh=1' : 'status');
    if (previous?.channel !== state.channel) selectedCommit = undefined;
    el('login').hidden = true;
    el('panel').hidden = false;
    render();
    if(loadBackups||!previous)window.dispatchEvent(new Event('stul-admin-session'));
    if (loadBackups || !previous || previous.job?.active && !state.job?.active) await readBackups();
  } catch (error) {
    if (!el('panel').hidden || force || loadBackups) showError(error);
  } finally { refreshing = false; }
}

async function action(endpoint, data = {}) {
  if (submitting) return;
  submitting = true;
  set('message', '');
  render();
  try {
    const result = await api(endpoint, { ...data, requestId: crypto.randomUUID() });
    if (endpoint === 'backups') await readBackups();
    else if (state) state = { ...state, job: result };
    await refresh();
  } catch (error) { showError(error); }
  finally { submitting = false; render(); }
}

el('login-form').onsubmit = async event => {
  event.preventDefault();
  try {
    await api('login', { password: el('password').value });
    el('password').value = '';
    set('message', '');
    await refresh(false, true);
  } catch (error) { showError(error); }
};
el('refresh').onclick = () => refresh(true, true);
el('ref').oninput = () => { selectedCommit = undefined; render(); };
el('development').onsubmit = async event => {
  event.preventDefault();
  if (locked()) return;
  submitting = true;
  set('message', '');
  render();
  try {
    const ref = el('ref').value.trim();
    const result = await api('resolve', { ref });
    if (state?.channel === 'development' && el('ref').value.trim() === ref) selectedCommit = result;
  } catch (error) { showError(error); }
  finally { submitting = false; render(); }
};
el('update').onclick = () => {
  const target = state.channel === 'development' ? selectedCommit : state.latest;
  if (!target) return;
  const warning = target.tag ? '' : '\nVývojový commit může obsahovat i starší kód.';
  if (confirm(`Nainstalovat ${target.tag || target.ref} (${target.sha.slice(0, 12)})?\nPo sestavení se uloží databáze a stůl přejde do krátké údržby.${warning}`))
    void action('update', { expectedSha: target.sha, ref: target.ref });
};
el('rollback').onclick = () => {
  if (confirm('Vrátit předchozí verzi a databázi z doby před aktualizací? Aktuální stav se nejprve uloží do samostatné zálohy.'))
    void action('rollback');
};
el('snapshot').onclick = () => action('backups');
el('logout').onclick = async () => {
  try {
    await api('logout', {});
    state = selectedCommit = undefined;
    window.dispatchEvent(new Event('stul-admin-logout'));
    backupList = [];
    el('panel').hidden = true;
    el('login').hidden = false;
  } catch (error) { showError(error); }
};
setInterval(() => { if (!el('panel').hidden && !submitting) void refresh(); }, 5000);
void refresh();
