import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay,setImmediate as yieldIO} from 'node:timers/promises';
await import('./generator-test-import.mjs');
const {demoFiles}=await import('./catalog-demo.mjs');
const {writeZip}=await import('../server/catalog-zip.mjs');
const {unpackCatalog}=await import('../server/catalog-pack.mjs');
const core=await import('../lib/catalogs/core.ts');
const {initialGame}=await import('../lib/game.ts');
const {startAdventure}=await import('../lib/start-adventure.ts');
const {MAX_D1_ROOM_BYTES}=await import('../lib/room-storage-limit.ts');
const {makeBackup,readBackup}=await import('../lib/backup.ts');
const dir=mkdtempSync(path.join(os.tmpdir(),'stul-stabilization-'));
const origin=process.argv[2]||'http://127.0.0.1:18096';
assert(['localhost','127.0.0.1','[::1]'].includes(new URL(origin).hostname));
let server;
const post=(action,data={},session)=>fetch(origin+'/api/game',{method:'POST',headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.token}:{})},body:JSON.stringify({action,room:session?.room,requestId:crypto.randomUUID(),...data})});
async function ok(response){assert.equal(response.status,200,await response.clone().text());return response.json();}
const get=(s,query='')=>fetch(origin+'/api/game?room='+s.room+query,{headers:{Authorization:'Bearer '+s.token}});
try{
 if(!process.argv[2]){
  server=spawn(process.execPath,['server/start.mjs'],{env:{...process.env,PORT:'18096',PUBLIC_ORIGIN:origin,STUL_DATA_DIR:dir,STUL_ADMIN_PASSWORD:'isolated-test-admin-password',STUL_UPDATER_TOKEN:'isolated-test-updater-token-32-characters'},stdio:['ignore','pipe','pipe']});
  let logs='';server.stdout.on('data',d=>logs+=d);server.stderr.on('data',d=>logs+=d);
  for(let i=0;i<150;i++){if(server.exitCode!==null)throw Error(logs);try{if((await fetch(origin+'/healthz')).ok)break;}catch{}await delay(100);}
 }
 const {bundle,images,digest}=await unpackCatalog(writeZip(await demoFiles()),core);
 const resolver=new core.CatalogResolver([{bundle,digest,kind:'community',enabled:true,revision:1}]);
 const game=initialGame('Audit',crypto.randomUUID());
 game.contentLibrary=await core.pinContent(undefined,resolver,'adventures',bundle.manifest.id+':third-bell',{read:async k=>images.get(k),builtin:async()=>{throw Error('unexpected builtin');}});
 startAdventure(game,game.members[0],bundle.manifest.id+':third-bell',new core.CatalogResolver([],game.contentLibrary));
 let session=await ok(await post('restore',{backup:makeBackup(game)}));
 const canonical=await ok(await get(session,'&download=backup'));
 const measured={baseRevision:'ef59634',node:process.version,portraitCampaignBytes:Buffer.byteLength(JSON.stringify(session.game))};
 const cloudflare=process.env.STUL_TEST_RUNTIME==='cloudflare';
 const estimate=readBackup(canonical);estimate.members.find(m=>m.role==='pj').recoveryHash='0'.repeat(64);
 const storageOverhead=Buffer.byteLength(JSON.stringify(estimate))-Buffer.byteLength(JSON.stringify(canonical));
 const maximum=cloudflare?MAX_D1_ROOM_BYTES-storageOverhead:3_000_000;
 measured.runtime=cloudflare?'cloudflare':'node';measured.maximumBackupBytes=maximum;
 for(const target of [maximum-1,maximum]){
  const backup=structuredClone(canonical);backup.game.experienceAwards=[];backup.game.notes='';
  let bytes=Buffer.byteLength(JSON.stringify(backup));
  while(bytes<target-2000){
   const award={id:'award-'+String(backup.game.experienceAwards.length).padStart(6,'0'),by:backup.game.members[0].id,amount:1,recipients:[],reason:'ž'.repeat(300),time:1};
   bytes+=Buffer.byteLength(JSON.stringify(award))+(backup.game.experienceAwards.length?1:0);
   backup.game.experienceAwards.push(award);
  }
  backup.game.notes='x'.repeat(target-bytes);
  assert.equal(Buffer.byteLength(JSON.stringify(backup)),target);readBackup(backup);
  // Let the HTTP pool process socket-close events before a large POST.
  await yieldIO();
  session=await ok(await post('restore',{backup}));
  const exported=await ok(await get(session,'&download=backup'));
  assert.equal(Buffer.byteLength(JSON.stringify(exported)),target);
  await ok(await post('restore',{backup:exported}));
  assert.deepEqual(exported.game.contentLibrary,backup.game.contentLibrary);
  if(target===maximum){
   const response=await post('notes',{notes:exported.game.notes+'x',expected:{notes:exported.game.notes}},session);
   measured.overLimitMutationStatus=response.status;
   if(process.env.STUL_REPRO_BASELINE==='1'){
    await ok(response);const invalid=await ok(await get(session,'&download=backup'));
    measured.exportedBytes=Buffer.byteLength(JSON.stringify(invalid));
    measured.restoreStatus=(await post('restore',{backup:invalid})).status;
    assert(measured.exportedBytes>3_000_000);assert.equal(measured.restoreStatus,400);
    console.log('REPRODUCED: ordinary mutation permits an exported backup that restore rejects.');
   }else{
    assert.equal(response.status,413,await response.text());
    assert.equal((await ok(await get(session,'&download=backup'))).game.notes,exported.game.notes);
   }
   const tooLarge=structuredClone(exported);tooLarge.game.notes+='x';assert.equal((await post('restore',{backup:tooLarge})).status,cloudflare?413:400);
  }
 }
 assert.equal((await post('create',{name:'x'.repeat(3_100_001)})).status,413);
 const archivedGame = initialGame('PJ archivu', crypto.randomUUID());
 for (let index = 0; index < 50; index++) {
  archivedGame.members.push({
   ...archivedGame.members[0],
   id: crypto.randomUUID(), name: 'Postava ' + index, role: 'player', archived: true,
  });
 }
 const archivedTable = await ok(await post('restore', {backup: makeBackup(archivedGame)}));
 const newcomer = await ok(await post('join', {room: archivedTable.room, name: 'Nový hráč'}));
 const joinedMember = newcomer.game.members.find(member => member.id === newcomer.game.me);
 assert.deepEqual([joinedMember.x, joinedMember.y], [6, 6]);

 // Reproduce the old database row on the isolated Node server, bypassing import validation.
 const db = server ? new DatabaseSync(path.join(dir, 'game.sqlite')) : undefined;
 try {
  function storedGame() {
   return JSON.parse(db.prepare('SELECT data FROM rooms WHERE id = ?').get(archivedTable.room).data);
  }
  if (db) {
   const legacy = storedGame();
   legacy.members.find(member => member.id === joinedMember.id).x = 56;
   db.prepare('UPDATE rooms SET data = ? WHERE id = ?').run(JSON.stringify(legacy), archivedTable.room);
   const loaded = await ok(await get(newcomer));
   assert.equal(loaded.members.find(member => member.id === joinedMember.id).x, 6);
  }

  const archivedBackup = await ok(await get(archivedTable, '&download=backup'));
  assert.equal(archivedBackup.game.members.filter(member => member.archived).length, 50);
  assert.equal(archivedBackup.game.members.find(member => member.id === joinedMember.id).x, 6);
  await ok(await post('restore', {backup: archivedBackup}));

  const award = {target: 'all', amount: 25, reason: 'Odměna aktivní družině'};
  const awarded = await ok(await post('experience', award, archivedTable));
  assert.deepEqual(awarded.game.experienceAwards.at(-1).recipients, [joinedMember.id]);
  const rejectedAward = await post('experience', {...award, target: archivedBackup.game.members[1].id}, archivedTable);
  assert.equal(rejectedAward.status, 400);
  const awardedBackup = await ok(await get(archivedTable, '&download=backup'));
  assert.equal(awardedBackup.game.members.find(member => member.id === joinedMember.id).experience, 25);
  assert(awardedBackup.game.members.filter(member => member.archived).every(member => member.experience === 0));
  await ok(await post('restore', {backup: awardedBackup}));

  // Pre-fix awards could include every historical player and produce a chat entry over 4000 characters.
  const legacyAwardBackup = structuredClone(archivedBackup);
  const legacyOwner = legacyAwardBackup.game.members[0];
  for (let index = legacyAwardBackup.game.members.length - 1; index < 199; index++)
   legacyAwardBackup.game.members.push({...legacyAwardBackup.game.members[1], id: crypto.randomUUID()});
  const legacyPlayers = legacyAwardBackup.game.members.filter(member => member.role === 'player');
  for (const member of legacyPlayers) { member.experience = 10; member.name = 'H'.repeat(30); }
  const legacyAward = {
   id: crypto.randomUUID(), by: legacyOwner.id, amount: 10, reason: 'R'.repeat(300), time: 1,
   recipients: legacyPlayers.map(member => member.id),
  };
  const legacyMessage = {
   id: crypto.randomUUID(), from: legacyOwner.id, name: legacyOwner.name, to: 'all', time: 1, experience: true,
   text: legacyPlayers.map(member => member.name).join(', ') + ': +10 zkušeností pro každého. Za: ' + legacyAward.reason,
  };
  assert.equal(legacyPlayers.length, 199);
  assert(legacyMessage.text.length > 4000);
  legacyAwardBackup.game.experienceAwards = [legacyAward];
  legacyAwardBackup.game.messages = [legacyMessage];
  const oversizedChat = structuredClone(legacyAwardBackup);
  delete oversizedChat.game.messages[0].experience;
  assert.equal((await post('restore', {backup: oversizedChat})).status, 400);
  const restoredLegacy = await ok(await post('restore', {backup: legacyAwardBackup}));
  const exportedLegacy = await ok(await get(restoredLegacy, '&download=backup'));
  assert.deepEqual(exportedLegacy.game.experienceAwards, [legacyAward]);
  assert.deepEqual(exportedLegacy.game.messages, [legacyMessage]);
  assert(exportedLegacy.game.members.filter(member => member.role === 'player').every(member => member.experience === 10));

  const added = await ok(await post('explore', {op: 'level-add', name: 'Sklep'}, archivedTable));
  const basement = added.game.exploration.levels.find(level => level.name === 'Sklep').id;
  const before = await ok(await get(archivedTable, '&level=' + basement));
  const notes = {notes: 'Platná změna zápisníku', expected: {notes: before.notes}};
  const invalid = await post('notes', {...notes, levelId: 'unknown-level'}, archivedTable);
  assert.equal(invalid.status, 400);
  assert.match((await invalid.json()).error, /Patro neexistuje/);
  const unchanged = await ok(await get(archivedTable, '&level=' + basement));
  assert.equal(unchanged.revision, before.revision);
  assert.equal(unchanged.notes, before.notes);
  assert.equal((await get(archivedTable, '&level=unknown-level')).status, 400);
  const saved = await ok(await post('notes', {...notes, levelId: basement}, archivedTable));
  assert.equal(saved.game.revision, before.revision + 1);
  assert.equal(saved.game.notes, notes.notes);
  assert.equal(saved.game.exploration.levelId, basement);
  if (db) assert.equal(storedGame().members.find(member => member.id === joinedMember.id).x, 6);

  await ok(await post('map', {tool: 'room', from: [42, 28], to: [44, 30], levelId: basement}, archivedTable));
  await ok(await post('explore', {op: 'place', x: 42, y: 28, levelId: basement}, archivedTable));
  const follower = await ok(await post('join', {room: archivedTable.room, name: 'Posila'}));
  const followerMember = follower.game.members.find(member => member.id === follower.game.me);
  assert.deepEqual([followerMember.x, followerMember.y], [42, 28]);
  assert.equal(follower.game.exploration.levelId, basement);

  await ok(await post('member-archive', {memberId: followerMember.id}, archivedTable));
  await ok(await post('explore', {op: 'place', x: 43, y: 29, levelId: basement}, archivedTable));
  await ok(await post('map', {tool: 'subtract', points: [[42, 28]], levelId: basement}, archivedTable));
  const started = await ok(await post('explore', {op: 'battle-start', levelId: basement}, archivedTable));
  const battle = started.game.exploration.battle;
  const returned = await ok(await post('member-restore', {memberId: followerMember.id}, archivedTable));
  const returnedMember = returned.game.members.find(member => member.id === followerMember.id);
  assert.deepEqual([returnedMember.x, returnedMember.y], battle.origin);
  if (db) {
   const legacy = storedGame();
   const misplaced = legacy.members.find(member => member.id === followerMember.id);
   [misplaced.x, misplaced.y] = [42, 28];
   db.prepare('UPDATE rooms SET data = ? WHERE id = ?').run(JSON.stringify(legacy), archivedTable.room);
  }
  const battleBackup = await ok(await get(archivedTable, '&download=backup'));
  const restoredBattle = await ok(await post('restore', {backup: battleBackup}));
  assert.equal(restoredBattle.game.exploration.battle.id, battle.id);
  const moved = await ok(await post('explore', {
   op: 'battle-move', battleId: battle.id, levelId: basement, memberId: followerMember.id,
   x: 43, y: 30, expected: {x: 43, y: 29},
  }, archivedTable));
  const movedMember = moved.game.members.find(member => member.id === followerMember.id);
  assert.deepEqual([movedMember.x, movedMember.y], [43, 30]);
  const movedBackup = await ok(await get(archivedTable, '&download=backup'));
  await ok(await post('restore', {backup: movedBackup}));
 } finally {
  db?.close();
 }
 console.log('PASS: only active players earn new XP, historical oversized group awards round-trip, and a restored character can move and export a valid battle.');
 console.log('PASS: archived roster joins and portable backup, active party spawn, invalid-floor writes leave the revision unchanged.');
 writeFileSync(process.env.STUL_METRICS_FILE||'/tmp/stul-stabilization-backup.json',JSON.stringify(measured,null,2)+'\n');
 console.log('PASS: actual API backup round-trips below/at runtime maximum with pinned catalog images; above-limit import and HTTP body rejection.');
}finally{if(server?.exitCode===null){server.kill();await new Promise(r=>server.once('exit',r));}rmSync(dir,{recursive:true,force:true});}
