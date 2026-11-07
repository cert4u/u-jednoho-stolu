import type {CampaignCatalog} from './model';
import {sha256} from './model';
export async function validateCampaignImages(snapshot?:CampaignCatalog){
 for(const [digest,image]of Object.entries(snapshot?.images??{})){
  const bytes=Uint8Array.from(atob(image.data),c=>c.charCodeAt(0));
  if(await sha256(bytes)!==digest)throw new Error('Přenositelný obrázek neodpovídá kontrolnímu otisku.');
 }
}
