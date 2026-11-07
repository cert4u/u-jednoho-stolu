const $=id=>document.getElementById(id);
let catalogs=[],selected,editing,preview,busy=false,valid=false,validationTimer,validationRequest=0,copying;
const labels={bestiary:'Příšery','dungeon-presets':'Předlohy jeskyní',adventures:'Dobrodružství',scenery:'Stafáž a materiály'};
const message=value=>{$('catalog-message').textContent=value;};
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
async function api(action,data,options={}){
 const response=await fetch('/admin/api/catalogs'+(action?'/'+action:''),data===undefined?options:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),...options});
 const value=await response.json();if(!response.ok)throw new Error(value.error||'Katalogovou operaci se nepodařilo dokončit.');return value;
}
function button(text,run,disabled=false){const b=node('button',text);b.type='button';b.className='secondary';b.disabled=disabled;b.onclick=()=>void perform(run);return b;}
function controls(){for(const b of $('catalog-section').querySelectorAll('button,input,select,textarea'))b.disabled=busy;const readOnly=!selected||selected.kind!=='local';for(const id of ['catalog-metadata','catalog-entry-new','catalog-entry-area','catalog-image'])$(id).disabled=busy||readOnly;$('catalog-save').disabled=busy||!valid;}
async function perform(run){if(busy)return;busy=true;message('');controls();try{await run();}catch(error){message(error.message);}finally{busy=false;controls();}}
async function reload(){catalogs=(await api('')).catalogs;renderList();}
function renderList(){
 const container=$('catalog-list');container.replaceChildren();const scroll=node('div');scroll.className='catalog-scroll';const table=node('table');const head=node('tr');for(const label of ['Název','Typ','Verze','Autor','Obsah','Stav','Akce'])head.append(node('th',label));table.append(head);
 for(const c of catalogs){const row=node('tr'),m=c.manifest;for(const text of [m.name,({builtin:'Výchozí',local:'Vlastní',community:'Komunitní'})[c.kind],m.version,m.author,Object.entries(c.counts).map(([k,v])=>`${labels[k]}: ${v}`).join(' · '),c.enabled?'Aktivní':'Zakázaný'])row.append(node('td',text));
  const actions=node('td');actions.className='actions';actions.append(button('Prohlédnout',()=>open(m.id)));
  if(c.kind!=='builtin'){
   const download=node('a','Exportovat ZIP');download.href='/admin/api/catalogs/export?'+new URLSearchParams({id:m.id});actions.append(download);
   actions.append(button(c.enabled?'Zakázat':'Povolit',async()=>{await api('enable',{id:m.id,expectedRevision:c.revision,enabled:!c.enabled});await reload();}));
   if(c.source)actions.append(button('Zkontrolovat aktualizaci',()=>github(c)));
   actions.append(button('Odebrat',async()=>{if(!confirm(`Odebrat katalog „${m.name}“? ${c.usage.length?'Připnuté kopie zůstanou v '+c.usage.length+' kampaních.':''} Závislosti mohou odstranění blokovat.`))return;await api('remove',{id:m.id,expectedRevision:c.revision,preserveCampaigns:true});if(selected?.bundle.manifest.id===m.id){selected=undefined;$('catalog-detail').hidden=true;}await reload();}));
  }
  row.append(actions);table.append(row);
 }
 scroll.append(table);container.append(scroll);controls();
}
async function open(id){
 selected=await api('view?'+new URLSearchParams({id}));editing=undefined;valid=false;$('catalog-editor').hidden=true;$('catalog-copy').hidden=true;$('catalog-detail').hidden=false;
 const m=selected.bundle.manifest;$('catalog-detail-title').textContent=m.name;
 $('catalog-origin').textContent=[`${m.id} · ${m.version} · ${m.license}`,selected.source?`${selected.source.repository}\nCommit: ${selected.source.commit}`:'Místní obsah',`Použití: ${selected.usage.length} kampaní · ${selected.kind==='local'?'Lze upravovat':'Originál pouze pro čtení'}`].join('\n');
 renderItems();const history=$('catalog-history');history.replaceChildren();if(selected.history.length){history.append(node('h4','Body návratu katalogu'));for(const h of selected.history)history.append(button(`${h.saved_at} · ${h.digest.slice(0,12)}`,async()=>{if(!confirm('Vrátit tuto verzi katalogu? Kampaně zachovají své připnuté kopie.'))return;await api('rollback',{id:m.id,expectedRevision:selected.revision,historyId:h.id});await reload();await open(m.id);}));}controls();
}
function renderItems(){
 const type=$('catalog-type').value,list=$('catalog-items');list.replaceChildren();for(const entry of selected.bundle.entries[type]){
  const item=node('div');item.className='backup-actions';item.append(node('strong',`${entry.name??entry.label??entry.title} (${entry.id})`),button(selected.kind==='local'?'Upravit':'Prohlédnout',()=>edit(type,entry,entry.id)),button('Vlastní kopie',()=>showCopy(type,entry)));
  if(selected.kind==='local')item.append(button('Duplikovat',()=>{const copy=structuredClone(entry);copy.id=(copy.id.slice(0,42)+'-kopie');edit(type,copy);}),button('Odstranit',async()=>{if(!confirm('Odstranit nepoužitou položku? Odkazy mohou odstranění blokovat.'))return;const id=selected.bundle.manifest.id;await api('entry',{id,expectedRevision:selected.revision,type,originalId:entry.id,remove:true});await reload();await open(id);}));list.append(item);
 }
 if(!list.childNodes.length)list.append(node('p','Tento typ zatím neobsahuje žádné položky.'));
}
function edit(type,entry,originalId){
 editing={type,originalId};$('catalog-editor').hidden=false;$('catalog-editor-title').textContent=selected.kind==='local'?'Editor položky':'Položka pouze pro čtení';$('catalog-editor-help').textContent='ID existující položky je neměnné. Odkazy mimo katalog piš katalog:polozka a deklaruj závislost v metadatech. Obrázek: portrait bez přípony, soubor WebP přidáš níže. Stafáž používá bezpečnou cestu pro plátno 32 × 32.';
 $('catalog-json').value=JSON.stringify(entry,null,2);$('catalog-json').readOnly=selected.kind!=='local';valid=false;void validate();controls();
}
function visualPreview(entry){
 const container=$('catalog-visual-preview');container.replaceChildren();
 if(editing.type==='scenery'&&entry.path){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 32 32');svg.setAttribute('width','96');svg.setAttribute('height','96');svg.setAttribute('aria-label','Náhled stafáže');
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',entry.path);path.setAttribute('fill','none');path.setAttribute('stroke',entry.surface?.color??'#65543f');path.setAttribute('stroke-width','1.25');svg.append(path);container.append(svg);
 }else if(editing.type==='bestiary'){
  const portrait=entry.portrait??entry.id,asset=selected.bundle.assets.find(a=>a.path===`images/${portrait}.webp`);
  const builtin=selected.bundle.manifest.id==='builtin'?portrait:portrait.startsWith('builtin:')?portrait.slice(8):undefined;
  if(asset||builtin){const image=node('img');image.alt=entry.name;image.width=120;image.src=asset?`/catalog-assets/${asset.digest}.webp`:`/monsters/${builtin}.webp`;container.append(image);}
 }
}
async function validate(){
 const serial=++validationRequest;clearTimeout(validationTimer);valid=false;controls();let entry;
 try{entry=JSON.parse($('catalog-json').value);}catch(error){$('catalog-validation').textContent='Neplatný JSON: '+error.message;return;}
 $('catalog-entry-preview').textContent=JSON.stringify(entry,null,2);$('catalog-visual-preview').replaceChildren();
 if(selected.kind!=='local'){visualPreview(entry);$('catalog-validation').textContent='Originál je pouze pro čtení. Použij Vlastní kopie.';return;}
 if(editing.type==='manifest'){$('catalog-validation').textContent='Syntaxe JSON je platná; metadata a závislosti ověří server při uložení.';valid=true;controls();return;}
 $('catalog-validation').textContent='Ověřuji schéma a odkazy…';
 validationTimer=setTimeout(async()=>{
  try{await api('entry',{id:selected.bundle.manifest.id,expectedRevision:selected.revision,type:editing.type,originalId:editing.originalId,entry,validateOnly:true});if(serial!==validationRequest)return;valid=true;visualPreview(entry);$('catalog-validation').textContent='Schéma i odkazy jsou platné.';}
  catch(error){if(serial===validationRequest)$('catalog-validation').textContent=error.message;}
  if(serial===validationRequest)controls();
 },350);
}
async function newEntry(area=false){
 if(!selected||selected.kind!=='local')return;const built=await api('view?id=builtin'),type=area?'scenery':$('catalog-type').value;
 let example=structuredClone(built.bundle.entries[type].find(e=>area?Boolean(e.surface):!e.surface));
 if(type==='bestiary')example.portrait='builtin:'+(example.portrait??example.id);
 if(type==='adventures'){example.dungeonPreset='builtin:'+example.dungeonPreset;for(const room of example.rooms)if(room.monsters)room.monsters=room.monsters.map(id=>'builtin:'+id);}
 example.id=area?'novy-material':'nova-polozka';edit(type,example);
}
function showCopy(type,entry){copying={sourceId:selected.bundle.manifest.id,type,itemId:entry.id};const targets=catalogs.filter(c=>c.kind==='local');if(!targets.length){message('Nejdřív vytvoř vlastní katalog.');return;}$('catalog-copy').hidden=false;$('catalog-copy-target').replaceChildren(...targets.map(c=>{const option=node('option',c.manifest.name);option.value=c.manifest.id;return option;}));$('catalog-copy-id').value=(entry.id.slice(0,42)+'-kopie');}
function showPreview(result){preview=result;$('catalog-preview').hidden=false;$('catalog-preview-text').textContent=[`${result.manifest.name} (${result.manifest.id})`,`${result.currentVersion??'Nový katalog'} → ${result.manifest.version}`,`Autor: ${result.manifest.author} · Licence: ${result.manifest.license}`,`SHA-256: ${result.digest}`,result.source?`${result.source.repository}\nCommit: ${result.source.commit}`:'Import ze souboru',Object.entries(result.counts).map(([k,v])=>`${labels[k]}: ${v}`).join(' · '),`Přidáno: ${result.diff.added} · Změněno: ${result.diff.changed} · Odstraněno: ${result.diff.removed}`,`Závislosti: ${result.manifest.dependencies.map(d=>`${d.id} >= ${d.minVersion}`).join(', ')||'žádné'}`,result.preservedCampaigns?`${result.preservedCampaigns} kampaní zachová připnuté kopie. Aktualizace je nepřepíše.`:'','Kompatibilita a obsah ověřeny. Knihovna se změní až potvrzením.'].filter(Boolean).join('\n');}
async function github(catalog,initialRepository){
 const repository=catalog?.source?.repository??initialRepository??prompt('Veřejný GitHub repozitář (https://github.com/autor/katalog):');if(!repository)return;
 const ref=prompt('Revize nebo tag (prázdné = HEAD):','HEAD');if(ref===null)return;
 showPreview(await api('github',{repository,ref:ref||'HEAD',...(catalog?{updateId:catalog.manifest.id}:{})}));
}
$('catalog-new').onclick=()=>{$('catalog-create').hidden=false;};$('catalog-create-cancel').onclick=()=>{$('catalog-create').hidden=true;};
$('catalog-create').onsubmit=e=>{e.preventDefault();void perform(async()=>{
 const builtin=catalogs.find(c=>c.kind==='builtin').manifest,manifest={schemaVersion:1,id:$('catalog-id').value,name:$('catalog-name').value,version:'1.0.0',author:$('catalog-author').value,license:$('catalog-license').value,description:'',minAppVersion:builtin.version,dependencies:[{id:'builtin',minVersion:builtin.version}],fileLicenses:{}};
 await api('create',{manifest});$('catalog-create').hidden=true;e.target.reset();await reload();await open(manifest.id);
});};
$('catalog-reload').onclick=()=>void perform(reload);$('catalog-type').onchange=()=>{if(selected)renderItems();};
$('catalog-entry-new').onclick=()=>void perform(()=>newEntry());$('catalog-entry-area').onclick=()=>void perform(()=>newEntry(true));
$('catalog-metadata').onclick=()=>{editing={type:'manifest'};$('catalog-editor').hidden=false;$('catalog-json').readOnly=false;$('catalog-json').value=JSON.stringify(selected.bundle.manifest,null,2);$('catalog-editor-title').textContent='Metadata katalogu';$('catalog-editor-help').textContent='Název lze změnit, ID musí zůstat stejné. Verze používá formát 1.0.0. Závislosti uvádějí id a minVersion.';void validate();};
$('catalog-json').oninput=()=>void validate();$('catalog-editor-cancel').onclick=()=>{validationRequest++;clearTimeout(validationTimer);$('catalog-editor').hidden=true;};
$('catalog-editor').onsubmit=e=>{e.preventDefault();if(!valid||selected.kind!=='local')return;void perform(async()=>{const id=selected.bundle.manifest.id,data=JSON.parse($('catalog-json').value);if(editing.type==='manifest')await api('manifest',{id,expectedRevision:selected.revision,manifest:data});else await api('entry',{id,expectedRevision:selected.revision,type:editing.type,originalId:editing.originalId,entry:data});await reload();await open(id);});};
$('catalog-copy').onsubmit=e=>{e.preventDefault();void perform(async()=>{const targetId=$('catalog-copy-target').value,target=catalogs.find(c=>c.manifest.id===targetId);await api('copy',{...copying,targetId,newId:$('catalog-copy-id').value,expectedRevision:target.revision});await reload();await open(targetId);});};
$('catalog-import').onchange=e=>void perform(async()=>{const file=e.target.files[0];if(!file)return;if(file.size>40_000_000)throw new Error('ZIP má nejvýše 40 MB.');showPreview(await api('preview',undefined,{method:'POST',headers:{'Content-Type':'application/zip'},body:file}));e.target.value='';});
$('catalog-install').onclick=()=>void perform(async()=>{if(!preview)return;const result=await api('install',{token:preview.token});preview=undefined;$('catalog-preview').hidden=true;await reload();await open(result.id);});
$('catalog-discard').onclick=()=>void perform(async()=>{if(preview)await api('discard',{token:preview.token});preview=undefined;$('catalog-preview').hidden=true;});
$('catalog-image').onchange=e=>void perform(async()=>{const file=e.target.files[0];if(!file||selected?.kind!=='local')return;const portrait=prompt('ID obrázku (bez přípony, pro pole portrait):',file.name.replace(/\.webp$/i,''));if(!portrait)return;const id=selected.bundle.manifest.id;await api('image?'+new URLSearchParams({id,revision:String(selected.revision),portrait}),undefined,{method:'POST',headers:{'Content-Type':'image/webp'},body:file});e.target.value='';await reload();await open(id);message(`Obrázek uložen. V příšeře nastav portrait: "${portrait}".`);});
$('catalog-github').onclick=()=>void perform(()=>github());$('catalog-recommend').onclick=()=>void perform(async()=>{const result=await api('recommend',{});const list=$('catalog-recommendations');list.replaceChildren();for(const c of result.catalogs)list.append(node('p',`${c.name} · ${c.author}`),button('Připravit instalaci',()=>github(undefined,c.repository)));if(!result.catalogs.length)message('Doporučený seznam zatím neobsahuje katalogy. Vlastní adresu lze zadat tlačítkem Přidat z GitHubu.');});
window.addEventListener('stul-admin-session',()=>void perform(reload));window.addEventListener('stul-admin-logout',()=>{selected=preview=editing=undefined;catalogs=[];$('catalog-list').replaceChildren();$('catalog-editor').hidden=$('catalog-detail').hidden=$('catalog-preview').hidden=true;$('catalog-json').value='';});
if(!$('panel').hidden)void perform(reload);
