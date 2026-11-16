import { app, BrowserWindow, dialog, Menu, shell } from 'electron';
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
  try {
    settings = JSON.parse(await readFile(settingsFile, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
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
  const { port, publicOrigin, adminPassword } = settings;
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
  return { port, origin: readWebOrigin(publicOrigin, port), adminPassword };
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
  const { port, origin, adminPassword } = await loadSettings(directory);
  process.chdir(app.getAppPath());
  Object.assign(process.env, {
    NODE_ENV: 'production',
    PORT: String(port),
    PUBLIC_ORIGIN: origin,
    STUL_BIND_HOST: '127.0.0.1',
    STUL_DATA_DIR: path.join(directory, 'data'),
    STUL_ADMIN_PASSWORD: adminPassword,
    STUL_UPDATER_TOKEN: randomBytes(32).toString('hex'),
    STUL_UPDATER_URL: 'off',
  });

  const host = await import('../../server/start.mjs');
  if (!host.server.listening) await once(host.server, 'listening');
  stopServer = host.stopServer;

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
  window.webContents.session.setPermissionCheckHandler(() => false);
  window.webContents.session.setPermissionRequestHandler(
    (_webContents, _name, respond) => respond(false),
  );
  const navigate = (page) =>
    void loadPage(page).catch((error) => {
      dialog.showErrorBox('Stůl se nepodařilo otevřít', error.message);
    });
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'Stůl',
        submenu: [
          { label: 'Otevřít stůl', click: () => navigate('/') },
          { label: 'Administrace', click: () => navigate('/admin') },
          {
            label: 'Zobrazit heslo správce',
            click: () =>
              dialog.showMessageBox(window, {
                type: 'info',
                title: 'Heslo správce',
                message: 'Heslo k administraci tohoto stolu',
                detail: adminPassword,
              }),
          },
          {
            label: 'Otevřít složku s daty',
            click: () => void shell.openPath(directory),
          },
          {
            label: 'Jak spustit a hrát',
            click: () =>
              void openGuide(directory).catch((error) =>
                dialog.showErrorBox(
                  'Návod se nepodařilo otevřít',
                  error.message,
                ),
              ),
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
