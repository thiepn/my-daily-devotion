import { McheyneRepository } from './repository';
import { loadMcheynePlan } from './loader';
import { assignmentForCalendarDate, sequenceOnOrAfter } from './calendar';
import type { LocalDate, ReadingProgress } from '../domain/types';
import { db } from '../data/database';
import { nowInstant } from '../domain/identity';

export const JOURNEY_PREFERENCE = 'journal.introduction.v1';
export interface JourneyPreference { version: 1; name: string; dismissed: boolean; }
export function parseJourneyPreference(value: unknown): JourneyPreference {
 const input=value && typeof value==='object' ? value as Record<string,unknown> : {};
 return {version:1,name:typeof input.name==='string'?input.name.trim().slice(0,60):'',dismissed:input.dismissed===true};
}
export async function readJourneyPreference() { return parseJourneyPreference((await db.preferences.get(JOURNEY_PREFERENCE))?.value); }
export async function saveJourneyPreference(value: JourneyPreference) {
 const next=parseJourneyPreference(value);
 await db.transaction('rw',db.preferences,async()=>{
  const current=await readJourneyPreference();
  if(current.name===next.name && current.dismissed===next.dismissed)return;
  await db.preferences.put({key:JOURNEY_PREFERENCE,value:next,updatedAt:nowInstant()});
 });
 return next;
}
export function greeting(hour:number) { return hour<12?'Good morning':hour<18?'Good afternoon':'Good evening'; }
/** Asset loading precedes readonly record gathering; browsing never repairs preferences. */
export async function readPlanJournal(today:LocalDate) {
 const plan=await loadMcheynePlan(), repository=new McheyneRepository();
 return db.transaction('r',[db.preferences,db.planEnrollments,db.readingProgress],async()=>{
 const preference=parseJourneyPreference((await db.preferences.get(JOURNEY_PREFERENCE))?.value);
 const enrollment=await repository.getActiveEnrollment(today,false)??null;
 const progress=enrollment?await repository.completionMap(enrollment.id):new Map<string,ReadingProgress>();
 const sequence=enrollment?.mode==='SELF_PACED'?await repository.getCurrentSelfPacedSequence(plan,enrollment):null;
 const assignment=enrollment?.mode==='SELF_PACED'?(sequence?plan.assignments[sequence-1]??null:null):assignmentForCalendarDate(plan,today);
 const earlierUnread=enrollment?.mode==='CALENDAR'?await repository.getEarlierUnreadAssignments(plan,enrollment,assignment?.sequence??sequenceOnOrAfter(plan,today)??366):[];
 return {plan,enrollment,progress,sequence,assignment,earlierUnread,preference};
 });
}
