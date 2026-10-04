import {useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {useMutation} from '../app/useMutation';
import {McheyneRepository} from './repository';
import {calendarYear,sequenceOnOrAfter,sequenceOnOrBefore} from './calendar';
import {validateCompletedThroughDate} from './import-date';
import type {LocalDate} from '../domain/types';
import type {McheynePlan} from './types';
const repository=new McheyneRepository();
export function PlanSetup({plan,today,onSaved,introduction=false}:{plan:McheynePlan;today:LocalDate;onSaved:()=>void;introduction?:boolean}) {
 const location=useLocation(),origin=location.pathname+location.search;
 const mutation=useMutation(),[date,setDate]=useState<LocalDate>(today);
 const enroll=(mode:'calendar'|'self'|'import')=>mutation.run(async()=>{
  if(mode==='calendar')await repository.enrollCalendar(today,sequenceOnOrAfter(plan,today)??365);
  else if(mode==='self')await repository.enrollSelfPaced(today);
  else {validateCompletedThroughDate(date,today);const through=sequenceOnOrBefore(plan,date);if(!through)throw new Error('No reading assignment exists for this date.');await repository.enrollCalendarWithProgress(today,through);}
  onSaved();
 });
 return <section className="today-setup plan-setup" aria-labelledby="setup-heading">
  <h2 id="setup-heading">Begin a daily rhythm.</h2><p>M’Cheyne pairs four readings each day, from across Scripture. Choose the rhythm that suits you.</p>
  {introduction&&<Link to="/welcome?return=%2Ftoday">New here? A gentle introduction →</Link>}
  <div className="plan-mode"><h3>Follow the calendar</h3><p>Read today’s dated assignment. Earlier days stay available; starting today does not mark them missed. February 29 is a pause.</p><button disabled={mutation.busy} className="grace-primary" onClick={()=>void enroll('calendar')}>Follow today’s calendar</button></div>
  <div className="plan-mode"><h3>Read at your own pace</h3><p>Start with Day 1. Move forward after explicitly completing all four readings, with no deadline.</p><button disabled={mutation.busy} onClick={()=>void enroll('self')}>Start self-paced at Day 1</button></div>
  <details className="today-import"><summary>Already following this year?</summary><p>Import the readings you’ve completed through a date. This records progress without adding past completion events to History.</p><label>Completed through date<input type="date" disabled={mutation.busy} min={`${calendarYear(today)}-01-01`} max={today} value={date} onChange={event=>setDate(event.target.value as LocalDate)}/></label><button disabled={mutation.busy} onClick={()=>void enroll('import')}>Import through this date</button></details>
  <p className="mutation-status" role={mutation.failed?'alert':'status'}>{mutation.busy?'Saving…':mutation.status}</p>
  <p className="journal-help">A plan is optional. You can read and pray freely.</p><div className="journal-actions"><Link to={'/bible?'+new URLSearchParams({return:origin})}>Explore the Bible</Link><Link to={'/prayer?'+new URLSearchParams({return:origin})}>Open Prayer</Link><Link to={'/data?'+new URLSearchParams({section:'restore',return:origin})}>Restore a backup</Link></div>
 </section>;
}
