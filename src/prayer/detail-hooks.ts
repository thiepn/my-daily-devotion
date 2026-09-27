import {useEffect,useRef,useState} from "react";
import {liveQuery} from "dexie";
export function usePrayerRead<T>(key:string,read:()=>Promise<T>) {
 const reader=useRef(read);reader.current=read;
 const [attempt,setAttempt]=useState(0);
 const [state,setState]=useState<{key:string;data:T|undefined;error:string}>({key,data:undefined,error:""});
 useEffect(()=>{
  let active=true;
  const subscription=liveQuery(()=>reader.current()).subscribe({
   next:data=>{if(active)setState({key,data,error:""});},
   error:()=>{if(active)setState(old=>({key,data:old.key===key?old.data:undefined,error:"Could not refresh these saved details. Please try again."}));}
  });
  const refresh=()=>{if(document.visibilityState==="visible")setAttempt(n=>n+1);};
  window.addEventListener("focus",refresh);window.addEventListener("pageshow",refresh);document.addEventListener("visibilitychange",refresh);
  return ()=>{active=false;subscription.unsubscribe();window.removeEventListener("focus",refresh);window.removeEventListener("pageshow",refresh);document.removeEventListener("visibilitychange",refresh);};
 },[key,attempt]);
 return {data:state.key===key?state.data:undefined,error:state.key===key?state.error:"",retry:()=>setAttempt(n=>n+1),
 accept:(change:(data:T|undefined)=>T)=>setState(old=>old.key===key?{key,data:change(old.data),error:""}:old)};
}
const positions=new Map<string,{y:number;focus:string}>();
export function usePrayerPosition(url:string,ready:boolean,entry:string|null) {
 const restored=useRef("");
 useEffect(()=>{
  let position=positions.get(url)??{y:0,focus:""};
  const scroll=()=>{position={...position,y:window.scrollY};};
  const focus=(event:Event)=>{const target=event.target instanceof Element?event.target.closest<HTMLElement>(".prayer-record [id]"):null;if(target)position={y:window.scrollY,focus:target.id};};
  window.addEventListener("scroll",scroll);document.addEventListener("focusin",focus);document.addEventListener("pointerdown",focus);
  return()=>{positions.set(url,position);if(positions.size>60)positions.delete(positions.keys().next().value!);window.removeEventListener("scroll",scroll);document.removeEventListener("focusin",focus);document.removeEventListener("pointerdown",focus);restored.current="";};
 },[url]);
 useEffect(()=>{
  if(!ready||restored.current===url)return;
  const frame=requestAnimationFrame(()=>{
   const saved=positions.get(url);const target=document.getElementById(saved?.focus||(entry?"prayer-entry-"+entry:""));
   target?.focus({preventScroll:true});
   if(saved)window.scrollTo({top:saved.y,behavior:"instant"});else if(target)target.scrollIntoView({block:"center",behavior:"instant"});
   restored.current=url;
  });
  return()=>cancelAnimationFrame(frame);
 },[url,ready,entry]);
}

