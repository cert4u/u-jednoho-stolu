const versionPattern = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const digits = /^\d+$/;

function parse(version) {
  const match = typeof version === 'string' && version.length <= 100 && version.match(versionPattern);
  if (!match) return null;
  const prerelease = match[4]?.split('.') ?? [];
  if (prerelease.some(part => /^0\d+$/.test(part))) return null;
  return { core: match.slice(1, 4).map(BigInt), prerelease };
}

export function compareVersions(left, right) {
  const a = parse(left), b = parse(right);
  if (!a || !b) return null;
  for (let i = 0; i < a.core.length; i++) {
    if (a.core[i] !== b.core[i]) return a.core[i] < b.core[i] ? -1 : 1;
  }
  if (!a.prerelease.length || !b.prerelease.length)
    return Math.sign(b.prerelease.length ? 1 : 0) - Math.sign(a.prerelease.length ? 1 : 0);
  for (let i = 0; i < Math.min(a.prerelease.length, b.prerelease.length); i++) {
    const x = a.prerelease[i], y = b.prerelease[i];
    if (x === y) continue;
    const nx = digits.test(x), ny = digits.test(y);
    if (nx && ny) return BigInt(x) < BigInt(y) ? -1 : 1;
    if (nx !== ny) return nx ? -1 : 1;
    return x < y ? -1 : 1;
  }
  return Math.sign(a.prerelease.length - b.prerelease.length);
}

export function updateDecision(current, target) {
  if (!target) return 'Vydání zatím není k dispozici.';
  if (!current) return 'Nainstalovanou verzi se nepodařilo ověřit.';
  if (current.revision === target.sha) return 'Tento commit už je nainstalovaný.';
  if (!target.tag) return null; // An explicitly chosen Development commit has no release ordering.
  const order = compareVersions(target.tag, current.version);
  if (order === null) return 'Verze nelze bezpečně porovnat.';
  if (order < 0) return 'Vybrané vydání je starší. Návrat verze je samostatná operace.';
  if (order === 0) return 'Stejné číslo verze označuje jiný commit.';
  return null;
}
