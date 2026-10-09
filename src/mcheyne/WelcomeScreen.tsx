import {useEffect,useState} from 'react';
import {Link,useLocation,useNavigate} from 'react-router-dom';
import {JournalHeading} from '../writing/JournalPrimitives';
import {usePrayerRead} from '../prayer/detail-hooks';
import {useMutation} from '../app/useMutation';
import {safeDataReturn} from '../data/data-context';
import {readJourneyPreference,saveJourneyPreference} from './journal-model';
export function WelcomeScreen(){
 const location=useLocation(),navigate=useNavigate(),origin=new URLSearchParams(location.search).get('return'),back=(origin==='/data'||origin?.startsWith('/data?'))&&!/[\\\x00-\x1f]/.test(origin)?origin:safeDataReturn(origin);
 const read=usePrayerRead('introduction',readJourneyPreference),mutation=useMutation(),[name,setName]=useState(''),[dirty,setDirty]=useState(false);
 useEffect(()=>{if(read.data&&!dirty)setName(read.data.name);},[read.data,dirty]);
 const save=()=>mutation.run(async()=>{if(!read.data)throw new Error('Retry opening your preferences first.');const next=await saveJourneyPreference({...read.data,name});read.accept(()=>next);setDirty(false);mutation.setStatus('Greeting saved locally.');});
 const skip=()=>mutation.run(async()=>{if(!read.data)throw new Error('Retry opening your preferences first.');await saveJourneyPreference({...read.data,dismissed:true});navigate(back);});
 return <main className="journal-workspace plan-journal welcome-journal"><JournalHeading title="A gentle beginning" subtitle="Read · Reflect · Pray · Remember" back={back}/><p className="plan-intro">A little Scripture, space to write, and someone to bring before God. Begin where you are.</p>
 <section className="grace-paper welcome-name"><h2>Make this journal feel like yours</h2><label htmlFor="preferred-name">Preferred name (optional)</label><input id="preferred-name" maxLength={60} disabled={mutation.busy} value={name} onChange={event=>{setName(event.target.value);setDirty(true);}} autoComplete="given-name"/><p className="journal-help">Used only in your greeting. No account is needed.</p><button disabled={mutation.busy||!read.data} onClick={()=>void save()}>Save greeting</button></section>
 {read.error&&<p role="alert">{read.error}<button onClick={read.retry}>Retry preferences</button></p>}<p role={mutation.failed?'alert':'status'}>{mutation.busy?'Saving…':mutation.status}</p>
 <section className="welcome-paths" aria-label="Ways to begin"><Link className="grace-paper" to={'/today/plan?'+new URLSearchParams({return:location.pathname+location.search})}><small>A daily rhythm</small><h2>Begin devotion</h2><p>Choose calendar or self-paced M’Cheyne before enrolling.</p></Link><div className="grace-paper"><small>At your own pace</small><h2>Explore freely</h2><p>Read Scripture or begin with prayer, without joining a plan.</p><div className="journal-actions"><Link to={'/bible?'+new URLSearchParams({return:location.pathname+location.search})}>Open Bible</Link><Link to="/prayer">Open Prayer</Link></div></div><Link className="grace-paper" to={'/data?'+new URLSearchParams({section:'restore',return:'/welcome'})}><small>Bring your journal</small><h2>Restore a backup</h2><p>Review an existing backup before importing it.</p></Link></section>
 <p className="journal-help">Saved writing stays on this device and works offline. Keep an external backup to protect it.</p><button className="grace-primary" disabled={mutation.busy||!read.data} onClick={()=>void skip()}>Skip introduction</button><p className="journal-help">You can return here to change your name. Unsaved name changes are not applied when you skip.</p></main>;
}
