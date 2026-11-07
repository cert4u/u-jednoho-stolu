import {bestiaryEntries} from '../bestiary';
import {dungeonPresets} from '../dungeon-presets';
import {adventureTemplates} from '../adventure-templates';
import {sceneryCatalog} from '../scenery-catalog';
import pkg from '../../package.json' with {type:'json'};
import builtinDigest from '../../content/builtin-digest';
import type {InstalledCatalog} from './model';
// Built-ins stay in the distribution and are never imported into editable tables.
export const builtinCatalog:InstalledCatalog={
  kind:'builtin',enabled:true,revision:0,digest:builtinDigest,
  bundle:{manifest:{schemaVersion:1,id:'builtin',name:'Výchozí katalog',version:pkg.version,author:'U jednoho stolu',license:'Viz licence a původ obsahu v repozitáři',description:'Obsah dodávaný s aplikací.',minAppVersion:'1.1.0',dependencies:[],fileLicenses:{}},
    entries:{bestiary:bestiaryEntries,'dungeon-presets':dungeonPresets,adventures:adventureTemplates,scenery:sceneryCatalog.map(({kind:_,...entry})=>entry)},documents:{},assets:[]},
};
