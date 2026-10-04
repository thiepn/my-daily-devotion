import { expect, type Page } from '@playwright/test';
import { openRoute } from './helpers';
export async function seedArchive(page: Page, count = 5, long = false) {
 await openRoute(page, '/search'); await expect(page.locator('.search-journal')).toBeVisible();
 await page.evaluate(async ({count,long}) => {
  const database = await new Promise<IDBDatabase>((resolve,reject) => {const r=indexedDB.open('my-daily-devotion');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const stores=['prayers','prayerUpdates','prayerResolutions','people','bookmarks','highlights','verseNotes','collections','collectionItems'];
  const tx=database.transaction(stores,'readwrite'), done=new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});
  const fields=(id:string,i=0)=>({id,createdAt:'2026-04-20T08:00:00.000Z',updatedAt:new Date(Date.UTC(2026,3,24,6,0,count-i)).toISOString(),revision:1,deletedAt:null});
  const peopleCount=Math.min(count,35);
  for(let i=0;i<peopleCount;i++) {
   tx.objectStore('people').put({...fields('archive-person-'+i,i),name:['Anna Kim','Daniel Park','Our community','Miriam','Parents'][i%5]+(i>=5?' '+i:''),relationship:'Friend',notes:'Private cedar recollection'});
  }
  tx.objectStore('prayerUpdates').put({...fields('archive-update'),prayerId:'archive-prayer-1',type:'encouragement',body:'A quiet grace reminder for the journey.',occurredAt:'2026-04-23T07:00:00.000Z'});
  tx.objectStore('prayerResolutions').put({...fields('archive-answer'),prayerId:'archive-prayer-0',reflectionMd:'Grace in an unexpected answer.',answeredAt:'2026-04-24T07:00:00.000Z'});
  for(let i=0;i<5;i++) {
   const ref={translationId:'BSB',startVerseKey:'JHN.3.'+(16+i),endVerseKey:'JHN.3.'+(18+i)};
   tx.objectStore('bookmarks').put({...fields('archive-bookmark-'+i,i),...ref,label:'Grace to remember'});
   tx.objectStore('highlights').put({...fields('archive-highlight-'+i,i),...ref,style:null});
   tx.objectStore('verseNotes').put({...fields('archive-note-'+i,i),...ref,bodyMd:'A reminder of grace and the love of God.'});
  }
  tx.objectStore('collections').put({...fields('archive-collection'),name:'Promises to remember',description:'Passages for moments of grace.',sortOrder:0});
  for(let i=0;i<25;i++)tx.objectStore('collectionItems').put({...fields('archive-item-'+i,i),collectionId:'archive-collection',translationId:'BSB',startVerseKey:'PSA.'+(i+1)+'.1',endVerseKey:'PSA.'+(i+1)+'.2',note:'Grace remembered in this passage.'+(long?' '+ 'The Lord is faithful through every uncertain season. '.repeat(12):''),sortOrder:i});
  await done;
  // Bound synthetic fixture writes, which are much slower in Windows WebKit than other engines.
  // Search measurements start after all batches commit, independently of preparation time.
  for(let start=0;start<count;start+=250) {
   const batch=database.transaction('prayers','readwrite');
   const completed=new Promise<void>((resolve,reject)=>{batch.oncomplete=()=>resolve();batch.onabort=()=>reject(batch.error);batch.onerror=()=>reject(batch.error);});
   for(let i=start;i<Math.min(count,start+250);i++)batch.objectStore('prayers').put({...fields('archive-prayer-'+i,i),body:'Grace for '+['our family','a friend in treatment','our community','a new season','daily faithfulness'][i%5]+(long?' — '+ 'Help us listen with patience and remain faithful through difficult days. '.repeat(20):'.'),status:i===0?'ANSWERED':'ACTIVE',personId:'archive-person-'+(i%peopleCount),categoryId:null,scheduleId:null,eventDate:null,focusUntil:null,sourceReflectionId:null,sourceDevotionDate:null,lastPrayedAt:null,archivedAt:null});
   await completed;
  }
  database.close();
 },{count,long});
 await page.reload(); await expect(page.locator('.search-journal')).toBeVisible();
}
