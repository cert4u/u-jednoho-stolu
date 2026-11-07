import {prepareGithubCatalog,recommendedCatalogs} from './catalog-github.mjs';
import {json,body} from './http.mjs';
import * as library from './catalog-store.mjs';
import {catalogFiles} from './catalog-files.mjs';
import {zipLimits} from './catalog-zip.mjs';
async function bytes(req,max){let size=0;const parts=[];for await(const part of req){size+=part.length;if(size>max)throw new Error('Příliš velký soubor.');parts.push(part);}return Buffer.concat(parts);}
function errorText(error){return error.issues?error.issues.map(i=>`${i.path.join('.')}: ${i.code==='invalid_enum_value'?'povolené hodnoty: '+i.options.join(', '):i.code==='too_small'?'minimum je '+i.minimum:i.code==='too_big'?'maximum je '+i.maximum:i.code==='unrecognized_keys'?'neznámá pole: '+i.keys.join(', '):i.message}`).join('\n'):error.message;}
export async function catalogApi(req,res,url){
 const action=url.pathname.slice('/admin/api/catalogs'.length).replace(/^\//,'');
 try{
  if(req.method==='GET'){
   if(!action){json(res,200,{catalogs:await library.listCatalogs()});return;}
   if(action==='view'){json(res,200,await library.viewCatalog(url.searchParams.get('id')));return;}
   if(action==='export'){
    const id=url.searchParams.get('id'),data=await library.exportCatalog(id);
    res.writeHead(200,{'Content-Type':'application/zip','Content-Disposition':`attachment; filename="${id}.zip"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);return;
   }
  }
  if(req.method==='POST'){
   if(action==='preview'){json(res,200,await library.prepareCatalogImport(await bytes(req,zipLimits.archive)));return;}
   if(action==='image'){json(res,200,await library.uploadImage(url.searchParams.get('id'),Number(url.searchParams.get('revision')),url.searchParams.get('portrait'),await bytes(req,1_500_000)));return;}
   const b=await body(req,500_000);let result;
   switch(action){
    case 'github':result=await prepareGithubCatalog(b);break;
    case 'recommend':result={catalogs:await recommendedCatalogs()};break;
    case 'create':result=await library.createCatalog(b.manifest);break;
    case 'manifest':result=await library.editManifest(b.id,b.expectedRevision,b.manifest);break;
    case 'entry':result=await library.editEntry(b);break;
    case 'copy':result=await library.copyEntry(b);break;
    case 'enable':result=await library.setCatalogEnabled(b.id,b.expectedRevision,b.enabled);break;
    case 'remove':result=await library.removeCatalog(b.id,b.expectedRevision,b.preserveCampaigns);break;
    case 'install':result=await library.installPrepared(b.token);break;
    case 'discard':result=library.discardImport(b.token);break;
    case 'rollback':result=await library.rollbackCatalog(b.id,b.expectedRevision,b.historyId);break;
    default:json(res,404,{error:'Katalogová operace neexistuje.'});return;
   }
   json(res,200,result);return;
  }
  json(res,405,{error:'Nepodporovaná operace.'});
 }catch(error){json(res,/změnil|neexistuje|závisejí|zachovej|Potvrď/i.test(error.message)?409:400,{error:errorText(error)});}
}
export async function catalogAsset(req,res,pathname){
 const match=pathname.match(/^\/catalog-assets\/([a-f0-9]{64})\.webp$/);if(!match||req.method!=='GET'){json(res,404,{error:'Obrázek neexistuje.'});return;}
 try{const data=await catalogFiles.read(match[1]);res.writeHead(200,{'Content-Type':'image/webp','Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"});res.end(data);}catch{json(res,404,{error:'Obrázek neexistuje.'});}
}
