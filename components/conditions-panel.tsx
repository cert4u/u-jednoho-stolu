'use client';
import { useRef, useState } from 'react';
import { useDialogGuard } from './guarded-dialog';
import type { Condition } from '../lib/conditions';
import type { InitiativeEntry, InitiativeRef } from '../lib/initiative';
import type { MonsterView } from '../lib/monsters';
import ConditionBadges from './condition-badges';
type Person = {
    id: string;
    name: string;
    role: string;
    conditions?: Condition[];
};
const keyOf = (ref: InitiativeRef) => `${ref.type}:${ref.id}`;
export default function ConditionsPanel({ members, monsters, participants, initialTarget, busy, onAction }: {
    members: Person[];
    monsters: MonsterView[];
    participants: InitiativeEntry[];
    initialTarget?: InitiativeRef;
    busy: boolean;
    onAction: (values: Record<string, unknown>) => Promise<boolean | undefined>;
}) {
    const guard = useDialogGuard(), form = useRef<HTMLFormElement>(null), pending = useRef<{
        signature: string;
        id: string;
    } | null>(null);
    const actors = [...new Map([...participants.map(p => ({ key: p.key, name: p.name, conditions: p.conditions || [] })), ...members.filter(m => m.role === 'player').map(m => ({ key: 'member:' + m.id, name: m.name, conditions: m.conditions || [] })), ...monsters.filter(m => !m.archived).map(m => ({ key: 'monster:' + m.id, name: `${m.name} #${m.number}`, conditions: m.conditions || [] }))].map(a => [a.key, a])).values()];
    const [selected, setSelected] = useState(initialTarget ? keyOf(initialTarget) : actors[0]?.key || ''), [editing, setEditing] = useState<Condition | null>(null);
    const who = actors.find(a => a.key === selected), [type, id] = selected.split(':');
    async function send(data: Record<string, unknown>) { const values = { ...data, target: { type, id } }, signature = JSON.stringify(values); if (pending.current?.signature !== signature)
        pending.current = { signature, id: crypto.randomUUID() }; if (await onAction({ ...values, requestId: pending.current.id })) {
        pending.current = null;
        return true;
    } return false; }
    return <><span className="eyebrow">POZNÁMKY K ÚČASTNÍKŮM</span><h2>Stavy postav a příšer</h2><p>Stavy zapisuje PJ. Slouží jako připomínka; bonusy k hodům a životy podle nich upravuj ručně.</p><label>Účastník<select aria-label="Účastník pro stavy" value={selected} disabled={busy} onChange={e => { const value = e.target.value; guard(() => { setSelected(value); setEditing(null); }); }}>{!who && <option value={selected}>{selected ? 'Účastník už není dostupný' : 'Vyber účastníka'}</option>}{actors.map(a => <option key={a.key} value={a.key}>{a.name}</option>)}</select></label>{!actors.length && <p className="sheet-hint">Nejdřív přizvi hráče nebo připrav příšery.</p>}{who && <><section className="condition-list" aria-label="Aktuální stavy">{!who.conditions.length && <p className="sheet-hint">Zatím bez stavů.</p>}{who.conditions.map(c => <article className="condition-card" key={c.id}><ConditionBadges items={[c]}/>{c.note && <p>{c.note}</p>}<small>{c.secret ? 'Jen pro PJ' : 'Vidí i hráči'}{c.rounds === 0 ? ' · Počet kol doběhl — rozhodni o ukončení stavu.' : ''}</small><div className="condition-card-actions"><button type="button" disabled={busy} onClick={() => guard(() => setEditing({ ...c }))}>Upravit</button>{c.rounds !== null && <button type="button" disabled={busy || c.rounds === 0} onClick={() => send({ op: 'tick', conditionId: c.id, expectedRevision: c.revision })}>O kolo méně</button>}<button type="button" disabled={busy} onClick={async () => { if (await send({ op: 'remove', conditionId: c.id, expectedRevision: c.revision })) {
        if (editing?.id === c.id)
            setEditing(null);
    } }}>Odebrat</button></div></article>)}</section><h3>{editing ? 'Upravit stav' : 'Přidat stav'}</h3><form ref={form} key={`${selected}:${editing?.id || 'new'}:${editing?.revision ?? 0}`} onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); if (await send({ op: editing ? 'update' : 'add', ...(editing ? { conditionId: editing.id, expectedRevision: editing.revision } : {}), label: String(f.get('label') || ''), note: String(f.get('note') || ''), rounds: f.get('rounds') === '' ? null : Number(f.get('rounds')), secret: f.get('secret') === 'on' })) {
        if (form.current) {
            form.current.reset();
            form.current.dataset.changed = 'false';
        }
        setEditing(null);
    } }}><label>Název stavu<input name="label" required maxLength={40} list="condition-presets" defaultValue={editing?.label || ''} placeholder="Např. Otrávený"/></label><datalist id="condition-presets">{['Otrávený', 'Ochromený', 'V bezvědomí', 'Oslepený', 'Vystrašený', 'Vyčerpaný', 'Posílený'].map(label => <option key={label} value={label}/>)}</datalist><label>Poznámka<textarea name="note" maxLength={300} rows={2} defaultValue={editing?.note || ''} placeholder="Účinek nebo podmínka ukončení"/></label><label>Zbývající kola (nepovinné)<input name="rounds" type="number" min={0} max={999} defaultValue={editing?.rounds ?? ''} placeholder="Bez počítání kol"/></label><label className="condition-secret"><input type="checkbox" name="secret" defaultChecked={editing?.secret || false}/> Tajný stav — vidí pouze PJ</label><p className="sheet-hint">Kola odečítáš tlačítkem „O kolo méně“. Při nule stav zůstane označený, dokud ho PJ neodebere. Veřejný stav včetně poznámky vidí družina; u příšer jen tehdy, když je právě vidí na mapě.</p><div className="condition-form-actions"><button className="primary" disabled={busy || !editing && who.conditions.length >= 12}>{editing ? 'Uložit stav' : 'Přidat stav'}</button>{editing && <button type="button" className="secondary" disabled={busy} onClick={() => guard(() => setEditing(null))}>Nový stav</button>}</div></form></>}</>;
}
