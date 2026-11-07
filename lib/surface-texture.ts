import type { Point } from './dungeon';
export type SurfaceTexture='ripples'|'speckles'|'strokes'|'stones';
export type TextureMark={d:string;opacity:number;width:number};
function noise(value:string){let hash=2166136261;for(const char of value){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}hash^=hash>>>16;hash=Math.imul(hash,0x7feb352d);hash^=hash>>>15;hash=Math.imul(hash,0x846ca68b);hash^=hash>>>16;return (hash>>>0)/4294967296;}
const f=(n:number)=>Number(n.toFixed(3));
/** Sparse world-anchored sketches: no repeated tile and no random changes on repaint. */
export function surfaceTextureMarks(cells:Point[],kind:string,texture:SurfaceTexture):TextureMark[]{
  const marks:TextureMark[]=[];
  for(const [x,y]of [...cells].sort((a,b)=>a[1]-b[1]||a[0]-b[0])){
    const r=(slot:string)=>noise(`${kind}:${x}:${y}:${slot}`);
    const density={ripples:.48,speckles:.65,strokes:.8,stones:.78}[texture];
    if(r('present')>density)continue;
    const cx=x+.16+r('x')*.68,cy=y+.16+r('y')*.68;
    const angle=(r('angle')-.5)*(texture==='ripples'?.22:2.8),scale=.75+r('scale')*.65;
    const point=(dx:number,dy:number)=>`${f(cx+(dx*Math.cos(angle)-dy*Math.sin(angle))*scale)} ${f(cy+(dx*Math.sin(angle)+dy*Math.cos(angle))*scale)}`;
    const move=(a:number,b:number)=>'M'+point(a,b),line=(a:number,b:number)=>'L'+point(a,b);
    let d='';
    if(texture==='ripples'){
      const length=.15+r('length')*.14,bend=.025+r('bend')*.045;
      d=move(-length,0)+`Q${point(-.03,-bend)} ${point(length,bend*.25)}`;
      if(r('echo')>.55)d+=move(-length*.55,.1)+`Q${point(0,.07)} ${point(length*.65,.105)}`;
    }else if(texture==='stones'){
      const count=1+Math.floor(r('count')*3);
      for(let n=0;n<count;n++){
        const sx=(r('sx'+n)-.5)*.36,sy=(r('sy'+n)-.5)*.32,size=.07+r('size'+n)*.12;
        d+=move(sx-size,sy)+line(sx-size*.45,sy-size*.72)+line(sx+size*.6,sy-size*.5)+line(sx+size,sy+size*.35)+line(sx+size*.12,sy+size*.8)+line(sx-size*.8,sy+size*.5)+'Z';
        if(n===0)d+=move(sx-size*.4,sy+size*.48)+line(sx+size*.42,sy+size*.38);
      }
    }else if(texture==='strokes'){
      const count=4+Math.floor(r('count')*4);
      for(let n=0;n<count;n++){
        const sx=(r('sx'+n)-.5)*.45,sy=(r('sy'+n)-.5)*.35,h=.09+r('height'+n)*.13;
        d+=move(sx,sy)+`Q${point(sx-.01,sy-h*.6)} ${point(sx+.025,sy-h)}`;
        if(n%2===0)d+=move(sx,sy)+line(sx-.045,sy-h*.6);
      }
    }else{
      for(let n=0;n<4;n++){
        const sx=(r('sx'+n)-.5)*.42,sy=(r('sy'+n)-.5)*.32;
        d+=move(sx,sy)+line(sx+.009+r('dot'+n)*.022,sy+.006);
      }
      if(r('smudge')>.5)d+=move(-.12,.11)+`Q${point(.01,.15)} ${point(.14,.1)}`;
    }
    marks.push({d,opacity:.48+r('opacity')*.27,width:texture==='stones'?.017:.021});
  }
  return marks;
}
