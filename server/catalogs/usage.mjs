// Campaign references are inspected independently of catalog editing/import.
import { readCampaigns } from './repository.mjs';
export function catalogUsage(id) {
    const usages = [];
    for (const row of readCampaigns()) {
        const game = JSON.parse(row.data), pins = game.contentLibrary?.entries ?? [], refs = [];
        for (const m of game.monsters ?? []) {
            if (m.templateId?.startsWith(id + ':')) {
                refs.push(['bestiary', m.templateId]);
            }
        }
        const maps = [game.dungeon, ...(game.mapHistory ?? []), ...(game.atlas?.levels.flatMap(l => [l.map, l.memory, ...l.history]) ?? [])].filter(Boolean);
        for (const map of maps) {
            for (const p of [...(map.scenery ?? []), ...(map.surfaces ?? [])]) {
                if (p.kind.startsWith(id + ':')) {
                    refs.push(['scenery', p.kind]);
                }
            }
        }
        if (refs.length || pins.some(p => p.catalogId === id)) {
            usages.push({ room: row.id, preserved: refs.every(([type, ref]) => pins.some(p => p.type === type && p.catalogId === id && p.data.id === ref.slice(id.length + 1))) });
        }
    }
    return usages;
}
export function assertEntryUnused(id, type, itemId) {
    for (const row of readCampaigns()) {
        if (JSON.parse(row.data).contentLibrary?.entries.some(p => p.catalogId === id && p.type === type && p.data.id === itemId)) {
            throw new Error('Položku používá kampaň. Zachovej ji v katalogu nebo vytvoř novou variantu.');
        }
    }
}
