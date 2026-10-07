import { expect, type Page } from "@playwright/test";
import { openRoute } from "./helpers";
export const detailRoute = "/prayer/00000000-0000-4000-8000-000000008001?return="+encodeURIComponent("/prayer?status=ACTIVE&person=00000000-0000-4000-8000-000000008002");
export async function seedPrayerDetail(page:Page, options:{status?:string;count?:number;long?:boolean}={}) {
 await openRoute(page,"/today");
 await page.evaluate(async ({status,count,long})=>{
  const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open("my-daily-devotion");r.onsuccess=()=>resolve(r.result);});
  const tx=db.transaction(["prayers","people","categories","prayerUpdates","prayerResolutions","scriptureLinks","reflections"],"readwrite");
  const done=new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});
  const base={createdAt:"2026-04-20T06:00:00.000Z",updatedAt:"2026-04-24T05:00:00.000Z",revision:1,deletedAt:null};
  tx.objectStore("people").put({...base,id:"00000000-0000-4000-8000-000000008002",name:"Anna Wilson",relationship:"Friend",notes:null});
  tx.objectStore("categories").put({...base,id:"00000000-0000-4000-8000-000000008003",name:"Family",sortOrder:0});
  tx.objectStore("reflections").put({...base,id:"00000000-0000-4000-8000-000000008004",localDate:"2026-04-20",devotionDayId:"00000000-0000-4000-8000-000000008005",bodyMd:"Help me make room for others with patience and kindness."});
  tx.objectStore("prayers").put({...base,id:"00000000-0000-4000-8000-000000008001",body:"Peace and wisdom for the week ahead.\n\nHelp Anna find rest, and give our family patience as we support one another."+(long?" May we keep listening with kindness through every uncertain day.".repeat(30):""),status,personId:"00000000-0000-4000-8000-000000008002",categoryId:"00000000-0000-4000-8000-000000008003",scheduleId:null,eventDate:null,focusUntil:null,sourceReflectionId:"00000000-0000-4000-8000-000000008004",sourceDevotionDate:"2026-04-20",lastPrayedAt:"2026-04-23T06:00:00.000Z",archivedAt:status==="ARCHIVED"?"2026-04-24T05:00:00.000Z":null});
  tx.objectStore("scriptureLinks").put({...base,id:"00000000-0000-4000-8000-000000008006",ownerType:"prayer",ownerId:"00000000-0000-4000-8000-000000008001",translationId:"BSB",startVerseKey:"COL.4.2",endVerseKey:"COL.4.3"});
  for(let i=0;i<count;i++)tx.objectStore("prayerUpdates").put({...base,id:"00000000-0000-4000-8000-"+String(8100+i).padStart(12,"0"),prayerId:"00000000-0000-4000-8000-000000008001",type:i%2?"encouragement":"update",body:i%2?"A small moment of peace today. Thankful for the people walking alongside us.":"We spoke again and made time to listen. "+(long?"There is still much to remember as this story unfolds. ".repeat(20):"Please continue to pray for wisdom."),occurredAt:new Date(Date.UTC(2026,3,21,8,i)).toISOString()});
  if(status==="ANSWERED")tx.objectStore("prayerResolutions").put({...base,id:"00000000-0000-4000-8000-000000008007",prayerId:"00000000-0000-4000-8000-000000008001",answeredAt:"2026-04-23T08:00:00.000Z",reflectionMd:"A clear way forward opened. Thankful for peace and provision."});
  await done;db.close();
 },{status:options.status??"ACTIVE",count:options.count??3,long:options.long??false});
 await openRoute(page,detailRoute);
 await expect(page.getByRole("heading",{name:"Prayer",exact:true})).toBeVisible();
 await page.evaluate(()=>document.fonts.ready);
}

