import {loadCatalogs} from '../../../lib/catalogs/runtime';
export async function GET(){const library=await loadCatalogs();return Response.json(library.list('adventures').map(({ref,data})=>({id:ref,title:data.title,summary:data.summary})),{headers:{'Cache-Control':'no-store'}});}
