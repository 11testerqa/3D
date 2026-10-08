import {readFileSync} from 'node:fs';
import {distance} from './privacy.js';
// Replace this provider with a country-appropriate routing adapter before live navigation.
export class DemoRoutingProvider {
 constructor() {
  const roads=JSON.parse(readFileSync(new URL('../public/geography/roads.geojson',import.meta.url)));
  this.nodes=new Map();
  const key=p=>p.map(v=>v.toFixed(6)).join(',');
  for(const f of roads.features) {
   const pts=f.geometry.coordinates;
   for(let i=1;i<pts.length;i++) {
    const a=key(pts[i-1]),b=key(pts[i]);
    for(const [k,p] of [[a,pts[i-1]],[b,pts[i]]]) if(!this.nodes.has(k))this.nodes.set(k,{p,edges:[]});
    const cost=distance(pts[i-1],pts[i]);this.nodes.get(a).edges.push([b,cost]);this.nodes.get(b).edges.push([a,cost]);
   }
  }
 }
 route(start,end,mode='walk') {
  if(!['walk','cycle','drive','transit'].includes(mode))throw new Error('Unsupported transport mode.');
  const nearest=p=>[...this.nodes].reduce((best,[key,n])=>{const d=distance(p,n.p);return d<best.d?{key,d}:best;},{key:null,d:Infinity}).key;
  const from=nearest(start),to=nearest(end),costs=new Map([[from,0]]),previous=new Map(),pending=new Set([from]),visited=new Set();
  while(pending.size) {
   let current=null,min=Infinity;for(const k of pending){if(costs.get(k)<min){min=costs.get(k);current=k;}}
   pending.delete(current);if(current===to)break;visited.add(current);
   for(const [next,cost] of this.nodes.get(current).edges) {if(visited.has(next))continue;const total=min+cost;if(total<(costs.get(next)??Infinity)){costs.set(next,total);previous.set(next,current);pending.add(next);}}
  }
  let path=[];if(costs.has(to)){let k=to;while(k){path.unshift(this.nodes.get(k).p);k=previous.get(k);}}
  if(path.length<2)throw new Error('No demo route available. Choose another public meeting point.');
  const meters=Math.round(path.slice(1).reduce((s,p,i)=>s+distance(path[i],p),0));
  const speed={walk:80,cycle:240,drive:330,transit:260}[mode];
  return {geometry:{type:'LineString',coordinates:path},meters,minutes:Math.max(1,Math.ceil(meters/speed)+(mode==='transit'?3:0)),mode,simulated:true,notice:'Demo route · not turn-by-turn navigation',updatedAt:Date.now()};
 }
}
