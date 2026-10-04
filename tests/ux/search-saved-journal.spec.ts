import { expect, test } from '@playwright/test';
import { openRoute, expectNoHorizontalOverflow, expectNoAxeViolations } from './helpers';
import { seedArchive } from './archive-fixture';
import { dataSnapshot } from './data-fixture';
test.beforeEach(async({page})=>{await page.clock.setFixedTime(new Date('2026-04-24T07:00:00+02:00'));await page.emulateMedia({reducedMotion:'reduce'});});
test('search pages precisely and returns to revealed results and focus',async({page})=>{
 await seedArchive(page,35);await openRoute(page,'/search?q=grace&scope=prayers&return=%2Fhistory%3Fperiod%3D2025');
 await expect(page.locator('.search-hit')).toHaveCount(20);await expect(page.locator('.archive-section-heading')).toContainText('20 of 37');
 await page.getByRole('button',{name:'Show more prayers'}).click();await expect(page.locator('.search-hit')).toHaveCount(37);
 const update=page.locator('.search-hit').filter({hasText:'Prayer encouragement'});const href=await update.getAttribute('href');await update.click();
 await expect(page).toHaveURL(/entry=update%3Aarchive-update/);await expect(page.locator('[id="prayer-entry-update:archive-update"]')).toBeFocused();
 await page.getByRole('link',{name:'← Back',exact:true}).click();await expect(page.locator('.search-hit')).toHaveCount(37);await expect(page.locator(`a[href="${href}"]`)).toBeFocused();
 await page.getByRole('button',{name:'People',exact:true}).click();await expect(page).toHaveURL(/scope=people/);await expect(page.locator('.archive-empty')).toContainText('No results');
});
test('private notes are opt-in and person destinations retain search context',async({page})=>{
 await seedArchive(page);await openRoute(page,'/search?q=cedar&scope=people');await expect(page.locator('.archive-empty')).toContainText('No results');
 await page.getByLabel('Include private person notes').check();await expect(page.locator('.search-hit')).toHaveCount(5);await page.locator('.search-hit').first().click();
 await expect(page).toHaveURL(/entry=archive-person-/);await expect(page.locator('.directory-notes')).toContainText('Private cedar');await page.getByRole('link',{name:'← Back',exact:true}).click();await expect(page.getByLabel('Include private person notes')).toBeChecked();
});
test('saved hub preserves ranges and reopens the originating tab',async({page})=>{
 await seedArchive(page);await openRoute(page,'/bible/saved?view=bookmarks&return=%2Fbible%2FLUK%2F9');await expect(page.locator('.archive-row')).toHaveCount(5);
 await page.locator('.archive-row').first().click();await expect(page).toHaveURL(/endVerse=18/);await expect(page.getByRole('button',{name:'Select John 3:18',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('link',{name:'Return to devotional context'}).click();await expect(page.getByRole('button',{name:'Bookmarks',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Collections',exact:true}).click();await page.getByRole('link',{name:/Promises to remember/}).click();await expect(page.getByRole('heading',{name:'Promises to remember'})).toBeVisible();
});
test('collection note destinations reveal targeted entries and explicit edits protect drafts',async({page})=>{
 await seedArchive(page);await openRoute(page,'/bible/collections?collection=archive-collection&item=archive-item-24&return=%2Fsearch%3Fq%3Dgrace');await expect(page.locator('#collection-item-archive-item-24')).toBeFocused();await expect(page.locator('.collection-journal-item')).toHaveCount(25);
 await page.locator('#collection-note-archive-item-24').click();await page.getByLabel('Passage note').fill('New note');await page.getByRole('button',{name:'Add collection',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Keep editing',exact:true}).click();await expect(page.getByLabel('Passage note')).toHaveValue('New note');
 await page.getByRole('button',{name:'Save note',exact:true}).click();await expect(page.locator('#collection-item-archive-item-24')).toContainText('New note');
 await page.locator('#collection-note-archive-item-24').click();const before=await dataSnapshot(page);await page.getByRole('button',{name:'Save note',exact:true}).click();expect(await dataSnapshot(page)).toEqual(before);
});
test('optional Scripture failure leaves private results usable and browsing writes nothing',async({page})=>{
 await seedArchive(page);const before=await dataSnapshot(page);await page.route('**/bible/search-index.json',route=>route.abort());await openRoute(page,'/search?q=grace&scope=prayers');await expect(page.locator('.search-hit')).toHaveCount(7);
 await page.getByRole('button',{name:'All',exact:true}).click();await expect(page.getByRole('alert')).toContainText('personal results remain available');await expect(page.locator('.search-group').first()).toContainText('Prayers');
 await openRoute(page,'/bible/saved?view=highlights');await expect(page.locator('.archive-row')).toHaveCount(5);await openRoute(page,'/bible/collections?collection=archive-collection');await expect(page.locator('.collection-journal-item')).toHaveCount(20);await page.getByRole('button',{name:'Show more',exact:true}).click();await expect(page.locator('.collection-journal-item')).toHaveCount(25);expect(await dataSnapshot(page)).toEqual(before);
});
test('journal archives retain touch targets, contrast, keyboard focus and enlarged reflow',async({page})=>{
 test.setTimeout(120000);await seedArchive(page);
 for(const theme of ['light','dark'] as const){await page.emulateMedia({colorScheme:theme});for(const route of ['/search?q=grace&scope=prayers','/bible/saved?view=notes','/bible/collections?collection=archive-collection']){
  await page.setViewportSize({width:320,height:844});await openRoute(page,route);await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});await expectNoHorizontalOverflow(page);await expectNoAxeViolations(page);
  const controls=page.locator('main button:visible');for(const control of await controls.all()){const box=await control.boundingBox();expect(box!.height).toBeGreaterThanOrEqual(44);}
  await page.getByRole('link',{name:'← Back',exact:true}).focus();await expect(page.getByRole('link',{name:'← Back',exact:true})).toBeFocused();await page.evaluate(()=>{document.documentElement.style.fontSize='';});
 }}
});
test('a 10000-record journal remains searchable without a persistent index',async({page},info)=>{
 test.setTimeout(120000);await seedArchive(page,10000);const started=Date.now();await openRoute(page,'/search?q=grace&scope=prayers');await expect(page.locator('.archive-section-heading')).toContainText('20 of 10002');await expect(page.locator('.search-hit')).toHaveCount(20);const coldMs=Date.now()-started;await page.getByLabel('Search MDD').fill('faithfulness');const warmStart=Date.now();await page.getByRole('button',{name:'Search',exact:true}).click();await expect(page.locator('.archive-section-heading')).toContainText('20 of 2000');await info.attach('archive-search-timing',{body:JSON.stringify({records:10000,coldMs,warmMs:Date.now()-warmStart,engine:info.project.name}),contentType:'application/json'});
});

test('collection conflicts preserve both versions and removal rechecks revisions',async({page})=>{
 await seedArchive(page);await openRoute(page,'/bible/collections?collection=archive-collection');await page.locator('#collection-note-archive-item-0').click();await page.getByLabel('Passage note').fill('My new wording');
 await page.evaluate(async()=>{const database=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('my-daily-devotion');r.onsuccess=()=>resolve(r.result);});const tx=database.transaction('collectionItems','readwrite'),store=tx.objectStore('collectionItems'),r=store.get('archive-item-0');r.onsuccess=()=>store.put({...r.result,note:'Other saved wording',revision:2});await new Promise<void>(resolve=>{tx.oncomplete=()=>resolve();});database.close();});
 await page.getByRole('button',{name:'Save note',exact:true}).click();await expect(page.getByLabel('Passage note')).toHaveValue('My new wording');await page.getByRole('button',{name:'Review latest saved version',exact:true}).click();await expect(page.getByRole('textbox',{name:'Saved version',exact:true})).toHaveValue('Other saved wording');
 await page.getByRole('button',{name:'Keep my changes for explicit save',exact:true}).click();await page.getByRole('button',{name:'Save note',exact:true}).click();await expect(page.locator('#collection-item-archive-item-0')).toContainText('My new wording');
 const snapshot=await dataSnapshot(page);expect((snapshot.collectionItems as Array<{id:string;revision:number}>).find(item=>item.id==='archive-item-0')?.revision).toBe(3);
 await page.getByRole('button',{name:'Delete collection',exact:true}).click();await page.getByRole('button',{name:'Keep it',exact:true}).click();expect(await dataSnapshot(page)).toEqual(snapshot);
});
test('cross-chapter saved passages retain their complete context while reading',async({page})=>{
 await openRoute(page,'/bible/JHN/3?translation=BSB&start=JHN.3.35&end=JHN.4.3&verse=35&return=%2Fbible%2Fsaved%3Fview%3Dnotes');await expect(page.getByLabel('Saved passage context')).toContainText('John 3:35–4:3');await page.getByRole('link',{name:'Continue saved passage →',exact:true}).click();await expect(page).toHaveURL(/#\/bible\/JHN\/4/);await expect(page).toHaveURL(/start=JHN.3.35&end=JHN.4.3/);await expect(page.getByRole('button',{name:'Select John 4:3',exact:true})).toHaveAttribute('aria-pressed','true');await page.getByRole('link',{name:'Return to devotional context'}).click();await expect(page).toHaveURL(/#\/bible\/saved\?view=notes$/);
});
test('failed optional Scripture search retries without changing private records',async({page})=>{
 await seedArchive(page);const before=await dataSnapshot(page);await page.route('**/bible/search-index.json',route=>route.abort());await openRoute(page,'/search?q=grace');await expect(page.getByRole('alert')).toContainText('personal results remain available');await page.getByRole('button',{name:'Saved Scripture',exact:true}).click();await expect(page.getByRole('alert')).toContainText('personal results remain available');await expect(page.locator('.search-hit')).not.toHaveCount(0);await page.unroute('**/bible/search-index.json');await page.getByRole('button',{name:'Retry Scripture search',exact:true}).click();await expect(page.getByRole('alert')).toHaveCount(0);await page.getByRole('button',{name:'All',exact:true}).click();await expect(page.getByRole('heading',{name:'Scripture',exact:true})).toBeVisible();expect(await dataSnapshot(page)).toEqual(before);
});
test('removed collection notes keep copyable writing and cannot be recreated',async({page})=>{
 await seedArchive(page);await openRoute(page,'/bible/collections?collection=archive-collection');await page.locator('#collection-note-archive-item-0').click();await page.getByLabel('Passage note').fill('Keep this unsaved writing');
 await page.evaluate(async()=>{const database=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('my-daily-devotion');r.onsuccess=()=>resolve(r.result);});const tx=database.transaction('collectionItems','readwrite'),store=tx.objectStore('collectionItems'),r=store.get('archive-item-0');r.onsuccess=()=>store.put({...r.result,deletedAt:'2026-04-24T08:00:00.000Z',revision:2});await new Promise<void>(resolve=>{tx.oncomplete=()=>resolve();});database.close();window.dispatchEvent(new Event('focus'));});
 await expect(page.getByLabel('Passage note')).toHaveValue('Keep this unsaved writing');await expect(page.getByRole('button',{name:'Save note',exact:true})).toBeDisabled();await expect(page.getByText(/Saving cannot recreate it/)).toBeVisible();
});
