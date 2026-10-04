import {useEffect,useState} from 'react';
import {Link,useLocation,useSearchParams} from 'react-router-dom';
import {JournalHeading} from '../writing/JournalPrimitives';
import {usePrayerPosition,usePrayerRead} from '../prayer/detail-hooks';
import {useLocalClock} from '../app/useLocalClock';
import {useMutation} from '../app/useMutation';
import {DevotionalIcon} from '../app/visual/DevotionalIcon';
import {safeDataReturn} from '../data/data-context';
import {readPlanJournal} from './journal-model';
import {PlanSetup} from './PlanSetup';
import {buildPlanReadingUrl} from './context';
import {monthForCalendarKey,calendarYear,sequenceOnOrBefore} from './calendar';
import {validateCompletedThroughDate} from './import-date';
import {McheyneRepository} from './repository';
import type {LocalDate} from '../domain/types';
import type {McheyneAssignment} from './types';
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
const repository=new McheyneRepository();
export function PlanScreen(){
 const {localDate:today}=useLocalClock(),location=useLocation(),[params,setParams]=useSearchParams(),read=usePrayerRead('plan:'+today,()=>readPlanJournal(today));
 const mutation=useMutation(),[importDate,setImportDate]=useState<LocalDate>(today),data=read.data;
 const naturalMonth=data?.assignment?monthForCalendarKey(data.assignment.calendarKey):Number(today.slice(5,7));
 const requested=Number(params.get('month')),month=Number.isInteger(requested)&&requested>=1&&requested<=12?requested:naturalMonth;
 const back=safeDataReturn(params.get('return')),url=location.pathname+location.search;
 useEffect(()=>{if(params.has('month')&&!(requested>=1&&requested<=12&&Number.isInteger(requested))){const next=new URLSearchParams(params);next.delete('month');setParams(next,{replace:true});}},[location.search,requested,setParams]);
 usePrayerPosition(url,Boolean(data),null,'.plan-journal');
 const link=(assignment:McheyneAssignment,index:number)=>{if(!data?.enrollment)return '/bible';const path=buildPlanReadingUrl(assignment.readings[index]!,data.enrollment.id,assignment.sequence,index,'plan');return path+'&'+new URLSearchParams({return:url});};
 const importThrough=()=>mutation.run(async()=>{if(!data?.enrollment)return;validateCompletedThroughDate(importDate,today);const sequence=sequenceOnOrBefore(data.plan,importDate);if(!sequence)throw new Error('No reading assignment exists for this date.');await repository.bulkImportThrough(data.enrollment.id,sequence);mutation.setStatus('Progress imported locally.');read.retry();});
 const readings=(assignment:McheyneAssignment,group='archive')=><div className="plan-journal-readings">{assignment.readings.map((reading,index)=>{const done=Boolean(data?.progress.get(`${assignment.sequence}:${index}`)?.completedAt);return <Link id={`plan-${group}-${assignment.sequence}-${index}`} key={index} to={link(assignment,index)}><span className="grace-icon-circle"><DevotionalIcon name={done?'check':'bible'}/></span><span><small>{reading.group==='family'?'Family':'Private'}{done?' · Complete':''}</small><strong>{reading.displayReference}</strong></span><DevotionalIcon name="chevron"/></Link>;})}</div>;
 return <main className="journal-workspace plan-journal mg-plan-workspace"><JournalHeading title="Reading plan" subtitle="M’Cheyne · Scripture for each day" back={back}/>
 {read.error&&<div role="alert" className="journal-notice">{read.error}<button onClick={read.retry}>Try again</button></div>}{!data&&!read.error&&<p role="status">Opening the plan…</p>}
 {data&&!data.enrollment&&<PlanSetup plan={data.plan} today={today} onSaved={read.retry}/>}
 {data?.enrollment&&<><p className="plan-intro">{data.enrollment.mode==='CALENDAR'?'A dated rhythm through the year. Earlier readings remain here whenever you want them.':'One assignment at a time. Your next day begins when you explicitly complete all four readings.'}</p>
 <section className="grace-paper plan-current"><div className="plan-section-heading"><div><small>{data.enrollment.mode==='CALENDAR'?'Calendar':'Self-paced'}</small><h2>{data.assignment?`Your current reading · Day ${data.assignment.sequence}`:today.slice(5)==='02-29'?'A leap-day pause':'Your readings are complete'}</h2></div></div>{data.assignment?readings(data.assignment,'current'):<p>{data.enrollment.mode==='CALENDAR'?'February 29 has no canonical assignment. March 1 keeps its historical readings.':'All 365 assignments remain available below and in History.'}</p>}<Link to="/today">Return to Today →</Link></section>
 <section className="plan-calendar" aria-labelledby="plan-calendar-heading"><div className="plan-section-heading"><h2 id="plan-calendar-heading">Browse readings</h2><label>Month<select aria-label="Choose month" value={month} onChange={event=>{const next=new URLSearchParams(params);next.set('month',event.target.value);setParams(next);}}>{months.map((name,index)=><option key={name} value={index+1}>{name}</option>)}</select></label></div><p className="journal-help">Opening a passage does not mark it complete or move your plan forward.</p><div className="plan-day-list">{data.plan.assignments.filter(item=>monthForCalendarKey(item.calendarKey)===month).map(assignment=><article className={'plan-journal-day'+(assignment.sequence===data.assignment?.sequence?' is-current':'')} key={assignment.sequence}><header><h3>Day {assignment.sequence}</h3><span>{months[month-1]} {Number(assignment.calendarKey.slice(3))}</span></header>{readings(assignment)}</article>)}</div></section>
 <details className="plan-explanations"><summary>Plan details & progress</summary><p>{[...data.progress.values()].filter(item=>item.completedAt!==null).length} of 1,460 readings explicitly marked complete. This is a record of reading, not a measure of faithfulness.</p><p>Family and Private retain the original plan’s groupings; both are available for individual reading. Review or read ahead freely.</p><details><summary>Scripture correction</summary><p>March 1 includes Exodus 12:51. Previously saved completion is unchanged.</p></details>{data.enrollment.mode==='CALENDAR'&&<section className="plan-import"><h3>Already read more this year?</h3><p>Import completed progress through a date without adding past events to History. Individual readings remain reversible.</p><label>Completed through date<input type="date" disabled={mutation.busy} min={`${calendarYear(today)}-01-01`} max={today} value={importDate} onChange={event=>setImportDate(event.target.value as LocalDate)}/></label><button disabled={mutation.busy} onClick={()=>void importThrough()}>Import through date</button></section>}</details>
 <p role={mutation.failed?'alert':'status'}>{mutation.busy?'Saving…':mutation.status}</p></>}
 </main>;
}
