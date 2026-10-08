import React from 'react';
import {useEffect,useRef,useState} from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {Plus,Minus,Navigation,Layers,Sun,Moon,RotateCcw,MapPin} from 'lucide-react';
const empty={type:'FeatureCollection',features:[]};
const CENTER=[-74.0095,40.7088];
const INITIAL=()=>({center:CENTER,zoom:innerWidth<600?14.25:15.05,pitch:innerWidth<600?42:48,bearing:-23});
function circle(center,radius){const coords=[];for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;coords.push([center[0]+Math.cos(a)*radius/(111320*Math.cos(center[1]*Math.PI/180)),center[1]+Math.sin(a)*radius/111320]);}return {type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[coords]}};}
function style(night){return {version:8,glyphs:'/geography/fonts/{fontstack}/{range}.pbf',sources:{land:{type:'geojson',data:'/geography/land.geojson'},buildings:{type:'geojson',data:'/geography/buildings.geojson'},roads:{type:'geojson',data:'/geography/roads.geojson'},areas:{type:'geojson',data:empty},route:{type:'geojson',data:empty}},light:{anchor:'viewport',color:night?'#c5d3ef':'#ffffff',intensity:.3,position:[1.5,160,42]},layers:[
 {id:'water',type:'background',paint:{'background-color':night?'#263b44':'#b2d8d6'}},
 {id:'land',type:'fill',source:'land',paint:{'fill-color':night?'#34453d':'#e0e6d4'}},
 {id:'road-outline',type:'line',source:'roads',paint:{'line-color':night?'#566054':'#c8cebd','line-width':['interpolate',['linear'],['zoom'],13,2,16,12,18,28]}},
 {id:'roads',type:'line',source:'roads',paint:{'line-color':night?'#728071':'#fcfcf1','line-width':['interpolate',['linear'],['zoom'],13,1,16,8,18,24]},layout:{'line-join':'round','line-cap':'round'}},
 {id:'areas',type:'fill',source:'areas',paint:{'fill-color':'#a5b886','fill-opacity':night?.08:.12}},
 {id:'area-edge',type:'line',source:'areas',paint:{'line-color':night?'#89ae90':'#89a577','line-opacity':.3,'line-width':1,'line-dasharray':[3,4]}},
 {id:'buildings',type:'fill-extrusion',source:'buildings',paint:{'fill-extrusion-color':['interpolate',['linear'],['get','height'],0,night?'#5b6b60':'#e8e9d7',50,night?'#6b7d70':'#d5dcc7',200,night?'#849789':'#e9eddf'],'fill-extrusion-height':['get','height'],'fill-extrusion-base':0,'fill-extrusion-opacity':1,'fill-extrusion-vertical-gradient':true}},
 {id:'route-halo',type:'line',source:'route',paint:{'line-color':'#fff','line-width':10,'line-opacity':.7},layout:{'line-cap':'round','line-join':'round'}},
 {id:'route-line',type:'line',source:'route',paint:{'line-color':'#547b5d','line-width':5},layout:{'line-cap':'round','line-join':'round'}},
 {id:'road-label',type:'symbol',source:'roads',minzoom:16,filter:['has','name'],layout:{'symbol-placement':'line','text-field':['get','name'],'text-font':['Noto Sans Regular'],'text-size':10,'text-max-angle':30,'symbol-spacing':400},paint:{'text-color':night?'#b7c5b6':'#8c967f','text-halo-color':night?'#34453d':'#f9faf1','text-halo-width':2}},
 ]};}
export default function WorldMap({people=[],self,places=[],onPerson,onPlace,route,night,onNight,filter='all',onReady}){
 const container=useRef(),mapRef=useRef(),markers=useRef([]),callback=useRef({onPerson,onPlace});callback.current={onPerson,onPlace};
 const [ready,setReady]=useState(false),[flat,setFlat]=useState(false),[error,setError]=useState(false);
 useEffect(()=>{
  let m;try{m=new maplibregl.Map({container:container.current,style:style(night),...INITIAL(),antialias:true,maxBounds:[[-74.034,40.696],[-73.985,40.730]],minZoom:13.5,maxZoom:18.5,attributionControl:false});}
  catch{setError(true);return;}
  mapRef.current=m;m.addControl(new maplibregl.AttributionControl({compact:true,customAttribution:'© OpenStreetMap contributors · Natural Earth · vis.gl'}),'bottom-left');
  m.on('load',()=>{setReady(true);onReady?.();});m.on('error',e=>{if(e.error?.message?.includes('WebGL'))setError(true);});
  return()=>{markers.current.forEach(x=>x.remove());m.remove();};
 },[]);
 useEffect(()=>{const m=mapRef.current;if(!ready||!m)return;m.setStyle(style(night));m.once('style.load',()=>{setReady(false);setTimeout(()=>setReady(true),50);});},[night]);
 useEffect(()=>{
  const m=mapRef.current;if(!ready||!m?.isStyleLoaded())return;
  markers.current.forEach(x=>x.remove());markers.current=[];
  const visible=people.filter(p=>p.location?.coordinate&&(filter==='all'||filter==='nearby'&&p.nearby||p.circle.includes(filter)));
  m.getSource('areas')?.setData({type:'FeatureCollection',features:visible.filter(p=>p.location.precision==='approximate').map(p=>circle(p.location.coordinate,Math.min(p.location.radius,220)))});
  for(const p of visible){
   const el=document.createElement('button');el.className=`world-person ${p.location.precision==='precise'?'precise':''} ${p.moment?'has-moment':''}`;el.setAttribute('aria-label',`Open ${p.name}'s details`);
   el.innerHTML=`<span class="person-orbit"></span><span class="map-face"><img src="/avatars/${p.id}.svg" alt=""/></span><span class="map-status">${p.emoji}</span><span class="map-name">${p.name}<small>${p.location.precision==='precise'?'Sharing with you':p.nearby?'Nearby':p.location.area||'Area only'}</small></span>`;
   el.onclick=()=>callback.current.onPerson(p);markers.current.push(new maplibregl.Marker({element:el,anchor:'bottom'}).setLngLat(p.location.coordinate).addTo(m));
  }
  if(self?.coordinate){const el=document.createElement('div');el.className='self-point';el.innerHTML='<span></span><small>You</small>';markers.current.push(new maplibregl.Marker({element:el}).setLngLat(self.coordinate).addTo(m));}
  for(const p of places){const el=document.createElement('button');el.className='place-marker';el.setAttribute('aria-label',`Explore ${p.name}`);el.innerHTML=`<span>${p.emoji}</span><small>${p.name}</small>`;el.onclick=()=>callback.current.onPlace(p);markers.current.push(new maplibregl.Marker({element:el,anchor:'center'}).setLngLat(p.coordinate).addTo(m));}
 },[people,self,ready,filter]);
 useEffect(()=>{const m=mapRef.current;if(!ready||!m?.isStyleLoaded())return;m.getSource('route')?.setData(route?{type:'Feature',properties:{},geometry:route.geometry}:empty);if(route){const bounds=new maplibregl.LngLatBounds();route.geometry.coordinates.forEach(p=>bounds.extend(p));m.fitBounds(bounds,{padding:{top:150,bottom:180,left:80,right:innerWidth>900?410:80},maxZoom:16.6,pitch:45,duration:1300});}},[route,ready]);
 const reset=()=>mapRef.current?.flyTo({...INITIAL(),pitch:flat?0:INITIAL().pitch,duration:1200});
 return <div className={`world-map ${night?'night':''}`}><div ref={container} className="map-canvas" data-testid="world-map"/>{error&&<div className="map-error"><MapPin size={30}/><h3>3D needs WebGL</h3><p>Enable hardware acceleration to explore the real city. Your people and coordination tools are still available.</p></div>}
  <div className="map-tools"><button title="Zoom in" aria-label="Zoom in" onClick={()=>mapRef.current?.zoomIn()}><Plus size={18}/></button><button title="Zoom out" aria-label="Zoom out" onClick={()=>mapRef.current?.zoomOut()}><Minus size={18}/></button><i/><button title="Recenter World" aria-label="Recenter World" onClick={reset}><Navigation size={17}/></button></div>
  <div className="appearance-tools"><button className={!flat?'selected':''} onClick={()=>{setFlat(!flat);mapRef.current?.easeTo({pitch:flat?INITIAL().pitch:0,duration:800});}}><Layers size={15}/>{flat?'2D':'3D'}</button><button aria-label={night?'Switch to day':'Switch to night'} onClick={onNight}>{night?<Sun size={17}/>:<Moon size={17}/>}</button></div>
  <button className="map-reset" aria-label="Reset map view" onClick={reset}><RotateCcw size={15}/></button>
 </div>;
}
