import { app, BrowserWindow, clipboard, dialog, Menu, shell } from 'electron';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

let window;
let stopServer;
let quitting = false;

function readWebOrigin(value, port) {
  const local = `http://127.0.0.1:${port}`;
  const url = new URL(value || local);
  if (
    (url.origin !== local && url.protocol !== 'https:') ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'publicOrigin nastav na HTTPS adresu stolu bez cesty, nebo ponech prázdný.',
    );
  }
  return url.origin;
}

async function loadSettings(directory) {
  const settingsFile = path.join(directory, 'nastaveni.json');
  let settings;
  let firstRun = false;
  try {
    settings = JSON.parse(await readFile(settingsFile, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    firstRun = true;
    settings = {
      port: 8080,
      publicOrigin: '',
      adminPassword: randomBytes(18).toString('hex'),
    };
    await writeFile(settingsFile, JSON.stringify(settings, null, 2) + '\n', {
      flag: 'wx',
      mode: 0o600,
    });
  }
  const { port, publicOrigin, publicPort = 8081, adminPassword } = settings;
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error('V nastaveni.json zadej port v rozsahu 1024 až 65535.');
  if (
    typeof adminPassword !== 'string' ||
    adminPassword.length < 20 ||
    adminPassword.length > 1024
  )
    throw new Error(
      'Heslo správce v nastaveni.json musí mít 20 až 1024 znaků.',
    );
  const origin = `http://127.0.0.1:${port}`;
  const configuredOrigin = readWebOrigin(publicOrigin, port);
  return {
    port,
    origin,
    shareOrigin: configuredOrigin === origin ? '' : configuredOrigin,
    publicPort,
    adminPassword,
    firstRun,
  };
}

async function openGuide(directory) {
  const guide = await readFile(
    new URL('../../docs/WINDOWS.md', import.meta.url),
    'utf8',
  );
  const destination = path.join(directory, 'Jak spustit a hrát.txt');
  await writeFile(destination, '\uFEFF' + guide, 'utf8');
  const error = await shell.openPath(destination);
  if (error) throw new Error(error);
}

function openExternalLink(value) {
  const target = new URL(value);
  if (['http:', 'https:'].includes(target.protocol)) {
    void shell.openExternal(target.href).catch(() => {});
  }
}

async function startDesktop() {
  const directory = path.join(app.getPath('userData'), 'Stul');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const { port, origin, shareOrigin, publicPort, adminPassword, firstRun } =
    await loadSettings(directory);
  process.chdir(app.getAppPath());
  Object.assign(process.env, {
    NODE_ENV: 'production',
    PORT: String(port),
    PUBLIC_ORIGIN: origin,
    STUL_BIND_HOST: '127.0.0.1',
    STUL_DESKTOP: '1',
    STUL_DESKTOP_SHARE_ORIGIN: shareOrigin,
    STUL_DESKTOP_SHARE_PORT: String(publicPort),
    STUL_DATA_DIR: path.join(directory, 'data'),
    STUL_ADMIN_PASSWORD: adminPassword,
    STUL_UPDATER_TOKEN: randomBytes(32).toString('hex'),
    STUL_UPDATER_URL: 'off',
  });

  const host = await import('../../server/start.mjs');
  if (!host.server.listening) await once(host.server, 'listening');
  stopServer = host.stopServer;
  const sharing = await host.startDesktopSharing().then(
    () => shareOrigin,
    () => '',
  );

  window = new BrowserWindow({
    show: false,
    width: 1440,
    height: 920,
    minWidth: 720,
    minHeight: 520,
    title: 'U jednoho stolu',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  const loadPage = (page = '/') => window.loadURL(new URL(page, origin).href);
  window.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== origin) {
      event.preventDefault();
      openExternalLink(url);
    }
  });
  window.webContents.on('will-redirect', (event, url) => {
    if (new URL(url).origin !== origin) event.preventDefault();
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternalLink(url);
    return { action: 'deny' };
  });
  const trustedClipboard = (permission, requestingUrl) =>
    permission === 'clipboard-sanitized-write' &&
    new URL(requestingUrl).origin === origin;
  window.webContents.session.setPermissionCheckHandler(
    (_webContents, permission, requestingOrigin) =>
      requestingOrigin === origin && permission === 'clipboard-sanitized-write',
  );
  window.webContents.session.setPermissionRequestHandler(
    (_webContents, permission, respond, details) =>
      respond(
        details.isMainFrame &&
          trustedClipboard(permission, details.requestingUrl),
      ),
  );
  const navigate = (page) =>
    void loadPage(page).catch((error) => {
      dialog.showErrorBox('Stůl se nepodařilo otevřít', error.message);
    });
  function showGuide() {
    return openGuide(directory).catch((error) =>
      dialog.showErrorBox('Návod se nepodařilo otevřít', error.message),
    );
  }
  async function showWelcome() {
    const { response } = await dialog.showMessageBox(window, {
      type: 'info',
      title: 'Vítej u stolu',
      message: 'Jak chceš začít?',
      detail:
        'Stůl můžeš vyzkoušet hned. Pro kamarády z jiné sítě máme návod ke sdílení.',
      buttons: ['Vyzkoušet stůl', 'Pozvat kamarády přes internet'],
      defaultId: 0,
      cancelId: 0,
    });
    if (response === 1) await showGuide();
  }
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'Stůl',
        submenu: [
          { label: 'Otevřít stůl', click: () => navigate('/') },
          { label: 'Administrace', click: () => navigate('/admin') },
          {
            label: 'Zobrazit heslo správce',
            click: async () => {
              const { response } = await dialog.showMessageBox(window, {
                type: 'info',
                title: 'Heslo správce',
                message: 'Heslo k administraci tohoto stolu',
                detail: adminPassword,
                buttons: ['Zavřít', 'Zkopírovat do schránky'],
                defaultId: 0,
                cancelId: 0,
              });
              if (response === 1) clipboard.writeText(adminPassword);
            },
          },
          {
            label: 'Otevřít složku s daty',
            click: () => void shell.openPath(directory),
          },
          { label: 'Jak spustit a hrát', click: () => void showGuide() },
          {
            label: 'Připojení družiny',
            click: () =>
              void dialog.showMessageBox(window, {
                type: 'info',
                title: 'Připojení družiny',
                message: sharing
                  ? 'Adresa pozvánek je nastavená'
                  : 'Stůl běží místně',
                detail: sharing
                  ? sharing +
                    '\nDostupnost ověř z jiné sítě. Sdílení spravuješ v nástroji, kterým je zapínáš.'
                  : 'Postup pro domácí síť a sdílení přes internet najdeš v návodu.',
              }),
          },
          { type: 'separator' },
          { label: 'Ukončit stůl', role: 'quit' },
        ],
      },
      {
        label: 'Zobrazení',
        submenu: [
          { role: 'reload', label: 'Obnovit' },
          { role: 'togglefullscreen', label: 'Celá obrazovka' },
        ],
      },
    ]),
  );
  window.once('ready-to-show', () => window.show());
  await loadPage();
  if (firstRun) await showWelcome();
  if (shareOrigin && !sharing) {
    void dialog.showMessageBox(window, {
      type: 'warning',
      title: 'Port pro veřejnou hru se neotevřel',
      message: 'Stůl je dostupný místně.',
      detail:
        'Zkontroluj, jestli je veřejný port volný, případně změň publicPort v nastaveni.json.',
    });
  }
}

if (app.requestSingleInstanceLock()) {
  app.on('second-instance', () => {
    if (window?.isMinimized()) window.restore();
    window?.focus();
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', (event) => {
    if (!stopServer || quitting) return;
    event.preventDefault();
    quitting = true;
    void stopServer().finally(() => app.quit());
  });
  void app
    .whenReady()
    .then(startDesktop)
    .catch((error) => {
      dialog.showErrorBox(
        'U jednoho stolu se nepodařilo spustit',
        error.message,
      );
      app.quit();
    });
} else {
  app.quit();
}
