'use client';
import { useRef, useState } from 'react';
import type { Mana } from '../lib/powers';
type Person = {
    id: string;
    name: string;
    role: string;
    hp: number;
    maxHp: number;
    mana?: Mana;
};
type Mode = 'none' | 'amount' | 'full';
export default function RecoveryPanel({ members, busy, onAction, initialMemberId }: {
    members: Person[];
    initialMemberId?: string;
    busy: boolean;
    onAction: (values: Record<string, unknown>) => Promise<boolean | undefined>;
}) {
    const defaults = initialMemberId && members.some(m=>m.id===initialMemberId) ? [initialMemberId] : members.filter(m => m.role === 'player').map(m => m.id);
    const [selected, setSelected] = useState<string[]>(defaults.length ? defaults : members.slice(0, 1).map(m => m.id)), [hpMode, setHpMode] = useState<Mode>('amount'), [manaMode, setManaMode] = useState<Mode>('none'), [hpAmount, setHpAmount] = useState(1), [manaAmount, setManaAmount] = useState(1), [reason, setReason] = useState('');
    const settings = { members: [...selected].sort(), hpMode, manaMode, hpAmount, manaAmount, reason: reason.trim() }, signature = JSON.stringify(settings), [initial] = useState(signature), pending = useRef<{
        signature: string;
        id: string;
    } | null>(null);
    const targets = selected.map(id => members.find(m => m.id === id)), missing = targets.some(m => !m);
    const preview = targets.flatMap(member => { if (!member)
        return []; const mana = member.mana || { current: 0, max: 0, revision: 0 }; return [{ member, hp: hpMode === 'full' ? member.maxHp - member.hp : hpMode === 'amount' ? Math.min(Math.max(0, hpAmount), member.maxHp - member.hp) : 0, mana: manaMode === 'full' ? mana.max - mana.current : manaMode === 'amount' ? Math.min(Math.max(0, manaAmount), mana.max - mana.current) : 0 }]; });
    const changes = preview.some(p => p.hp || p.mana);
    return <><span className="eyebrow">ROZHODNUTÍ PÁNA JESKYNĚ</span><h2>Odpočinek a léčení</h2><p>Vyber postavy a obnovu podle vašich pravidel. Životy ani magenergie nepřekročí maximum. Stavy a pořadí souboje se nemění.</p><form data-dirty={signature !== initial} onSubmit={async (e) => { e.preventDefault(); if (!pending.current || pending.current.signature !== signature)
        pending.current = { signature, id: crypto.randomUUID() }; await onAction({ ...settings, expectedTargets: preview.map(({ member }) => ({ id: member.id, hp: member.hp, maxHp: member.maxHp, manaRevision: member.mana?.revision || 0 })), requestId: pending.current.id }); }}><fieldset className="recovery-members" disabled={busy}><legend>Postavy</legend><div className="recovery-selection"><button type="button" onClick={() => setSelected(defaults.length ? defaults : members.map(m => m.id))}>Vybrat družinu</button><button type="button" onClick={() => setSelected([])}>Zrušit výběr</button></div>{members.map(m => <label key={m.id}><input type="checkbox" checked={selected.includes(m.id)} onChange={e => setSelected(e.target.checked ? [...selected, m.id] : selected.filter(id => id !== m.id))}/><span>{m.name}<small>Životy {m.hp}/{m.maxHp} · Magenergie {m.mana?.current ?? 0}/{m.mana?.max ?? 0}</small></span></label>)}</fieldset><div className="recovery-fields"><div><label>Obnova životů<select aria-label="Obnova životů" value={hpMode} disabled={busy} onChange={e => setHpMode(e.target.value as Mode)}><option value="none">Beze změny</option><option value="amount">Přidat zadaný počet</option><option value="full">Doplnit do maxima</option></select></label>{hpMode === 'amount' && <label>Počet životů<input aria-label="Počet obnovovaných životů" type="number" min={1} max={9999} required value={hpAmount} disabled={busy} onChange={e => setHpAmount(Number(e.target.value))}/></label>}</div><div><label>Obnova magenergie<select aria-label="Obnova magenergie" value={manaMode} disabled={busy} onChange={e => setManaMode(e.target.value as Mode)}><option value="none">Beze změny</option><option value="amount">Přidat zadaný počet</option><option value="full">Doplnit do maxima</option></select></label>{manaMode === 'amount' && <label>Počet magů<input aria-label="Počet obnovovaných magů" type="number" min={1} max={9999} required value={manaAmount} disabled={busy} onChange={e => setManaAmount(Number(e.target.value))}/></label>}</div></div><label>Poznámka pro vybrané postavy a PJ<input maxLength={200} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} placeholder="Např. Ošetření po boji"/></label><section className="recovery-preview" aria-label="Náhled obnovy"><h3>Co se změní</h3>{!preview.length && <p>Vyber alespoň jednu postavu.</p>}{preview.map(p => <div key={p.member.id}><strong>{p.member.name}</strong><span>{p.hp || p.mana ? [p.hp ? `Životy +${p.hp}` : '', p.mana ? `Magenergie +${p.mana}` : ''].filter(Boolean).join(' · ') : 'Beze změny'}</span></div>)}{missing && <p role="alert">Některá vybraná postava už není dostupná. Uprav výběr.</p>}</section><p className="sheet-hint">Přesný výsledek se zapíše do chatu jen příslušné postavě a PJ. Náhled se průběžně aktualizuje; pokud se hodnoty změní při potvrzování, obnova se neprovede a požádá o nové potvrzení.</p><button className="primary" disabled={busy || missing || !changes}>Potvrdit obnovu</button></form></>;
}
