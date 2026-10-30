import type { Game, Member } from './game';
import { EditConflict } from './sheets';
export type Mana = {
    current: number;
    max: number;
    revision: number;
};
export type Power = {
    id: string;
    name: string;
    kind: 'spell' | 'ability';
    cost: number;
    description: string;
    revision: number;
};
export function manaOf(member: Pick<Member, 'mana'>): Mana { return member.mana || { current: 0, max: 0, revision: 0 }; }
function integer(value: unknown, label: string) { if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 9999)
    throw new Error(`${label}: zadej celé číslo od 0 do 9999.`); return value; }
function fields(b: Record<string, unknown>) { if (typeof b.name !== 'string' || !b.name.trim() || b.name.trim().length > 60)
    throw new Error('Název musí mít 1 až 60 znaků.'); if (b.kind !== 'spell' && b.kind !== 'ability')
    throw new Error('Vyber kouzlo nebo schopnost.'); if (typeof b.description !== 'string' || b.description.length > 1000)
    throw new Error('Popis smí mít nejvýše 1000 znaků.'); return { name: b.name.trim(), kind: b.kind as Power['kind'], cost: integer(b.cost, 'Cena v magenergii'), description: b.description.trim() }; }
export function powerAction(g: Game, actor: Member, b: Record<string, unknown>) {
    const target = g.members.find(m => m.id === b.memberId && !m.archived);
    if (!target || actor.role !== 'pj' && actor.id !== target.id)
        throw new Error('Kouzla a magenergii spravuje jejich hráč nebo PJ.');
    if (typeof b.requestId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(b.requestId))
        throw new Error('Chybí identifikátor akce.');
    if (g.powerOperations?.includes(b.requestId))
        return;
    const powers = target.powers || [], power = powers.find(p => p.id === b.powerId), mana = manaOf(target);
    switch (b.op) {
        case 'mana': {
            if (b.expectedManaRevision !== mana.revision)
                throw new EditConflict('Magenergie se mezitím změnila. Otevři její úpravu znovu.');
            const current = integer(b.current, 'Magenergie'), max = integer(b.max, 'Maximum magenergie');
            if (current > max)
                throw new Error('Magenergie nemůže být vyšší než maximum.');
            target.mana = { current, max, revision: mana.revision + 1 };
            break;
        }
        case 'add':
            if (powers.length >= 30)
                throw new Error('Postava může mít nejvýše 30 kouzel a schopností.');
            target.powers = [...powers, { id: crypto.randomUUID(), ...fields(b), revision: 0 }];
            break;
        case 'update':
        case 'remove':
        case 'use': {
            if (!power)
                throw new EditConflict('Kouzlo nebo schopnost už neexistuje. Zkontroluj aktuální seznam.');
            if (b.expectedPowerRevision !== power.revision)
                throw new EditConflict('Kouzlo nebo schopnost se mezitím změnilo. Otevři úpravu znovu.');
            if (b.op === 'update')
                Object.assign(power, fields(b), { revision: power.revision + 1 });
            else if (b.op === 'remove')
                target.powers = powers.filter(p => p.id !== power.id);
            else {
                if (b.expectedManaRevision !== mana.revision)
                    throw new EditConflict('Magenergie se mezitím změnila. Zkontroluj zůstatek a zopakuj použití.');
                if (typeof b.announce !== 'boolean')
                    throw new Error('Vyber, zda použití oznámit družině.');
                if (mana.current < power.cost)
                    throw new Error('Na použití není dost magenergie.');
                target.mana = { ...mana, current: mana.current - power.cost, revision: mana.revision + 1 };
                const pj = g.members.find(m => m.role === 'pj' && !m.archived)!;
                g.messages = [...g.messages, { id: crypto.randomUUID(), from: actor.id, name: target.name, text: `${target.name} · ${power.kind === 'spell' ? 'Kouzlo' : 'Schopnost'}: ${power.name}${power.cost ? ` · spotřeba ${power.cost} mag.` : '.'} Účinek vyhodnotí PJ.`, to: b.announce ? 'all' : pj.id, time: Date.now(), ...(!b.announce ? { audience: [...new Set([target.id, pj.id])] } : {}) }].slice(-500);
            }
            break;
        }
        default: throw new Error('Neznámá akce kouzel a schopností.');
    }
    g.powerOperations = [...(g.powerOperations || []), b.requestId].slice(-256);
}
