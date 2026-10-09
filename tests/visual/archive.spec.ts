import { expect, test } from '@playwright/test';
import { openRoute } from '../ux/helpers';
import { seedArchive } from '../ux/archive-fixture';
const routes = { search:'/search?q=grace&scope=prayers', saved:'/bible/saved?view=notes', collections:'/bible/collections?collection=00000000-0000-4000-8000-000000013000' };
test.beforeEach(async({page})=>{await page.clock.setFixedTime(new Date('2026-04-24T07:00:00+02:00'));await page.emulateMedia({reducedMotion:'reduce'});});
for(const surface of ['search','saved','collections'] as const)for(const [width,height] of [[320,568],[360,800],[390,844],[430,932],[768,1024],[1440,900]])test(`Archive ${surface} ${width}`,async({page})=>{
 await page.setViewportSize({width:width!,height:height!});await seedArchive(page);await openRoute(page,routes[surface]);await expect(page.locator(surface==='collections'?'.collection-journal-item':'.archive-row')).not.toHaveCount(0);await page.evaluate(()=>document.fonts.ready);await expect(page).toHaveScreenshot(`archive-${surface}-${width}.png`,{fullPage:true});
});
for(const surface of ['search','saved','collections'] as const)for(const state of ['dark','text200','empty','long'] as const)test(`Archive ${surface} ${state}`,async({page})=>{
 await page.setViewportSize({width:state==='text200'?320:390,height:844});if(state==='dark')await page.emulateMedia({colorScheme:'dark'});
 if(state!=='empty')await seedArchive(page,5,state==='long');
 await openRoute(page,state==='empty'?(surface==='search'?'/search?q=not-present-in-the-journal':surface==='saved'?'/bible/saved?view=bookmarks':'/bible/collections'):routes[surface]);
 if(state==='text200')await page.evaluate(()=>document.documentElement.style.fontSize='200%');
 await expect(page.locator(state==='empty'?'.archive-empty':surface==='collections'?'.collection-journal-item':'.archive-row').first()).toBeVisible();await page.evaluate(()=>document.fonts.ready);await page.mouse.move(0,0);await expect(page).toHaveScreenshot(`archive-${surface}-${state}.png`,{fullPage:true});
});
for(const state of ['filters','all','no-query','scripture-failure'] as const)test(`Search ${state}`,async({page})=>{
 await page.setViewportSize({width:390,height:844});await seedArchive(page);if(state==='scripture-failure')await page.route('**/bible/search-index.json',route=>route.abort());await openRoute(page,state==='no-query'?'/search':'/search?q=grace');
 if(state==='filters')await page.getByText('Scripture filters',{exact:true}).click();
 if(state==='scripture-failure')await expect(page.getByRole('alert')).toBeVisible();else if(state!=='no-query')await expect(page.locator('.search-hit').first()).toBeVisible();
 await page.evaluate(()=>document.fonts.ready);await expect(page).toHaveScreenshot(`archive-search-${state}.png`,{fullPage:true});
});
for(const state of ['create','rename','note','confirmation','conflict','unavailable'] as const)test(`Collections ${state}`,async({page})=>{
 await page.setViewportSize({width:390,height:844});await seedArchive(page);await openRoute(page,'/bible/collections?collection=00000000-0000-4000-8000-000000013000'+(state==='unavailable'?'&item=removed':''));await expect(page.locator('.collection-journal-item')).toHaveCount(20);
 if(state==='create'){await page.getByRole('button',{name:'Add collection',exact:true}).click();await page.getByLabel('New collection').fill('Words of encouragement');}
 if(state==='rename'){await page.getByRole('button',{name:'Rename',exact:true}).click();await page.getByLabel('Collection name').fill('Promises for our family');}
 if(state==='note'||state==='conflict'){await page.locator('#collection-note-00000000-0000-4000-8000-000000014000').click();await page.getByLabel('Passage note').fill('Remember this passage in uncertain seasons.');}
 if(['create','rename','note','conflict'].includes(state))await expect(page.locator('.draft-status')).toHaveText('Draft kept on this device');
 if(state==='confirmation'){await page.getByRole('button',{name:'Delete collection',exact:true}).click();}
 if(state==='conflict'){
  await page.evaluate(async()=>{const database=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('my-daily-devotion');r.onsuccess=()=>resolve(r.result);});const tx=database.transaction('collectionItems','readwrite'),store=tx.objectStore('collectionItems'),r=store.get('00000000-0000-4000-8000-000000014000');r.onsuccess=()=>store.put({...r.result,note:'A saved note from another window.',revision:2});await new Promise<void>(resolve=>{tx.oncomplete=()=>resolve();});database.close();window.dispatchEvent(new Event("focus"));});
  await expect(page.getByRole('button',{name:'Save note',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Review latest saved version',exact:true}).click();await expect(page.getByRole('textbox',{name:'Saved version',exact:true})).toBeVisible();
 }
 await page.evaluate(async()=>{await document.fonts.ready;if(document.activeElement?.matches('.skip-link'))(document.activeElement as HTMLElement).blur();});await expect(page).toHaveScreenshot(`archive-collections-${state}.png`,{fullPage:state!=='confirmation'});
});
for(const surface of ['saved','collections'] as const)test(`Archive ${surface} read error`,async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.addInitScript((store)=>{const original=IDBObjectStore.prototype.openCursor;IDBObjectStore.prototype.openCursor=function(...args){if(this.name===store)throw new DOMException('Test storage read failure','UnknownError');return original.apply(this,args);};},surface==='saved'?'bookmarks':'collections');await openRoute(page,surface==='saved'?'/bible/saved':'/bible/collections');await expect(page.getByRole('alert')).toBeVisible();await page.evaluate(()=>document.fonts.ready);await expect(page).toHaveScreenshot(`archive-${surface}-read-error.png`,{fullPage:true});
});
