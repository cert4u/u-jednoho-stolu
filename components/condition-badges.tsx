import type { Condition } from '../lib/conditions';
export default function ConditionBadges({ items = [] }: {
    items?: Condition[];
}) { if (!items.length)
    return null; return <span className="condition-badges" aria-label="Stavy">{items.map(c => <span key={c.id} className={'condition-badge' + (c.rounds === 0 ? ' condition-expired' : '')} title={[c.note, c.secret ? 'Tajný stav – jen PJ' : ''].filter(Boolean).join(' · ')}>{c.label}{c.rounds !== null && <span> · {c.rounds} {c.rounds === 1 ? 'kolo' : c.rounds >= 2 && c.rounds <= 4 ? 'kola' : 'kol'}</span>}{c.secret && <span aria-label="Tajný stav"> ◇</span>}</span>)}</span>; }
