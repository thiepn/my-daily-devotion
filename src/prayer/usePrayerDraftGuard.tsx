import {useEffect,useRef,useState} from "react";
import {useBlocker} from "react-router-dom";
import {JournalDialog} from "../writing/JournalPrimitives";
export function usePrayerDraftGuard({dirty,save,discard,answer=false,canSave=true,pending=false}:{dirty:boolean;save:()=>Promise<void>;discard:()=>void;answer?:boolean;canSave?:boolean;pending?:boolean}) {
 const [next,setNext]=useState<(()=>void)|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const lock=useRef(false),bypass=useRef(false);
 const blocker=useBlocker(({currentLocation,nextLocation})=>(dirty||pending)&&!bypass.current&&(currentLocation.pathname!==nextLocation.pathname||currentLocation.search!==nextLocation.search));
 const wasPending=useRef(false);
 useEffect(()=>{if(wasPending.current&&!pending&&!dirty&&blocker.state==="blocked")blocker.reset();wasPending.current=pending;},[pending,dirty,blocker]);
 useEffect(()=>{if(!dirty)bypass.current=false;},[dirty]);
 useEffect(()=>{const warn=(event:BeforeUnloadEvent)=>{if((dirty||pending)&&!bypass.current){event.preventDefault();event.returnValue="";}};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);},[dirty,pending]);
 const close=()=>{if(lock.current)return;setNext(null);setError("");if(blocker.state==="blocked")blocker.reset();};
 const proceed=()=>{setError("");if(blocker.state==="blocked")blocker.proceed();else {const action=next;setNext(null);action?.();}};
 return {allowNavigation:()=>{bypass.current=true;},request:(action:()=>void)=>{if(pending)return;if(dirty){setError("");setNext(()=>action);}else action();},
 dialog:pending&&blocker.state==="blocked"?<JournalDialog title="Recording your action" close={()=>{}} busy><p>Please wait while this action is recorded.</p><button disabled>Recording…</button></JournalDialog>:(next||blocker.state==="blocked")?<JournalDialog title={answer?"Keep your unfinished answer?":"Keep your unsaved changes?"} close={close} busy={busy}>
  <p>{answer?"This answer has not been recorded. Keep editing and use Mark answered to record it, or discard this note before continuing.":"Save before continuing, discard these changes, or keep editing."}</p>
  {error?<p role="alert">{error}</p>:null}
  <div className="journal-dialog-actions">
   {!answer?<button className="grace-primary" disabled={busy||!canSave} onClick={async()=>{if(lock.current)return;lock.current=true;setBusy(true);try{await save();proceed();}catch(reason){setError(reason instanceof Error?reason.message:"Could not save. Your writing is still here.");}finally{lock.current=false;setBusy(false);}}}>{busy?"Saving…":"Save and continue"}</button>:null}
   <button disabled={busy} onClick={()=>{discard();proceed();}}>Discard and continue</button><button disabled={busy} data-initial-focus onClick={close}>Keep editing</button>
  </div>
 </JournalDialog>:null};
}
