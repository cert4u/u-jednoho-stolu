import type { SurfaceRegion } from './surfaces';

const RESOLUTION=12;
const key=(x:number,y:number)=>`${x},${y}`;
const round=(n:number)=>Number((n/RESOLUTION).toFixed(3));
/** Stable continuous pigment field, then a rounded contour; no random render state. */
export function organicSurfacePath(region:SurfaceRegion,roughness=.5):string{
  if(!region.cells.length)return '';
  const cells=new Set(region.cells.map(([x,y])=>key(x,y)));
  const minX=Math.min(...region.cells.map(p=>p[0])),maxX=Math.max(...region.cells.map(p=>p[0]));
  const minY=Math.min(...region.cells.map(p=>p[1])),maxY=Math.max(...region.cells.map(p=>p[1]));
  let seed=0;for(const char of region.kind)seed=(seed*31+char.charCodeAt(0))>>>0;
  const ink=new Set<string>();
  for(let y=Math.max(0,(minY-1)*RESOLUTION);y<Math.min(20,maxY+2)*RESOLUTION;y++)for(let x=Math.max(0,(minX-1)*RESOLUTION);x<Math.min(28,maxX+2)*RESOLUTION;x++){
    const px=(x+.5)/RESOLUTION,py=(y+.5)/RESOLUTION,cx=Math.floor(px),cy=Math.floor(py);
    let field=0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(cells.has(key(cx+dx,cy+dy)))
      field+=Math.exp(-((px-cx-dx-.5)**2+(py-cy-dy-.5)**2)/.3);
    const waviness=(Math.sin(px*3.7+py*2.3+seed)*.6+Math.sin(py*6.3-px*1.9+seed*.13)*.4)*roughness*.18;
    if(field+waviness>.49)ink.add(key(x,y));
  }
  type Edge={a:[number,number];b:[number,number];direction:number};
  const edges:Edge[]=[];
  for(const cell of ink){const [x,y]=cell.split(',').map(Number);
    if(!ink.has(key(x,y-1)))edges.push({a:[x,y],b:[x+1,y],direction:0});
    if(!ink.has(key(x+1,y)))edges.push({a:[x+1,y],b:[x+1,y+1],direction:1});
    if(!ink.has(key(x,y+1)))edges.push({a:[x+1,y+1],b:[x,y+1],direction:2});
    if(!ink.has(key(x-1,y)))edges.push({a:[x,y+1],b:[x,y],direction:3});
  }
  const starts=new Map<string,number[]>();
  edges.forEach((edge,i)=>{const k=key(...edge.a);starts.set(k,[...(starts.get(k)??[]),i]);});
  const used=new Set<number>(),paths:string[]=[];
  for(let i=0;i<edges.length;i++){
    if(used.has(i))continue;
    const loop:[number,number][]=[];let current=i;
    for(let n=0;n<=edges.length;n++){
      const edge=edges[current];used.add(current);loop.push(edge.a);
      if(key(...edge.b)===key(...edges[i].a))break;
      const next=(starts.get(key(...edge.b))??[]).filter(index=>!used.has(index));
      if(!next.length)break;
      current=next.sort((a,b)=>[1,0,3,2].indexOf((edges[a].direction-edge.direction+4)%4)-[1,0,3,2].indexOf((edges[b].direction-edge.direction+4)%4))[0];
    }
    if(loop.length<3)continue;
    // Relax the sampled contour so no tiny raster steps remain in the ink edge.
    let smooth=loop;
    for(let pass=0;pass<4;pass++)smooth=smooth.map((p,j)=>{
      const a=smooth[(j+smooth.length-1)%smooth.length],b=smooth[(j+1)%smooth.length];
      return [(a[0]+2*p[0]+b[0])/4,(a[1]+2*p[1]+b[1])/4];
    });
    const mid=(a:[number,number],b:[number,number])=>`${round((a[0]+b[0])/2)} ${round((a[1]+b[1])/2)}`;
    paths.push(`M${mid(smooth.at(-1)!,smooth[0])}`+smooth.map((p,j)=>`Q${round(p[0])} ${round(p[1])} ${mid(p,smooth[(j+1)%smooth.length])}`).join('')+'Z');
  }
  return paths.join('');
}
