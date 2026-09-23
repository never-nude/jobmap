// Keep each marker tied to its geographic anchor, moving only colliding local
// neighbors. Inputs/outputs are projected pixels at the map's current zoom.
export function layoutMarkers(points,{minDistance=50,maxDisplacement=160,bounds=null,viewport=bounds,margin=24,iterations=240}={}){
 const ordered=points.map(point=>({...point,anchorX:point.x,anchorY:point.y})).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 const ids=new Set();
 for(const p of ordered){if(ids.has(p.id)||!Number.isFinite(p.x)||!Number.isFinite(p.y))throw Error('Invalid marker anchors');ids.add(p.id);}
 const active=ordered.filter(p=>!viewport||(p.x>=viewport.left-margin&&p.x<=viewport.right+margin&&p.y>=viewport.top-margin&&p.y<=viewport.bottom+margin));
 const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
 const constrain=p=>{
  // Alternating projections keep displacement bounded while respecting the
  // visible area when the two constraints can both be satisfied.
  for(let pass=0;pass<3;pass++){
   if(bounds){p.x=clamp(p.x,bounds.left,bounds.right);p.y=clamp(p.y,bounds.top,bounds.bottom);}
   const dx=p.x-p.anchorX,dy=p.y-p.anchorY,distance=Math.hypot(dx,dy);
   if(distance>maxDisplacement){p.x=p.anchorX+dx/distance*maxDisplacement;p.y=p.anchorY+dy/distance*maxDisplacement;}
  }
 };
 const direction=(a,b)=>{
  let hash=2166136261;for(const char of `${a.id}|${b.id}`)hash=Math.imul(hash^char.charCodeAt(0),16777619);
  const angle=(hash>>>0)/4294967296*Math.PI*2;return [Math.cos(angle),Math.sin(angle)];
 };
 // Gauss-Seidel relaxation resolves the actual nearby collisions instead of
 // assigning a global grid or spreading every city by the same amount.
 for(let pass=0;pass<iterations;pass++){
  let worst=0;
  for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
   const a=active[i],b=active[j],dx=b.x-a.x,dy=b.y-a.y,distance=Math.hypot(dx,dy);
   const requiredDistance=(a.radius??minDistance/2)+(b.radius??minDistance/2);
   if(distance>=requiredDistance)continue;
   const overlap=requiredDistance-distance;worst=Math.max(worst,overlap);
   const [ux,uy]=distance>.001?[dx/distance,dy/distance]:direction(a,b),push=(overlap+.04)/2;
   a.x-=ux*push;a.y-=uy*push;b.x+=ux*push;b.y+=uy*push;constrain(a);constrain(b);
  }
  if(worst<.08)break;
 }
 const result=new Map(ordered.map(p=>[p.id,{id:p.id,x:p.x,y:p.y,dx:p.x-p.anchorX,dy:p.y-p.anchorY}]));
 return points.map(point=>result.get(point.id));
}
