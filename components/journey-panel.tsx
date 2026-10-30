'use client';
import { useRef, useState } from 'react';
import { Clock3, Flame } from 'lucide-react';
import { useDialogGuard } from './guarded-dialog';
import type { JourneyView, Light } from '../lib/journey';
const empty: JourneyView = { minutes: 0, revision: 0, lights: [], canUndo: false };
const time = (minutes: number) => minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
const status = (light: Light) => `${light.remaining === 0 ? 'Vyhořelé' : light.lit ? 'Svítí' : 'Zhasnuté'} · ${light.remaining === null ? 'bez odpočtu' : `${light.remaining} min`}`;
export function JourneySummary({ data = empty, onOpen }: {
    data?: JourneyView;
    onOpen: () => void;
}) { const lit = data.lights.filter(l => l.lit).length; return <section className="journey-summary"><button onClick={onOpen} aria-label="Čas a světlo"><Clock3 size={14}/><span>Čas a světlo<strong>{time(data.minutes)}</strong></span></button><small>{data.lights.length ? `Rozsvíceno: ${lit}/${data.lights.length}` : 'Světla zatím neevidujete'}</small>{data.lights.length > 0 && !lit && <small className="journey-dark">Žádné evidované světlo nesvítí.</small>}</section>; }
export default function JourneyPanel({ data = empty, pj, busy, onAction }: {
    data?: JourneyView;
    pj: boolean;
    busy: boolean;
    onAction: (values: Record<string, unknown>) => Promise<boolean | undefined>;
}) {
    const guard = useDialogGuard(), form = useRef<HTMLFormElement>(null), timeForm = useRef<HTMLFormElement>(null), pending = useRef<{
        signature: string;
        id: string;
    } | null>(null), [editing, setEditing] = useState<Light | null>(null), [minutes, setMinutes] = useState(10);
    async function send(values: Record<string, unknown>) { const { expectedJourneyRevision, ...intent } = values, signature = JSON.stringify(intent); if (pending.current?.signature !== signature)
        pending.current = { signature, id: crypto.randomUUID() }; if (await onAction({ ...values, requestId: pending.current.id })) {
        pending.current = null;
        return true;
    } return false; }
    async function advance(amount: number) { if (await send({ op: 'advance', minutes: amount, expectedJourneyRevision: data.revision })) {
        if (timeForm.current)
            timeForm.current.dataset.changed = 'false';
    } }
    return <><span className="eyebrow">PRŮZKUM</span><h2>Čas a světlo</h2><p>Čas i seznam světel vidí celá družina. Čas se posouvá ručně, ne podle hodin počítače. Dohled na mapě nastavuje PJ samostatně.</p><section className="journey-clock"><Clock3 size={22}/><div><small>Uplynulý čas průzkumu</small><strong>{time(data.minutes)}</strong></div></section>{pj && <form ref={timeForm} className="journey-advance" onSubmit={e => { e.preventDefault(); void advance(minutes); }}><div className="journey-quick">{[1, 10, 60].map(n => <button type="button" disabled={busy || !!editing} key={n} onClick={() => advance(n)}>+{n} min</button>)}<button type="button" disabled={busy || !!editing || !data.canUndo} onClick={() => send({ op: 'undo', expectedJourneyRevision: data.revision })}>Vrátit poslední posun</button></div><div className="journey-custom"><label>Vlastní posun v minutách<input type="number" min={1} max={1440} required value={minutes} disabled={busy || !!editing} onChange={e => setMinutes(Number(e.target.value))}/></label><button className="secondary" disabled={busy || !!editing}>Posunout čas</button></div><p className="sheet-hint">PJ započítá cestu, hledání i odpočinek. Kola souboje a stavy se tím nemění. Před posunem dokonči případnou úpravu světla.</p></form>}<section className="journey-lights" aria-label="Světla družiny"><h3>Světla družiny</h3>{!data.lights.length && <p className="sheet-hint">Zatím nejsou evidovaná žádná světla.</p>}{data.lights.map(light => <article className={'journey-light' + (light.remaining === 0 ? ' light-expired' : '')} key={light.id}><div className="journey-light-title"><Flame size={16}/><strong>{light.name}</strong><span>{status(light)}</span></div>{pj && <div className="journey-light-actions"><button disabled={busy || editing?.id === light.id || !light.lit && light.remaining === 0} onClick={() => send({ op: 'toggle', lightId: light.id, lit: !light.lit, expectedLightRevision: light.revision })}>{light.lit ? 'Zhasnout' : 'Rozsvítit'}</button><button disabled={busy} onClick={() => guard(() => setEditing({ ...light }))}>Upravit / doplnit</button><button disabled={busy} onClick={() => { const remove = async () => { if (await send({ op: 'remove', lightId: light.id, expectedLightRevision: light.revision })) {
        if (editing?.id === light.id)
            setEditing(null);
    } }; if (editing?.id === light.id)
        guard(() => void remove());
    else
        void remove(); }}>Odebrat</button></div>}</article>)}</section>{pj && <><h3>{editing ? 'Upravit světlo' : 'Přidat světlo'}</h3><form ref={form} key={`${editing?.id || 'new'}:${editing?.revision ?? 0}`} onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); if (await send({ op: editing ? 'update' : 'add', ...(editing ? { lightId: editing.id, expectedLightRevision: editing.revision } : {}), name: String(f.get('name') || ''), remaining: f.get('remaining') === '' ? null : Number(f.get('remaining')), lit: f.get('lit') === 'on' })) {
        if (form.current) {
            form.current.reset();
            form.current.dataset.changed = 'false';
        }
        setEditing(null);
    } }}><label>Název světla<input name="name" list="journey-light-names" maxLength={40} required defaultValue={editing?.name || ''} placeholder="Např. Borinova pochodeň"/></label><datalist id="journey-light-names"><option value="Pochodeň"/><option value="Lucerna"/><option value="Magické světlo"/></datalist><label>Zbývající doba v minutách (nepovinné)<input name="remaining" type="number" min={0} max={10080} defaultValue={editing?.remaining ?? ''} placeholder="Bez odpočtu"/></label><label className="journey-lit"><input name="lit" type="checkbox" defaultChecked={editing?.lit ?? true}/> Světlo je rozsvícené</label><p className="sheet-hint">Dobu určete podle vašich pravidel. Zhasnuté světlo se nespotřebovává; prázdná doba znamená bez odpočtu. Při nule světlo zhasne a zůstane označené jako vyhořelé. Zásoby ve výbavě evidujte ručně.</p><div className="journey-form-actions"><button className="primary" disabled={busy || !editing && data.lights.length >= 24}>{editing ? 'Uložit světlo' : 'Přidat světlo'}</button>{editing && <button type="button" className="secondary" disabled={busy} onClick={() => guard(() => setEditing(null))}>Nové světlo</button>}</div></form></>}</>;
}
