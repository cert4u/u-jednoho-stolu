import { compareVersions } from './versions.mjs';

const base = 'https://api.github.com/repos/cert4u/u-jednoho-stolu';
const shaPattern = /^[a-f0-9]{40}$/;
const previewTag = /^v\d+\.\d+\.\d+-/;
const stableTag = /^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;

async function github(endpoint) {
  const response = await fetch(base + endpoint, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'u-jednoho-stolu-updater',
    },
    signal: AbortSignal.timeout(5500),
  });
  if (!response.ok) throw new Error(`GitHub neodpovídá (${response.status}).`);
  const payload = await response.text();
  if (payload.length > 1e6) throw new Error('Odpověď GitHubu je příliš velká.');
  return JSON.parse(payload);
}

async function releaseCI(sha) {
  try {
    const { workflow_runs: runs } = await github(`/actions/workflows/ci.yml/runs?head_sha=${sha}&per_page=5`);
    const run = runs.find(item => item.head_sha === sha);
    if (run && Number.isSafeInteger(run.id)) return {
      status: run.status === 'completed' ? (run.conclusion === 'success' ? 'passed' : 'failed') : 'pending',
      url: `https://github.com/cert4u/u-jednoho-stolu/actions/runs/${run.id}`,
    };
  } catch { /* CI information is optional and does not substitute for a local smoke test. */ }
  return { status: 'unknown' };
}

function releaseInfo(body) {
  const marker = body.match(/<!--\s*stul-release\s+({[^\n]*})\s*-->/);
  try {
    const data = marker ? JSON.parse(marker[1]) : {};
    return Object.fromEntries(['migrations', 'updater', 'config'].map(key =>
      [key, typeof data?.[key] === 'boolean' ? data[key] : null]));
  } catch { return { migrations: null, updater: null, config: null }; }
}

export async function latestRelease(channel = 'stable', { includeCI = false } = {}) {
  const release = channel === 'preview'
    ? (await github('/releases?per_page=20'))
      .filter(item => !item.draft && item.tag_name?.startsWith('v') &&
        compareVersions(item.tag_name, item.tag_name) === 0 &&
        (item.prerelease ? previewTag.test(item.tag_name) : stableTag.test(item.tag_name)))
      .sort((a, b) => compareVersions(b.tag_name, a.tag_name))[0]
    : await github('/releases/latest');
  const tag = release?.tag_name;
  if (!release || release.draft || typeof tag !== 'string' || !tag.startsWith('v') ||
      compareVersions(tag, tag) === null ||
      (release.prerelease ? channel !== 'preview' || !previewTag.test(tag) : !stableTag.test(tag)))
    throw new Error('GitHub nenabízí vydání s podporovaným označením.');

  let { object } = await github('/git/ref/tags/' + encodeURIComponent(tag));
  for (let i = 0; object?.type === 'tag' && shaPattern.test(object.sha) && i < 5; i++)
    ({ object } = await github('/git/tags/' + object.sha));
  if (object?.type !== 'commit' || !shaPattern.test(object.sha))
    throw new Error('Nelze ověřit commit vydání.');

  const notes = typeof release.body === 'string' ? release.body : '';
  return {
    tag, sha: object.sha,
    url: 'https://github.com/cert4u/u-jednoho-stolu/releases/tag/' + encodeURIComponent(tag),
    notes: notes.replace(/<!--\s*stul-release\s+{[^\n]*}\s*-->/, '').trim().slice(0, 12000),
    requirements: releaseInfo(notes),
    ...(includeCI && { ci: await releaseCI(object.sha) }),
  };
}

export async function developmentRelease(ref, { includeCI = false } = {}) {
  if (typeof ref !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,119}$/.test(ref) ||
      ref.includes('..') || ref.split('/').some(part => !part || part.startsWith('.') || part.endsWith('.lock')))
    throw new Error('Zadej název větve nebo plný SHA commitu.');
  const bySha = shaPattern.test(ref);
  const data = await github((bySha ? '/commits/' : '/branches/') + encodeURIComponent(ref));
  const sha = bySha ? data.sha : data.commit?.sha;
  if (!shaPattern.test(sha) || (bySha && sha !== ref)) throw new Error('Nelze ověřit vývojový commit.');
  return { tag: null, ref, sha, url: `https://github.com/cert4u/u-jednoho-stolu/commit/${sha}`,
    ...(includeCI && { ci: await releaseCI(sha) }) };
}
