import { expect, type Page } from '@playwright/test';
import { openRoute } from './helpers';
export async function seedHistoryJournal(page: Page, options: { count?: number; long?: boolean; priorYear?: boolean } = {}) {
  await openRoute(page, '/history');
  await page.evaluate(async options => {
    const database = await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('my-daily-devotion');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const tx=database.transaction(['activityEvents','prayers','prayerResolutions','reflections','devotionDays','planEnrollments'],'readwrite');
    const done=new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
    const at='2026-04-24T06:00:00.000Z', fields=(id:string)=>({id,createdAt:at,updatedAt:at,revision:1,deletedAt:null});
    tx.objectStore('planEnrollments').put({...fields('history-plan'),planId:'mcheyne-classic',planVersion:1,mode:'calendar',startedOn:'2026-01-01',startSequence:1});
    for(let i=0;i<2;i++)tx.objectStore('prayers').put({...fields(`history-prayer-${i}`),body:i?'Grateful for guidance and provision.':'Strength for the week ahead.',status:i?'ANSWERED':'ACTIVE',personId:null,categoryId:null,scheduleId:null,eventDate:null,focusUntil:null,sourceReflectionId:null,sourceDevotionDate:null,lastPrayedAt:null,archivedAt:null});
    tx.objectStore('prayerResolutions').put({...fields('history-answer'),prayerId:'history-prayer-1',answeredAt:'2026-04-20T06:00:00.000Z',reflectionMd:'God provided a way forward. We are grateful.'});
    const putEvent=(id:string,type:string,date:string,subjectId:string,metadata={})=>tx.objectStore('activityEvents').put({id,type,localDate:date,occurredAt:`${date}T06:00:00.000Z`,subjectType:'fixture',subjectId,metadata,timeZone:'Europe/Berlin'});
    putEvent('history-reading','READING_COMPLETED','2026-04-24','reading-1',{enrollmentId:'history-plan',assignmentSequence:114,readingIndex:0});
    putEvent('history-request','PRAYER_CREATED','2026-04-23','history-prayer-0');
    tx.objectStore('devotionDays').put({...fields('history-day'),localDate:'2026-04-22',planEnrollmentId:null,startedAt:at,lastActiveAt:at});
    tx.objectStore('reflections').put({...fields('history-reflection'),localDate:'2026-04-22',devotionDayId:'history-day',bodyMd:'Grateful for His faithfulness in ordinary days.'+(options.long?' Help me remember these moments and carry them with gentleness. '.repeat(40):'')});
    putEvent('history-reflection-event','REFLECTION_CREATED','2026-04-22','history-reflection');
    putEvent('history-answer-event','PRAYER_ANSWERED','2026-04-20','history-prayer-1',{resolutionId:'history-answer'});
    putEvent('history-old-reading','READING_COMPLETED','2026-04-19','reading-2',{enrollmentId:'history-plan',assignmentSequence:109,readingIndex:0});
    for(let i=5;i<(options.count??5);i++){const id=`extra-${String(i).padStart(5,'0')}`;tx.objectStore('reflections').put({...fields(id),localDate:'2026-04-18',devotionDayId:'history-day',bodyMd:`Remembered reflection ${i}. A small kindness.`});putEvent(id,'REFLECTION_CREATED','2026-04-18',id);}
    if(options.priorYear)putEvent('history-prior','PRAYER_CREATED','2025-12-31','history-prayer-0');
    await done;database.close();
  },options);
  await page.reload(); await expect(page.locator('.history-journal-row')).toHaveCount(5); await expect(page.locator('.history-reflection-band blockquote')).toBeVisible(); await page.evaluate(()=>document.fonts.ready);
}
export async function historySnapshot(page:Page){return page.evaluate(async()=>{const database=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('my-daily-devotion');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const names=Array.from(database.objectStoreNames),tx=database.transaction(names,'readonly');const results=await Promise.all(names.map(name=>new Promise<unknown[]>((resolve,reject)=>{const r=tx.objectStore(name).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);})));database.close();return results;});}
