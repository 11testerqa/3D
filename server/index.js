import express from 'express';
import {createWorld,worldFor,recordView,related,respond,stopSharing,expire,authorizeLocation,PLACES,PEOPLE,distance} from './privacy.js';
import {DemoRoutingProvider} from './routing.js';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const app=express(),sessions=new Map(),routing=new DemoRoutingProvider();
app.disable('x-powered-by');app.use(express.json({limit:'24kb'}));
app.use((req,res,next)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
 if(req.path.startsWith('/api/')) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return res.status(403).json({error:'Cross-origin actions are disabled.'});
  let id=req.headers.cookie?.match(/kindred_demo=([a-f0-9-]+)/)?.[1];
  if(!id||!sessions.has(id)){id=crypto.randomUUID();if(sessions.size>500)sessions.delete(sessions.keys().next().value);sessions.set(id,{world:createWorld(),viewer:'alex'});res.cookie('kindred_demo',id,{httpOnly:true,sameSite:'strict',secure:req.secure,maxAge:86400000});}
  req.demo=sessions.get(id);expire(req.demo.world);
 }
 next();
});
app.get('/api/health',(_,res)=>res.json({ok:true,mode:'simulated',geography:'Lower Manhattan'}));
app.get('/api/world',(req,res)=>res.json(worldFor(req.demo.world,req.demo.viewer)));
app.post('/api/identity',(req,res)=>{if(!PEOPLE.some(p=>p.id===req.body.id))return res.status(400).json({error:'Unknown demo person.'});req.demo.viewer=req.body.id;res.json(worldFor(req.demo.world,req.demo.viewer));});
app.post('/api/action',(req,res)=>{
 const w=req.demo.world,v=req.demo.viewer,b=req.body,now=Date.now();
 try {
  const person=id=>{if(!w.users[id])throw new Error('Unknown person.');return w.users[id];};
  switch(b.action){
   case 'view':recordView(w,v,b.person);break;
   case 'request': {
    person(b.person);if(!['meetup','location','coffee','point'].includes(b.kind))throw new Error('Invalid request purpose.');
    if(!related(w,v,b.person)||w.users[v].hidden||w.users[b.person].hidden)throw new Error('Location requests are unavailable while hidden or blocked.');
    if(w.requests.some(r=>r.from===v&&r.to===b.person&&r.status==='pending'))throw new Error('You already have a pending request with this person.');
    const key=`${v}:${b.person}:${b.kind}`,last=w.lastRequest.get(key)||0;
    if(now-last<10000)throw new Error('Give them a moment. You can request again in a few seconds.');
    const place=b.kind==='point'?PLACES.find(p=>p.id===b.place):null;if(b.kind==='point'&&!place)throw new Error('Choose a public meeting point.');
    w.lastRequest.set(key,now);w.requests.push({id:crypto.randomUUID(),from:v,to:b.person,kind:b.kind,place,status:'pending',createdAt:now});break;
   }
   case 'respond':respond(w,v,b.id,b.decision,b.duration);break;
   case 'revoke': w.grants=w.grants.filter(g=>!(g.id===b.id&&(g.owner===v||g.viewer===v)));break;
   case 'complete': {
    const grant=w.grants.find(g=>g.id===b.id&&(g.viewer===v||g.owner===v));if(!grant)throw new Error('This sharing session has ended.');
    w.grants=w.grants.filter(g=>g.id!==grant.id);w.requests.forEach(r=>{if(r.status==='accepted'&&r.from===grant.viewer&&r.to===grant.owner)r.status='completed';});break;
   }
   case 'ghost':if(b.enabled)stopSharing(w,v);else w.users[v].hidden=false;break;
   case 'nearby':w.users[v].nearby=!!b.enabled;break;
   case 'block': {
    person(b.person);if(b.person===v)throw new Error('Cannot block yourself.');
    if(!w.users[v].blocked.includes(b.person))w.users[v].blocked.push(b.person);
    w.grants=w.grants.filter(g=>!((g.owner===v&&g.viewer===b.person)||(g.owner===b.person&&g.viewer===v)));
    w.requests.forEach(r=>{if((r.from===v&&r.to===b.person||r.to===v&&r.from===b.person)&&r.status==='pending')r.status='cancelled';});break;
   }
   case 'unblock':w.users[v].blocked=w.users[v].blocked.filter(id=>id!==b.person);break;
   case 'remove':person(b.person);w.users[v].friends=w.users[v].friends.filter(id=>id!==b.person);w.users[b.person].friends=w.users[b.person].friends.filter(id=>id!==v);expire(w);break;
   case 'journey': {
    if(w.users[v].hidden)throw new Error('Turn off Ghost Mode before sharing a Journey.');
    const destination=PLACES.find(p=>p.id===b.place);if(!destination)throw new Error('Choose a public destination.');
    const audience=[...new Set((b.audience||[]).filter(id=>related(w,v,id)))];if(!audience.length)throw new Error('Choose at least one trusted person.');
    w.journeys.filter(j=>j.owner===v&&j.status!=='arrived').forEach(j=>j.status='cancelled');
    w.journeys.push({id:crypto.randomUUID(),owner:v,destination,audience,startedAt:now,duration:75000,progress:0,status:'leaving',mode:b.mode||'drive'});break;
   }
   case 'cancel-journey': {const j=w.journeys.find(j=>j.id===b.id&&j.owner===v);if(!j)throw new Error('Only the owner can stop a Journey.');j.status='cancelled';break;}
   case 'trip-join':if(!w.trip.joined.includes(v))w.trip.joined.push(v);break;
   case 'trip-leave':w.trip.joined=w.trip.joined.filter(id=>id!==v);if(w.trip.proposal)w.trip.proposal.accepted=w.trip.proposal.accepted.filter(id=>id!==v);break;
   case 'regroup': {
    if(!w.trip.joined.includes(v))throw new Error('Join the trip before suggesting a regroup.');
    const place=PLACES.find(p=>p.id===b.place);if(!place)throw new Error('Choose a public meeting place.');
    w.trip.proposal={id:crypto.randomUUID(),place,from:v,accepted:[v],declined:[],status:'pending'};break;
   }
   case 'trip-respond': {
    const p=w.trip.proposal;if(!p||!w.trip.joined.includes(v))throw new Error('No active proposal for you.');
    p.accepted=p.accepted.filter(id=>id!==v);p.declined=p.declined.filter(id=>id!==v);
    if(b.accept)p.accepted.push(v);else p.declined.push(v);
    p.status=w.trip.joined.every(id=>p.accepted.includes(id))?'agreed':'pending';break;
   }
   case 'trip-complete':if(w.trip.proposal?.status==='agreed')w.trip.proposal=null;else throw new Error('The group has not agreed yet.');break;
   case 'simulate-move': {
    const p=person(b.person);const permission=authorizeLocation(w,v,b.person);if(permission?.precision!=='precise')throw new Error('An active navigation permission is required.');
    p.actual=[p.actual[0]+.0005,p.actual[1]+.00025];p.updatedAt=now;p.moving=true;break;
   }
   case 'status':w.users[v].status=String(b.text||'Exploring').slice(0,60);w.users[v].emoji=b.emoji||'💭';break;
   case 'moment': {
    const text=String(b.text||'').trim().slice(0,280);if(!text)throw new Error('Write a little something first.');
    const audience=(b.audience||[]).filter(id=>related(w,v,id));if(!audience.length)throw new Error('Choose who can see your Moment.');
    w.moments.unshift({id:crypto.randomUUID(),owner:v,text,audience,place:PLACES.find(p=>p.id===b.place)?.name||null,createdAt:now});break;
   }
   case 'reset':req.demo.world=createWorld();req.demo.viewer='alex';break;
   default:throw new Error('Unknown action.');
  }
  res.json(worldFor(req.demo.world,req.demo.viewer));
 }catch(e){res.status(400).json({error:e.message});}
});
app.get('/api/route',(req,res)=>{
 const w=req.demo.world,v=req.demo.viewer;let destination;
 try{
  if(req.query.person){const allowed=authorizeLocation(w,v,req.query.person);if(allowed?.precision!=='precise')return res.status(403).json({error:'Navigation to a person requires their active approval.'});destination=allowed.coordinate;}
  else{const place=PLACES.find(p=>p.id===req.query.place);if(!place)throw new Error('Unknown public meeting place.');destination=place.coordinate;}
  const route=routing.route(w.users[v].actual,destination,req.query.mode||'walk');res.json({...route,targetCoordinate:destination});
 }catch(e){res.status(400).json({error:e.message});}
});
app.get('/api/halfway',(req,res)=>{
 const w=req.demo.world,v=req.demo.viewer,p=w.users[req.query.person];
 if(!p||!related(w,v,p.id)||p.hidden)return res.status(403).json({error:'Meeting suggestions are unavailable.'});
 const suggestions=PLACES.map(place=>({place,yourMinutes:Math.max(1,Math.round(distance(w.users[v].actual,place.coordinate)/75)),theirMinutes:Math.max(1,Math.round(distance(p.actual,place.coordinate)/75)),simulated:true})).sort((a,b)=>Math.abs(a.yourMinutes-a.theirMinutes)-Math.abs(b.yourMinutes-b.theirMinutes));res.json(suggestions);
});
app.get('/api/regroup',(req,res)=>{
 const w=req.demo.world,v=req.demo.viewer;if(!w.trip.joined.includes(v))return res.status(403).json({error:'Join the trip first.'});
 res.json(PLACES.map(place=>({place,members:w.trip.joined.filter(id=>!w.users[id].hidden&&related(w,v,id)||id===v&&!w.users[id].hidden).map(id=>({id,name:w.users[id].name,minutes:Math.max(1,Math.round(distance(w.users[id].actual,place.coordinate)/75)),mode:'walk'})),simulated:true})));
});
const root=fileURLToPath(new URL('..',import.meta.url));
if(process.env.NODE_ENV==='production'){app.use(express.static(path.join(root,'dist')));app.get('/{*splat}',(_,res)=>res.sendFile(path.join(root,'dist/index.html')));}
else{const {createServer}=await import('vite');const vite=await createServer({root,server:{middlewareMode:true,allowedHosts:true},appType:'spa'});app.use(vite.middlewares);}
const port=Number(process.env.PORT)||3000;
app.listen(port,'0.0.0.0',()=>console.log(`Kindred demo listening on port ${port}`));
