import type { Game, Member } from './game';
import type { InitiativeRef } from './initiative';
import { EditConflict } from './sheets';
export type Condition = {
    id: string;
    label: string;
    note: string;
    rounds: number | null;
    secret: boolean;
    revision: number;
};
export function visibleConditions(conditions: Condition[] | undefined, pj: boolean) { return (conditions || []).filter(c => pj || !c.secret); }
function fields(b: Record<string, unknown>) {
    if (typeof b.label !== 'string' || !b.label.trim() || b.label.trim().length > 40)
        throw new Error('Název stavu musí mít 1 až 40 znaků.');
    if (typeof b.note !== 'string' || b.note.length > 300)
        throw new Error('Poznámka ke stavu smí mít nejvýše 300 znaků.');
    if (b.rounds !== null && (typeof b.rounds !== 'number' || !Number.isInteger(b.rounds) || b.rounds < 0 || b.rounds > 999))
        throw new Error('Počet kol musí být celé číslo od 0 do 999, nebo nevyplněný.');
    if (typeof b.secret !== 'boolean')
        throw new Error('Neplatné nastavení tajného stavu.');
    return { label: b.label.trim(), note: b.note.trim(), rounds: b.rounds as number | null, secret: b.secret };
}
export function conditionAction(g: Game, actor: Member, b: Record<string, unknown>) {
    if (actor.role !== 'pj')
        throw new Error('Stavy spravuje pouze Pán jeskyně.');
    if (typeof b.requestId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(b.requestId))
        throw new Error('Chybí identifikátor akce.');
    if (g.conditionOperations?.includes(b.requestId))
        return;
    const ref = b.target as InitiativeRef | undefined;
    if (!ref || typeof ref.id !== 'string' || !['member', 'monster'].includes(ref.type))
        throw new Error('Vyber postavu nebo příšeru.');
    const target = ref.type === 'member' ? g.members.find(m => m.id === ref.id && m.role === 'player' && !m.archived) : (g.monsters || []).find(m => m.id === ref.id && !m.archived);
    if (!target)
        throw new Error('Účastník neexistuje nebo je archivovaný.');
    const conditions = target.conditions || [], condition = conditions.find(c => c.id === b.conditionId);
    if (b.op === 'add') {
        if (conditions.length >= 12)
            throw new Error('Účastník může mít nejvýše 12 stavů.');
        target.conditions = [...conditions, { id: crypto.randomUUID(), ...fields(b), revision: 0 }];
    }
    else {
        if (!condition)
            throw new EditConflict('Stav už neexistuje. Zkontroluj aktuální seznam.');
        if (b.expectedRevision !== condition.revision)
            throw new EditConflict('Stav se mezitím změnil. Otevři jeho úpravu znovu; rozepsané údaje zůstaly zachované.');
        switch (b.op) {
            case 'update':
                Object.assign(condition, fields(b), { revision: condition.revision + 1 });
                break;
            case 'remove':
                target.conditions = conditions.filter(c => c.id !== condition.id);
                break;
            case 'tick':
                if (condition.rounds === null || condition.rounds === 0)
                    throw new Error('Tento stav nemá další kolo k odečtení.');
                condition.rounds--;
                condition.revision++;
                break;
            default: throw new Error('Neznámá akce stavu.');
        }
    }
    g.conditionOperations = [...(g.conditionOperations || []), b.requestId].slice(-256);
}
