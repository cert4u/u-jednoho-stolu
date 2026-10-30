import type { Game, Member } from './game';
import { manaOf } from './powers';
import { EditConflict } from './sheets';
type Mode = 'none' | 'amount' | 'full';
function mode(value: unknown): Mode { if (value !== 'none' && value !== 'amount' && value !== 'full')
    throw new Error('Vyber způsob obnovy životů a magenergie.'); return value; }
function amount(value: unknown) { if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 9999)
    throw new Error('Obnovu zadej jako celé číslo od 1 do 9999.'); return value; }
export function recoveryAction(g: Game, actor: Member, b: Record<string, unknown>) {
    if (actor.role !== 'pj')
        throw new Error('Odpočinek a léčení potvrzuje pouze Pán jeskyně.');
    if (typeof b.requestId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(b.requestId))
        throw new Error('Chybí identifikátor akce.');
    if (g.recoveryOperations?.includes(b.requestId))
        return;
    const hpMode = mode(b.hpMode), manaMode = mode(b.manaMode);
    if (hpMode === 'none' && manaMode === 'none')
        throw new Error('Vyber alespoň jednu obnovovanou hodnotu.');
    const hpAmount = hpMode === 'amount' ? amount(b.hpAmount) : 0, manaAmount = manaMode === 'amount' ? amount(b.manaAmount) : 0;
    if (typeof b.reason !== 'string' || b.reason.trim().length > 200)
        throw new Error('Poznámka smí mít nejvýše 200 znaků.');
    if (!Array.isArray(b.members) || !b.members.length || b.members.length > 12 || b.members.some(id => typeof id !== 'string') || new Set(b.members).size !== b.members.length)
        throw new Error('Vyber 1 až 12 různých postav.');
    const expected = b.expectedTargets;
    if (!Array.isArray(expected) || expected.length !== b.members.length || expected.some(item => !item || typeof item !== 'object' || typeof item.id !== 'string') || new Set(expected.map(item => item.id)).size !== expected.length)
        throw new EditConflict('Chybí aktuální náhled obnovy. Otevři okno znovu.');
    // Validate every target before mutating any of them: a group recovery is atomic.
    const changes = b.members.map(id => {
        const member = g.members.find(m => m.id === id && !m.archived);
        if (!member)
            throw new Error('Vybraná postava neexistuje nebo je archivovaná.');
        const baseline = expected.find(item => item.id === id), mana = manaOf(member);
        if (!baseline || hpMode !== 'none' && (baseline.hp !== member.hp || baseline.maxHp !== member.maxHp) || manaMode !== 'none' && baseline.manaRevision !== mana.revision)
            throw new EditConflict('Životy nebo magenergie se mezitím změnily. Zkontroluj nový náhled a potvrď obnovu znovu.');
        const hp = hpMode === 'full' ? member.maxHp : hpMode === 'amount' ? Math.min(member.maxHp, member.hp + hpAmount) : member.hp;
        const current = manaMode === 'full' ? mana.max : manaMode === 'amount' ? Math.min(mana.max, mana.current + manaAmount) : mana.current;
        return { member, mana, hp, current, hpGain: hp - member.hp, manaGain: current - mana.current };
    });
    if (!changes.some(c => c.hpGain || c.manaGain))
        throw new Error('Vybraným postavám není co obnovit.');
    const messages = [];
    for (const { member, mana, hp, current, hpGain, manaGain } of changes) {
        if (!hpGain && !manaGain)
            continue;
        member.hp = hp;
        if (manaGain)
            member.mana = { ...mana, current, revision: mana.revision + 1 };
        const result = [hpGain ? `životy +${hpGain} (${hp}/${member.maxHp})` : '', manaGain ? `magenergie +${manaGain} (${current}/${mana.max})` : ''].filter(Boolean).join(' · ');
        messages.push({ id: crypto.randomUUID(), from: actor.id, name: actor.name, text: `Odpočinek a léčení · ${member.name}: ${result}${b.reason.trim() ? ` · ${b.reason.trim()}` : ''}`, to: actor.id, time: Date.now(), audience: [...new Set([member.id, actor.id])] });
    }
    g.messages = [...g.messages, ...messages].slice(-500);
    g.recoveryOperations = [...(g.recoveryOperations || []), b.requestId].slice(-256);
}
