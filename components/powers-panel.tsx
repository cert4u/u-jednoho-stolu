'use client';
import { useRef, useState } from 'react';
import { useDialogGuard } from './guarded-dialog';
import type { Power, Mana } from '../lib/powers';
type Person = {
    id: string;
    name: string;
    mana?: Mana;
    powers?: Power[];
};
type Send = (values: Record<string, unknown>) => Promise<boolean | undefined>;
const emptyMana: Mana = { current: 0, max: 0, revision: 0 };
function ManaEditor({ mana, busy, onSave, onClose }: {
    mana: Mana;
    busy: boolean;
    onSave: Send;
    onClose: () => void;
}) {
    const [initial] = useState(mana);
    return <form className="mana-editor" onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); if (await onSave({ op: 'mana', current: Number(f.get('current')), max: Number(f.get('max')), expectedManaRevision: initial.revision }))
        onClose(); }}><div className="mana-fields"><label>Aktuální magenergie<input name="current" type="number" min={0} max={9999} defaultValue={initial.current} required/></label><label>Maximum magenergie<input name="max" type="number" min={0} max={9999} defaultValue={initial.max} required/></label></div>{initial.revision !== mana.revision && <p className="sheet-hint">Magenergie se mezitím změnila. Před uložením otevři úpravu znovu.</p>}<button className="secondary" disabled={busy}>Uložit magenergii</button></form>;
}
export default function PowersPanel({ members, me, pj, busy, onAction }: {
    members: Person[];
    me: string;
    pj: boolean;
    busy: boolean;
    onAction: Send;
}) {
    const guard = useDialogGuard(), form = useRef<HTMLFormElement>(null), pending = useRef<{
        signature: string;
        id: string;
    } | null>(null);
    const actors = members.filter(m => pj || m.id === me), [selected, setSelected] = useState(me), [editing, setEditing] = useState<Power | null>(null), [editMana, setEditMana] = useState(false), [announce, setAnnounce] = useState(false);
    const who = actors.find(m => m.id === selected), mana = who?.mana || emptyMana;
    async function send(data: Record<string, unknown>) { const values = { ...data, memberId: selected }, signature = JSON.stringify(values); if (pending.current?.signature !== signature)
        pending.current = { signature, id: crypto.randomUUID() }; if (await onAction({ ...values, requestId: pending.current.id })) {
        pending.current = null;
        return true;
    } return false; }
    return <><span className="eyebrow">DENÍK A MAGENERGIE</span><h2>Kouzla a schopnosti</h2><p>Vlastní seznam vidí hráč postavy a PJ. Použití odečte magenergii; účinek, cíle a potřebné hody vyhodnoťte u stolu.</p>{pj && <label>Postava<select aria-label="Postava pro kouzla" value={selected} disabled={busy} onChange={e => { const value = e.target.value; guard(() => { setSelected(value); setEditing(null); setEditMana(false); setAnnounce(false); }); }}>{!who && <option value={selected}>Postava už není dostupná</option>}{actors.map(m => <option value={m.id} key={m.id}>{m.name}</option>)}</select></label>}{who ? <><section className="mana-card"><div><strong>Magenergie</strong><span>{mana.current} / {mana.max}</span></div><button className="secondary" disabled={busy} onClick={() => guard(() => setEditMana(!editMana))}>{editMana ? 'Zavřít úpravu' : 'Upravit magenergii'}</button>{editMana && <ManaEditor key={selected} mana={mana} busy={busy} onSave={send} onClose={() => setEditMana(false)}/>}</section><label className="power-announce"><input type="checkbox" checked={announce} onChange={e => setAnnounce(e.target.checked)}/> Použití oznámit celé družině</label><p className="sheet-hint">Bez oznámení se záznam v chatu zobrazí pouze hráči této postavy a PJ. Veřejné oznámení obsahuje název a cenu; popis kouzla zůstává soukromý.</p><section className="power-list" aria-label="Seznam kouzel a schopností">{!who.powers?.length && <p className="sheet-hint">Zatím prázdný seznam. Přidej vlastní kouzlo nebo schopnost.</p>}{who.powers?.map(power => <article className="power-card" key={power.id}><div className="power-title"><strong>{power.name}</strong><span>{power.kind === 'spell' ? 'Kouzlo' : 'Schopnost'} · {power.cost} mag.</span></div>{power.description && <details><summary>Popis</summary><p>{power.description}</p></details>}<div className="power-actions"><button className="power-use" disabled={busy || mana.current < power.cost} onClick={() => send({ op: 'use', powerId: power.id, expectedPowerRevision: power.revision, expectedManaRevision: mana.revision, announce })}>Použít {power.name}</button><button disabled={busy} onClick={() => guard(() => setEditing({ ...power }))}>Upravit</button><button disabled={busy} onClick={() => { const remove = async () => { if (await send({ op: 'remove', powerId: power.id, expectedPowerRevision: power.revision })) {
        if (editing?.id === power.id)
            setEditing(null);
    } }; if (editing?.id === power.id)
        guard(() => void remove());
    else
        void remove(); }}>Odebrat</button></div>{mana.current < power.cost && <small className="power-shortage">Nedostatek magenergie.</small>}</article>)}</section><h3>{editing ? 'Upravit kouzlo nebo schopnost' : 'Přidat kouzlo nebo schopnost'}</h3><form ref={form} key={`${selected}:${editing?.id || 'new'}:${editing?.revision ?? 0}`} onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); if (await send({ op: editing ? 'update' : 'add', ...(editing ? { powerId: editing.id, expectedPowerRevision: editing.revision } : {}), name: String(f.get('name') || ''), kind: String(f.get('kind')), cost: Number(f.get('cost')), description: String(f.get('description') || '') })) {
        if (form.current) {
            form.current.reset();
            form.current.dataset.changed = 'false';
        }
        setEditing(null);
    } }}><label>Název<input name="name" maxLength={60} defaultValue={editing?.name || ''} required placeholder="Název z tvého dobrodružství"/></label><div className="mana-fields"><label>Druh<select name="kind" defaultValue={editing?.kind || 'spell'}><option value="spell">Kouzlo</option><option value="ability">Schopnost</option></select></label><label>Cena v magenergii<input name="cost" type="number" min={0} max={9999} defaultValue={editing?.cost ?? 0} required/></label></div><label>Popis a poznámky<textarea name="description" rows={3} maxLength={1000} defaultValue={editing?.description || ''}/></label><p className="sheet-hint">Schopnost může mít cenu 0. Obnovu magenergie zapisuj ručně podle rozhodnutí PJ. Připravené seznamy z pravidlových příruček aplikace neobsahuje.</p><div className="power-form-actions"><button className="primary" disabled={busy || !editing && (who.powers?.length || 0) >= 30}>{editing ? 'Uložit změny' : 'Přidat do seznamu'}</button>{editing && <button type="button" className="secondary" disabled={busy} onClick={() => guard(() => setEditing(null))}>Nový záznam</button>}</div></form></> : <p>Vybraná postava už není dostupná.</p>}</>;
}
