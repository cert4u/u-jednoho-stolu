import {
  readFileSync, writeFileSync, renameSync, existsSync, copyFileSync, unlinkSync,
  mkdirSync, statSync, lstatSync, readdirSync, chownSync, chmodSync,
  openSync, closeSync, fsyncSync,
} from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { docker, buildImage, replacementConfig } from './docker.mjs';
import { latestRelease, developmentRelease } from './releases.mjs';
import { updateDecision } from './versions.mjs';

export const UPDATER_PROTOCOL = 1;
const automaticSnapshot = /^\d+-[a-f0-9]{16}\.sqlite$/;
const shaPattern = /^[a-f0-9]{40}$/;
const supportedImage = /^stul-app:(?:[a-f0-9]{40}|local)$/;

export class UpdateManager {
  constructor({
    stateDir = '/state', dataDir = '/data', engine = docker, build = buildImage,
    release = latestRelease, development = developmentRelease, appFetch, wait = delay,
    channel = process.env.STUL_UPDATE_CHANNEL || 'stable',
    hostingConfig = Number(process.env.STUL_HOSTING_CONFIG || 0),
    keep = Number(process.env.STUL_BACKUP_KEEP || 0),
  } = {}) {
    if (!['stable', 'preview', 'development'].includes(channel)) throw new Error('Neplatný aktualizační kanál.');
    if (!Number.isInteger(keep) || keep < 0 || keep > 1000) throw new Error('STUL_BACKUP_KEEP musí být celé číslo od 0 do 1000.');
    if (!Number.isInteger(hostingConfig) || hostingConfig < 0) throw new Error('Neplatná verze konfigurace hostingu.');
    Object.assign(this, { stateDir, dataDir, engine, build, release, development, wait, channel, hostingConfig, keep });
    this.name = process.env.STUL_APP_CONTAINER || 'stul-app';
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(this.name)) throw new Error('Neplatný název kontejneru aplikace.');
    this.appFetch = appFetch || ((endpoint, data) => this.fetchApp(endpoint, data));
    mkdirSync(stateDir, { recursive: true });
    chmodSync(stateDir, 0o700);
    mkdirSync(dataDir, { recursive: true });
    if (process.getuid?.() === 0) chownSync(dataDir, 1000, 1000);
    this.state = existsSync(this.file) ? JSON.parse(readFileSync(this.file, 'utf8')) : { job: null, previous: null };
    this.latest = null;
    this.releaseError = null;
    this.checked = 0;
  }

  get file() { return path.join(this.stateDir, 'state.json'); }

  sync(file) {
    const fd = openSync(file, 'r');
    try { fsyncSync(fd); } finally { closeSync(fd); }
  }

  save() {
    const temp = this.file + '.tmp';
    writeFileSync(temp, JSON.stringify(this.state), { mode: 0o600 });
    this.sync(temp);
    renameSync(temp, this.file);
    this.sync(this.stateDir);
  }

  log(message) {
    const logs = this.state.job.logs;
    logs.push(String(message).slice(-2500));
    this.state.job.logs = logs.slice(-30);
    this.save();
  }

  phase(value) {
    this.state.job.phase = value;
    this.save();
  }

  async fetchApp(endpoint, data) {
    const response = await fetch(`http://app:8080${endpoint}`, {
      method: data ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${process.env.STUL_UPDATER_TOKEN}`, 'Content-Type': 'application/json' },
      ...(data ? { body: JSON.stringify(data) } : {}),
      signal: AbortSignal.timeout(endpoint === '/healthz' ? 2000 : 18000),
    });
    if (!response.ok) throw new Error(`Aplikace neodpovídá (${response.status}).`);
    return response.json();
  }

  async check(force = false, includeCI = true) {
    if (this.channel === 'development') return;
    if (this.checking) {
      await this.checking;
      if (!force) return;
    }
    if (!force && Date.now() - this.checked < 300000) return;
    this.checking = (async () => {
      try {
        this.latest = await this.release(this.channel, { includeCI });
        this.releaseError = null;
      } catch (error) {
        this.latest = null;
        this.releaseError = error.message;
      } finally {
        this.checked = includeCI ? Date.now() : 0;
        this.checking = null;
      }
    })();
    await this.checking;
  }

  async status(refresh = false) {
    await this.check(refresh && Date.now() - this.checked >= 15000);
    const current = await this.appFetch('/healthz').catch(() => null);
    const locked = Boolean(this.state.job?.active || this.state.transaction);
    const previous = this.state.previous;
    return {
      protocol: UPDATER_PROTOCOL, hostingConfig: this.hostingConfig, channel: this.channel,
      latest: this.latest, releaseError: this.releaseError,
      updateBlocked: this.channel === 'development' ? null : updateDecision(current, this.latest),
      job: this.state.job, locked, automaticKeep: this.keep,
      canRollback: !locked && Boolean(previous && current?.ok &&
        previous.installedRevision === current.revision && this.hasSnapshot(previous.snapshot)),
    };
  }

  async healthy(revision, requireSmoke = false, probe = true) {
    let last;
    const deadline = Date.now() + 60000;
    for (let i = 0; i < 60 && Date.now() < deadline; i++) {
      try {
        const status = await this.appFetch('/healthz');
        if (status.ok && (!revision || status.revision === revision)) {
          if (probe && (requireSmoke || status.hostingProtocol >= 1)) {
            const result = await this.appFetch('/internal/smoke', {});
            if (!result.ok || result.revision !== status.revision)
              throw new Error('Kontrola databáze, herního API a administrace se nezdařila.');
          }
          return status;
        }
      } catch (error) { last = error; }
      await this.wait(1000);
    }
    throw new Error('Aplikace neprošla kontrolou spuštění.' + (last ? ' ' + last.message : ''));
  }

  inspect(id) { return this.engine('GET', `/containers/${encodeURIComponent(id)}/json`); }

  async stop(id) {
    const container = await this.inspect(id);
    if (container.State.Running) await this.engine('POST', `/containers/${id}/stop?t=20`);
  }

  remove(id) { return this.engine('DELETE', `/containers/${id}?force=true`); }

  runtime(image) {
    if (!supportedImage.test(image)) throw new Error('Neplatný image instalace.');
    const file = path.join(this.stateDir, 'runtime.env');
    writeFileSync(file + '.tmp', `STUL_APP_IMAGE=${image}\n`, { mode: 0o600 });
    if (process.getuid?.() === 0) {
      const owner = statSync(this.stateDir);
      chownSync(file + '.tmp', owner.uid, owner.gid);
    }
    this.sync(file + '.tmp');
    renameSync(file + '.tmp', file);
    this.sync(this.stateDir);
  }

  snapshotPath(name) {
    if (typeof name !== 'string' || !automaticSnapshot.test(name.replace(/^manual-/, '')))
      throw new Error('Neplatný název zálohy.');
    const file = path.join(this.dataDir, 'backups', name);
    if (!lstatSync(file, { throwIfNoEntry: false })?.isFile()) throw new Error('Záloha databáze chybí.');
    return file;
  }

  hasSnapshot(name) {
    try { this.snapshotPath(name); return true; } catch { return false; }
  }

  restore(name) {
    const source = this.snapshotPath(name), target = path.join(this.dataDir, 'game.sqlite');
    copyFileSync(source, target + '.restore');
    const owner = statSync(source);
    if (process.getuid?.() === 0) chownSync(target + '.restore', owner.uid, owner.gid);
    chmodSync(target + '.restore', 0o600);
    this.sync(target + '.restore');
    for (const suffix of ['-wal', '-shm']) {
      if (existsSync(target + suffix)) unlinkSync(target + suffix);
    }
    renameSync(target + '.restore', target);
    this.sync(this.dataDir);
  }

  prune(safetySnapshot) {
    if (!this.keep) return;
    const dir = path.join(this.dataDir, 'backups');
    const automatic = readdirSync(dir, { withFileTypes: true })
      .filter(entry => entry.isFile() && automaticSnapshot.test(entry.name))
      .map(entry => entry.name).sort((a, b) => Number(b.split('-')[0]) - Number(a.split('-')[0]));
    const protectedNames = new Set([safetySnapshot, this.state.previous?.snapshot, ...automatic.slice(0, this.keep)]);
    for (const name of automatic) {
      if (!protectedNames.has(name)) unlinkSync(path.join(dir, name));
    }
  }

  async begin(kind, requestId, options = {}) {
    if (!['update', 'rollback', 'restore'].includes(kind)) throw new Error('Neznámá operace.');
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(requestId || '')) throw new Error('Chybí platný identifikátor požadavku.');
    if (this.state.job?.id === requestId) return this.state.job;
    if (this.state.job?.active || this.state.transaction) throw new Error('Probíhá jiná operace nebo je nutná obnova po přerušení.');
    if (kind === 'rollback' && !this.state.previous) throw new Error('Předchozí verze není k dispozici.');
    if (kind === 'restore') {
      if (options.confirmSnapshot !== options.snapshot) throw new Error('Potvrď přesný název zálohy.');
      this.snapshotPath(options.snapshot);
    }
    if (kind === 'update' && this.channel === 'development' &&
      (!options.ref || !shaPattern.test(options.expectedSha || '')))
      throw new Error('Nejprve ověř a potvrď konkrétní vývojový commit.');

    this.state.job = { id: requestId, kind, active: true, phase: 'Příprava', logs: [], startedAt: new Date().toISOString() };
    this.save();
    this.running = Promise.resolve()
      .then(() => kind === 'update' ? this.update(options) : this.restoreOperation(kind, options.snapshot))
      .catch(error => this.failed(error))
      .finally(() => { this.state.job.active = false; this.save(); });
    return this.state.job;
  }

  async failed(error) {
    this.log(error.message);
    if (!this.state.transaction) {
      this.phase('Neúspěch — výměna aplikace nezačala');
      return;
    }
    try {
      await this.recover();
      if (!this.state.job.phase.startsWith('Hotovo')) this.phase('Neúspěch — původní verze obnovena');
    } catch (failure) {
      this.log('Obnova nedokončena: ' + failure.message);
      this.phase('Vyžaduje zásah správce — ověř stav instalace');
    }
  }

  async maintenance() {
    this.phase('Uložení zálohy databáze');
    await this.appFetch('/internal/maintenance', { enabled: true });
    const { name } = await this.appFetch('/internal/backup', {});
    this.snapshotPath(name);
    return name;
  }

  async imageContract(image) {
    const { Config } = await this.engine('GET', `/images/${encodeURIComponent(image)}/json`);
    const labels = Config?.Labels || {};
    const requires = Number(labels['cz.stul.updater-protocol'] ?? 0);
    const config = Number(labels['cz.stul.hosting-config'] ?? 0);
    if (!Number.isInteger(requires) || requires < 0 || requires > UPDATER_PROTOCOL)
      throw new Error('Vydání vyžaduje novější updater. Aktualizuj nejdřív infrastrukturu.');
    if (!Number.isInteger(config) || config < 0 || config > this.hostingConfig)
      throw new Error('Vydání vyžaduje novější konfiguraci hostingu.');
    return requires >= 1;
  }

  async installed() {
    const health = await this.appFetch('/healthz');
    const container = await this.inspect(this.name);
    if (health.maintenance) throw new Error('Instalace je už v údržbě. Nejdřív dokonči probíhající práci.');
    if (!health.ok || !supportedImage.test(container.Config.Image))
      throw new Error('Nainstalovanou aplikaci se nepodařilo ověřit.');
    return { health, container };
  }

  async update({ expectedSha, ref }) {
    const initial = await this.installed();
    let release;
    if (this.channel === 'development') release = await this.development(ref);
    else {
      await this.check(true, false);
      if (!this.latest) throw new Error(this.releaseError);
      release = this.latest;
    }
    const { health, container } = initial;
    if (health.hostingProtocol >= 1 && !expectedSha) throw new Error('Potvrď přesný commit vydání.');
    if (expectedSha && expectedSha !== release.sha)
      throw new Error('Vybrané vydání se mezitím změnilo. Zkontroluj ho a potvrď znovu.');
    const blocked = updateDecision(health, release);
    if (blocked) throw new Error(blocked);
    const version = release.tag ?? release.sha.slice(0, 12);
    this.phase(`Sestavení ${version} (může trvat několik minut)`);
    const image = await this.build(release.sha, release.tag);
    const smoke = await this.imageContract(image);
    const current = await this.installed();
    if (current.container.Id !== container.Id || current.health.revision !== health.revision)
      throw new Error('Instalace se během sestavování změnila. Zkontroluj ji a zkus to znovu.');
    await this.replace(initial, { image, revision: release.sha, smoke, phase: `Hotovo — ${version}` });
  }

  async restoreOperation(kind, selected) {
    const installed = await this.installed();
    const { health, container } = installed;
    if (kind === 'rollback') {
      const previous = this.state.previous;
      if (previous.installedRevision !== health.revision)
        throw new Error('Předchozí záloha nepatří k nainstalované verzi.');
      this.snapshotPath(previous.snapshot);
      const smoke = await this.imageContract(previous.image);
      await this.replace(installed, {
        image: previous.image, revision: previous.revision, smoke,
        restore: previous.snapshot, phase: 'Hotovo — předchozí verze i databáze obnoveny',
      });
    } else {
      this.snapshotPath(selected);
      if (!(health.hostingProtocol >= 1))
        throw new Error('Nejprve aktualizuj aplikaci na verzi s kontrolou obnovy.');
      await this.replace(installed, {
        image: container.Config.Image, revision: health.revision, smoke: true,
        restore: selected, phase: 'Hotovo — záloha databáze obnovena',
      });
    }
  }

  async replace({ health, container }, target) {
    const tx = { oldId: container.Id, image: container.Config.Image, revision: health.revision };
    this.state.transaction = tx;
    this.save();
    tx.snapshot = await this.maintenance();
    this.save();
    this.phase('Výměna aplikace');
    await this.stop(tx.oldId);
    if (target.restore) this.restore(target.restore);
    await this.engine('POST', `/containers/${tx.oldId}/rename?name=${this.name}-previous-${Date.now()}`);
    const created = await this.engine('POST', `/containers/create?name=${this.name}`, replacementConfig(container, target.image));
    tx.newId = created.Id;
    this.save();
    await this.engine('POST', `/containers/${created.Id}/start`);
    this.phase('Kontrola spuštění a služeb');
    await this.healthy(target.revision, target.smoke);
    const nextPrevious = target.restore ? null : {
      image: tx.image, revision: tx.revision, snapshot: tx.snapshot, installedRevision: target.revision,
    };
    // Once maintenance may have been lifted, restoring the old database would discard new writes.
    tx.promoted = { image: target.image, revision: target.revision, phase: target.phase, nextPrevious };
    this.save();
    await this.finishPromotion();
  }

  async recover() {
    const tx = this.state.transaction;
    if (tx.promoted) {
      await this.finishPromotion();
      return;
    }
    let named;
    try { named = await this.inspect(this.name); }
    catch (error) { if (error.statusCode !== 404) throw error; }
    if (named && named.Id !== tx.oldId) await this.remove(named.Id);
    if (tx.snapshot) {
      await this.stop(tx.oldId);
      this.restore(tx.snapshot);
    }
    const old = await this.inspect(tx.oldId);
    if (old.Name !== `/${this.name}`) await this.engine('POST', `/containers/${tx.oldId}/rename?name=${this.name}`);
    if (!old.State.Running) await this.engine('POST', `/containers/${tx.oldId}/start`);
    await this.healthy(tx.revision);
    this.runtime(tx.image);
    await this.appFetch('/internal/maintenance', { enabled: false });
    delete this.state.transaction;
    this.save();
  }

  async finishPromotion() {
    const tx = this.state.transaction;
    const { oldId, snapshot, promoted: target } = tx;
    // Retry this write before opening traffic, even if the earlier journal write threw.
    this.save();
    await this.healthy(target.revision, false, false);
    this.runtime(target.image);
    await this.appFetch('/internal/maintenance', { enabled: false });
    const previous = this.state.previous;
    const phase = this.state.job.phase;
    try {
      if (Object.hasOwn(target, 'nextPrevious')) this.state.previous = target.nextPrevious;
      delete this.state.transaction;
      this.phase(target.phase ?? 'Hotovo — ověřená verze uvedena do provozu');
    } catch (error) {
      this.state.transaction = tx;
      this.state.previous = previous;
      this.state.job.phase = phase;
      throw error;
    }
    try { await this.remove(oldId); }
    catch { this.log('Původní zastavený kontejner vyžaduje ruční odstranění.'); }
    try { this.prune(snapshot); }
    catch { this.log('Některé staré automatické zálohy se nepodařilo odstranit.'); }
  }

  async resume() {
    if (this.state.transaction) {
      this.state.job.active = true;
      this.phase('Obnova po přerušení služby');
      try {
        await this.recover();
        if (!this.state.job.phase.startsWith('Hotovo')) this.phase('Původní verze po přerušení obnovena');
      } catch (error) {
        this.log(error.message);
        this.phase('Vyžaduje zásah správce — ověř stav instalace');
      } finally { this.state.job.active = false; this.save(); }
    } else if (this.state.job?.active) {
      this.state.job.active = false;
      if (this.state.job.phase.startsWith('Hotovo')) this.save();
      else this.phase('Operace přerušena před výměnou aplikace');
    }
  }
}
