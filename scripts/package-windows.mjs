import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const windows = process.platform === 'win32';
const electronVersion = '45.3.3';
const electronDigest =
  '49dd2d3875944f08de03d34595cd30093c588b9edcabb41a0ac481028a3a5a8a';
const exeName = 'U jednoho stolu';
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Spusť npm run build:windows.');

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Příkaz ${command} skončil chybou.`);
}

const build = JSON.parse(
  await readFile(path.join(root, 'dist/stul-build.json'), 'utf8'),
);
const manifest = JSON.parse(
  await readFile(path.join(root, 'package.json'), 'utf8'),
);
const output = path.join(
  root,
  'outputs',
  `u-jednoho-stolu-${manifest.version}-windows-x64-portable.exe`,
);
if (build.version !== manifest.version)
  throw new Error('Sestav Node verzi ze stejného checkoutu.');

const stage = await mkdtemp(path.join(os.tmpdir(), 'stul-portable-'));
try {
  const bundle = path.join(stage, exeName);
  const application = path.join(bundle, 'resources', 'app');
  await mkdir(bundle);
  const electronZip = process.env.STUL_ELECTRON_ZIP
    ? path.resolve(process.env.STUL_ELECTRON_ZIP)
    : path.join(stage, 'electron.zip');
  if (!process.env.STUL_ELECTRON_ZIP) {
    const release = `https://github.com/electron/electron/releases/download/v${electronVersion}`;
    run(windows ? 'curl.exe' : 'curl', [
      '--fail',
      '--silent',
      '--show-error',
      '--location',
      '--retry',
      '2',
      '--max-time',
      '180',
      `${release}/electron-v${electronVersion}-win32-x64.zip`,
      '--output',
      electronZip,
    ]);
  }
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(electronZip)) hash.update(chunk);
  if (hash.digest('hex') !== electronDigest)
    throw new Error('Nesouhlasí kontrolní součet Electronu.');

  if (windows) run('tar.exe', ['-xf', electronZip, '-C', bundle]);
  else run('unzip', ['-q', electronZip, '-d', bundle]);
  await rename(
    path.join(bundle, 'electron.exe'),
    path.join(bundle, exeName + '.exe'),
  );
  await rm(path.join(bundle, 'resources/default_app.asar'), { force: true });

  await mkdir(application, { recursive: true });
  for (const file of [
    'dist',
    'server',
    'drizzle',
    'LICENSE',
    'THIRD_PARTY_NOTICES.md',
    'package-lock.json',
  ])
    await cp(path.join(root, file), path.join(application, file), {
      recursive: true,
    });
  await cp(
    path.join(root, 'deploy/desktop/main.mjs'),
    path.join(application, 'deploy/desktop/main.mjs'),
  );
  await cp(
    path.join(root, 'docs/WINDOWS.md'),
    path.join(application, 'docs/WINDOWS.md'),
  );
  await writeFile(
    path.join(application, 'package.json'),
    JSON.stringify(
      {
        ...manifest,
        productName: exeName,
        main: 'deploy/desktop/main.mjs',
      },
      null,
      2,
    ) + '\n',
  );

  run(
    process.execPath,
    [
      npm,
      'ci',
      '--omit=dev',
      '--include=optional',
      '--os=win32',
      '--cpu=x64',
      '--ignore-scripts',
      '--no-bin-links',
      '--no-audit',
      '--no-fund',
    ],
    application,
  );
  await cp(
    path.join(root, 'deploy/desktop/portable.nsi'),
    path.join(stage, 'portable.nsi'),
  );
  const compiler =
    process.env.STUL_MAKENSIS || (windows ? 'makensis.exe' : 'makensis');
  run(compiler, ['portable.nsi'], stage);
  await mkdir(path.dirname(output), { recursive: true });
  await cp(path.join(stage, 'portable.exe'), output);
  console.log(output);
} finally {
  await rm(stage, { recursive: true, force: true });
}
