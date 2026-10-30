import type { Game, Member } from './game';
import { EditConflict } from './sheets';
export type Light = {
    id: string;
    name: string;
    remaining: number | null;
    lit: boolean;
    revision: number;
};
export type Journey = {
    minutes: number;
    revision: number;
    lights: Light[];
};
export type JourneyUndo = {
    before: Journey;
    afterRevision: number;
};
export type JourneyView = Journey & {
    canUndo: boolean;
};
export function journeyState(g: Game): Journey { return g.journey || { minutes: 0, revision: 0, lights: [] }; }
export function journeyView(g: Game, pj: boolean): JourneyView { const state = journeyState(g); return { ...state, canUndo: pj && g.journeyUndo?.afterRevision === state.revision }; }
function fields(b: Record<string, unknown>) { if (typeof b.name !== 'string' || !b.name.trim() || b.name.trim().length > 40)
    throw new Error('Název světla musí mít 1 až 40 znaků.'); if (b.remaining !== null && (typeof b.remaining !== 'number' || !Number.isInteger(b.remaining) || b.remaining < 0 || b.remaining > 10080))
    throw new Error('Dobu svícení zadej v celých minutách od 0 do 10080, nebo ji nech nevyplněnou.'); if (typeof b.lit !== 'boolean')
    throw new Error('Vyber, zda světlo svítí.'); return { name: b.name.trim(), remaining: b.remaining as number | null, lit: b.lit && b.remaining !== 0 }; }
export function journeyAction(g: Game, actor: Member, b: Record<string, unknown>) {
    if (actor.role !== 'pj')
        throw new Error('Čas a světla spravuje pouze Pán jeskyně.');
    if (typeof b.requestId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(b.requestId))
        throw new Error('Chybí identifikátor akce.');
    if (g.journeyOperations?.includes(b.requestId))
        return;
    const current = journeyState(g), next = structuredClone(current), light = next.lights.find(l => l.id === b.lightId);
    let undo: JourneyUndo | undefined, message = '';
    switch (b.op) {
        case 'add':
            if (next.lights.length >= 24)
                throw new Error('Evidovat lze nejvýše 24 světel družiny.');
            next.lights.push({ id: crypto.randomUUID(), ...fields(b), revision: 0 });
            break;
        case 'update':
        case 'toggle':
        case 'remove': {
            if (!light || b.expectedLightRevision !== light.revision)
                throw new EditConflict('Světlo se mezitím změnilo nebo bylo odebráno. Otevři úpravu znovu.');
            if (b.op === 'update')
                Object.assign(light, fields(b), { revision: light.revision + 1 });
            else if (b.op === 'remove')
                next.lights = next.lights.filter(l => l.id !== light.id);
            else {
                if (typeof b.lit !== 'boolean')
                    throw new Error('Neplatný stav světla.');
                if (b.lit && light.remaining === 0)
                    throw new Error('Vyhořelé světlo nejdřív doplň nebo vyměň.');
                light.lit = b.lit;
                light.revision++;
            }
            break;
        }
        case 'advance': {
            if (b.expectedJourneyRevision !== current.revision)
                throw new EditConflict('Čas nebo světla se mezitím změnily. Zkontroluj aktuální stav a zopakuj posun.');
            if (typeof b.minutes !== 'number' || !Number.isInteger(b.minutes) || b.minutes < 1 || b.minutes > 1440 || current.minutes + b.minutes > 9999999)
                throw new Error('Posuň čas o 1 až 1440 minut; celkem nejvýše 9999999 minut.');
            next.minutes += b.minutes;
            const expired: string[] = [];
            for (const source of next.lights)
                if (source.lit && source.remaining !== null) {
                    source.remaining = Math.max(0, source.remaining - b.minutes);
                    source.revision++;
                    if (source.remaining === 0) {
                        source.lit = false;
                        expired.push(source.name);
                    }
                }
            undo = { before: structuredClone(current), afterRevision: current.revision + 1 };
            message = `Průzkum: +${b.minutes} min (celkem ${next.minutes} min).${expired.length ? ` Doba svícení doběhla: ${expired.join(', ')}.` : ''}`;
            break;
        }
        case 'undo': {
            if (b.expectedJourneyRevision !== current.revision)
                throw new EditConflict('Čas nebo světla se mezitím změnily. Zkontroluj aktuální stav.');
            if (!g.journeyUndo || g.journeyUndo.afterRevision !== current.revision)
                throw new Error('Poslední posun času už nelze vrátit.');
            const before = g.journeyUndo.before;
            next.minutes = before.minutes;
            next.lights = before.lights.map(source => ({ ...source, revision: (current.lights.find(l => l.id === source.id)?.revision ?? source.revision) + 1 }));
            message = `Poslední posun času byl vrácen. Průzkum: celkem ${next.minutes} min.`;
            break;
        }
        default: throw new Error('Neznámá akce času a světel.');
    }
    next.revision = current.revision + 1;
    g.journey = next;
    g.journeyUndo = undo;
    g.journeyOperations = [...(g.journeyOperations || []), b.requestId].slice(-256);
    if (message)
        g.messages = [...g.messages, { id: crypto.randomUUID(), from: actor.id, name: actor.name, text: message, to: 'all', time: Date.now() }].slice(-500);
}
