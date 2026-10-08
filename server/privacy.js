export const PEOPLE = [
  {id:'alex',name:'Alex',color:'#b1c9bc',status:'Exploring',emoji:'🌿',circle:['close','family'],actual:[-74.0100,40.7092],area:'Financial District',areaCenter:[-74.0107,40.7093]},
  {id:'sarah',name:'Sarah',color:'#efb9a4',status:'Free for coffee',emoji:'☕',circle:['close','partner'],actual:[-74.0066,40.7123],area:'City Hall area',areaCenter:[-74.0047,40.7129],music:'Birds of a Feather · Billie Eilish'},
  {id:'jamie',name:'Jamie',color:'#c2b6df',status:'On a little walk',emoji:'🚶',circle:['close','family'],actual:[-74.0132,40.7064],area:'Battery Park area',areaCenter:[-74.0157,40.7047]},
  {id:'maya',name:'Maya',color:'#e5c68c',status:'Making memories',emoji:'📸',circle:['close'],actual:[-74.0045,40.7068],area:'Seaport area',areaCenter:[-74.0018,40.7074],moment:true},
  {id:'chris',name:'Chris',color:'#a7c6d8',status:'Taking some space',emoji:'👻',circle:['close'],actual:[-74.0003,40.7165],area:'Tribeca area',areaCenter:[-74.0070,40.7197],hidden:true},
];
export const PLACES = [
 {id:'oculus',name:'The Oculus',type:'Landmark',emoji:'🏛️',coordinate:[-74.0112,40.7115],description:'An easy-to-find spot, rain or shine.',label:'West entrance'},
 {id:'coffee',name:'Blue Bottle Coffee',type:'Café',emoji:'☕',coordinate:[-74.0118,40.7105],description:'Coffee and a catch-up near the World Trade Center.',label:'Meet outside'},
 {id:'park',name:'City Hall Park',type:'Park',emoji:'🌳',coordinate:[-74.0071,40.7128],description:'A little green space in the middle of it all.',label:'Broadway entrance'},
 {id:'waterfront',name:'Pier 17',type:'Waterfront',emoji:'🌊',coordinate:[-74.0019,40.7065],description:'Waterfront views, room for everyone.',label:'Public promenade'},
];
export function distance(a,b) { const rad=Math.PI/180; const dlat=(a[1]-b[1])*rad,dlon=(a[0]-b[0])*rad; const t=Math.sin(dlat/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(dlon/2)**2; return 6371000*2*Math.atan2(Math.sqrt(t),Math.sqrt(1-t)); }
export function createWorld(now=Date.now()) {
 const users=Object.fromEntries(PEOPLE.map(p=>[p.id,{...structuredClone(p),nearby:true,updatedAt:now,blocked:[],friends:PEOPLE.filter(x=>x.id!==p.id).map(x=>x.id)}]));
 return {users,requests:[],grants:[],views:[],journeys:[],trip:{name:'A New York kind of weekend',destination:'New York',members:['alex','sarah','jamie','maya','chris'],joined:['alex','sarah','jamie','maya'],proposal:null},moments:[{id:'seed',owner:'maya',text:'A little city magic ✨',place:'Pier 17',audience:['alex','sarah','jamie'],createdAt:now-480000}],notifications:[],lastRequest:new Map()};
}
export function related(w,a,b) { return a!==b && w.users[a]?.friends.includes(b) && !w.users[a].blocked.includes(b) && !w.users[b].blocked.includes(a); }
export function expire(w,now=Date.now()) {
 w.grants=w.grants.filter(g=>g.expiresAt>now && related(w,g.owner,g.viewer) && !w.users[g.owner].hidden);
 for(const r of w.requests) if(r.status==='pending' && r.createdAt+600000<=now) r.status='expired';
 for(const j of w.journeys) {
  if(j.status==='cancelled'||j.status==='arrived') continue;
  const progress=Math.min(1,(now-j.startedAt)/j.duration); j.progress=progress;
  j.status=progress>=1?'arrived':progress>.93?'arriving':progress>.8?'nearby':progress>.08?'on the way':'leaving';
  if(j.status==='arrived') {w.grants=w.grants.filter(g=>g.purpose!==j.id);w.notifications.push({id:crypto.randomUUID(),audience:j.audience,text:`${w.users[j.owner].name} arrived at ${j.destination.name}`,at:now});}
 }
}
export function authorizeLocation(w,viewer,owner,now=Date.now()) {
 const p=w.users[owner]; if(!p||p.hidden) return null;
 if(viewer===owner) return {precision:'self',coordinate:[...p.actual],updatedAt:p.updatedAt};
 if(!related(w,viewer,owner)) return null;
 if(now-p.updatedAt>30*60000) return {precision:'unavailable',updatedAt:p.updatedAt};
 const grant=w.grants.find(g=>g.owner===owner&&g.viewer===viewer&&g.expiresAt>now);
 if(grant) return {precision:'precise',coordinate:[...p.actual],expiresAt:grant.expiresAt,purpose:grant.purpose,updatedAt:p.updatedAt};
 return {precision:'approximate',coordinate:[...p.areaCenter],area:p.area,radius:650,updatedAt:p.updatedAt};
}
export function worldFor(w,viewer,now=Date.now()) {
 expire(w,now); const me=w.users[viewer];
 return {viewer,me:{id:me.id,name:me.name,hidden:!!me.hidden,nearby:me.nearby,status:me.status,emoji:me.emoji,blocked:me.blocked},people:PEOPLE.filter(p=>p.id!==viewer&&related(w,viewer,p.id)).map(({id})=>{
  const p=w.users[id], location=authorizeLocation(w,viewer,id,now);
  return {id,name:p.name,color:p.color,status:p.status,emoji:p.emoji,music:p.music,moment:p.moment,moving:!!p.moving,circle:p.circle,hidden:!!p.hidden,location,nearby:!!(location&&location.precision!=='unavailable'&&p.nearby&&me.nearby&&!me.hidden&&distance(me.actual,p.actual)<=1000)};
 }),selfLocation:authorizeLocation(w,viewer,viewer,now),places:PLACES,
 requests:w.requests.filter(r=>r.from===viewer||r.to===viewer).map(r=>({...r,fromName:w.users[r.from].name,toName:w.users[r.to].name})),
 grants:w.grants.filter(g=>g.owner===viewer||g.viewer===viewer).map(g=>({...g,ownerName:w.users[g.owner].name,viewerName:w.users[g.viewer].name})),
 views:w.views.filter(v=>v.owner===viewer).map(v=>({...v,name:w.users[v.viewer].name})),
 journeys:w.journeys.filter(j=>j.owner===viewer||j.audience.includes(viewer)&&related(w,viewer,j.owner)&&!w.users[j.owner].hidden).map(j=>({...j,ownerName:w.users[j.owner].name,eta:Math.max(0,Math.ceil((1-j.progress)*18))})),
 trip:{...w.trip,memberNames:w.trip.members.map(id=>({id,name:w.users[id].name,joined:w.trip.joined.includes(id)}))},
 moments:w.moments.filter(m=>m.owner===viewer||m.audience.includes(viewer)&&related(w,viewer,m.owner)).map(m=>({...m,ownerName:w.users[m.owner].name})),
 notifications:w.notifications.filter(n=>n.audience.includes(viewer)),demo:true};
}
export function recordView(w,viewer,owner,now=Date.now()) {
 if(!related(w,viewer,owner)) throw new Error('This person is not in your trusted circle.');
 const day=new Date(now).toISOString().slice(0,10); const v=w.views.find(v=>v.owner===owner&&v.viewer===viewer&&v.day===day);
 if(v){v.count++;v.at=now;} else w.views.push({owner,viewer,day,count:1,at:now});
}
export function stopSharing(w,owner) {
 w.users[owner].hidden=true;
 w.grants=w.grants.filter(g=>g.owner!==owner&&g.viewer!==owner);
 w.requests.forEach(r=>{if((r.to===owner||r.from===owner)&&r.status==='pending')r.status='cancelled';});
 w.journeys.forEach(j=>{if(j.owner===owner&&j.status!=='arrived')j.status='cancelled';});
}
export function respond(w,viewer,id,decision,duration,now=Date.now()) {
 expire(w,now); const r=w.requests.find(r=>r.id===id);
 if(!r||r.to!==viewer||r.status!=='pending') throw new Error('Only the recipient can respond to a pending request.');
 if(!related(w,r.from,r.to)||w.users[viewer].hidden) throw new Error('Sharing is unavailable. Turn off Ghost Mode to approve.');
 if(!['allow','halfway','decline','public'].includes(decision)) throw new Error('Choose a valid response.');
 if(decision==='public'&&r.kind!=='point') throw new Error('This request does not include a public meeting point.');
 r.status=decision==='decline'?'declined':'accepted';r.decision=decision;
 if(decision==='allow') {
  const durations={'15m':900000,'30m':1800000,'1h':3600000,'3h':10800000,'until-meet':3600000};
  if(!durations[duration]){r.status='pending';throw new Error('Choose a supported duration.');}
  w.grants.push({id:crypto.randomUUID(),owner:viewer,viewer:r.from,purpose:r.kind==='meetup'?'meetup':'location',expiresAt:now+durations[duration],untilMeet:duration==='until-meet'});
 }
}
