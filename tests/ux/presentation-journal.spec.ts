import {expect,test} from '@playwright/test';
import {openRoute,enrollCalendarPlan,expectNoAxeViolations,expectNoHorizontalOverflow} from './helpers';
import {dataSnapshot} from './data-fixture';
import {seedHistoryJournal} from './history-fixture';

test.beforeEach(async({page})=>{await page.clock.setFixedTime(new Date('2026-04-24T07:00:00+02:00'));});
test('system artwork changes with the OS without writing journal records',async({page})=>{
  await page.emulateMedia({colorScheme:'light'});await openRoute(page,'/bible/LUK/9');
  const art=page.locator('.mg-bible-chapter-art img');await expect(art).toHaveAttribute('src',/bible-context/);
  const before=await dataSnapshot(page);await page.emulateMedia({colorScheme:'dark'});
  await expect(art).toHaveAttribute('src',/evening-context/);await expect.poll(()=>art.evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth===1200)).toBe(true);
  await page.emulateMedia({colorScheme:'light'});await expect(art).toHaveAttribute('src',/bible-context/);
  const after=await dataSnapshot(page);for(const table of ['activityEvents','readingProgress','prayers','reflections'])expect(after[table]).toEqual(before[table]);
});
test('explicit appearance overrides the OS and survives context round trips',async({page})=>{
  await page.emulateMedia({colorScheme:'dark'});await openRoute(page,'/data?return=%2Fbible%2FLUK%2F9&section=appearance');
  await page.locator('.mobile-appearance-panel').getByRole('button',{name:'Light theme',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await openRoute(page,'/bible/LUK/9');await expect(page.locator('.mg-bible-chapter-art img')).toHaveAttribute('src',/bible-context/);
  await openRoute(page,'/data?section=appearance');await page.locator('.mobile-appearance-panel').getByRole('button',{name:'Dark theme',exact:true}).click();
  await page.emulateMedia({colorScheme:'light'});await openRoute(page,'/bible/LUK/9');await expect(page.locator('.mg-bible-chapter-art img')).toHaveAttribute('src',/evening-context/);
  await openRoute(page,'/data?section=appearance');await page.locator('.mobile-appearance-panel').getByRole('button',{name:'System theme',exact:true}).click();
  await openRoute(page,'/bible/LUK/9');await expect(page.locator('.mg-bible-chapter-art img')).toHaveAttribute('src',/bible-context/);
  const snapshot=await dataSnapshot(page);expect(snapshot.activityEvents).toHaveLength(0);expect(snapshot.prayers).toHaveLength(0);
});
test('evening canonical screens retain art, readable contrast and enlarged-text reflow',async({page})=>{
  test.setTimeout(90000);await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});await page.setViewportSize({width:320,height:844});
  await enrollCalendarPlan(page);await seedHistoryJournal(page);
  for(const route of ['/today','/bible/LUK/9','/prayer','/history']) {
    await openRoute(page,route);await page.evaluate(()=>document.documentElement.style.fontSize='200%');
    await expectNoHorizontalOverflow(page);await expectNoAxeViolations(page);
    const art=page.locator('.grace-art').first();await expect(art).toBeVisible();expect((await art.boundingBox())!.height).toBeGreaterThan(20);
    await page.evaluate(()=>document.documentElement.style.fontSize='');
  }
});
test('shared journal controls retain keyboard focus and reduced-motion behavior',async({page})=>{
  await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});await openRoute(page,'/data?section=backups');
  const button=page.getByRole('button',{name:'Create encrypted backup',exact:true});await button.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');await expect(button).toBeFocused();
  expect(await button.evaluate(el=>getComputedStyle(el).outlineStyle)).not.toBe('none');await page.keyboard.press('Enter');
  await expect(page.getByLabel('Encrypted backup password',{exact:true})).toBeVisible();await expectNoAxeViolations(page);
  await page.getByLabel('Encrypted backup password',{exact:true}).fill('fourteen letters');await page.getByLabel('Confirm password',{exact:true}).fill('different letters');
  const before=await dataSnapshot(page);await page.getByRole('button',{name:'Download encrypted backup',exact:true}).click();await expect(page.getByRole('alert')).toContainText('match');expect(await dataSnapshot(page)).toEqual(before);await expectNoHorizontalOverflow(page);
});
test('warm reader navigation reports timings without manufacturing activity',async({page},info)=>{
  await openRoute(page,'/bible/LUK/9');await expect(page.locator('.scripture-copy')).toBeVisible();await page.evaluate(()=>document.fonts.ready);
  const before=await dataSnapshot(page),samples:number[]=[];
  for(const chapter of [10,11,12,9,10]){
    const elapsed=await page.evaluate(async chapter=>{
      const start=performance.now();const finished=new Promise<number>((resolve,reject)=>{
        const timeout=setTimeout(()=>{observer.disconnect();reject(new Error('Reader navigation did not settle'));},8000);
        const check=()=>{const heading=document.querySelector('.reader-heading h2');if(heading?.textContent===`Luke ${chapter}`&&document.querySelector('.scripture-copy')){clearTimeout(timeout);observer.disconnect();resolve(performance.now()-start)}};
        const observer=new MutationObserver(check);observer.observe(document.body,{childList:true,subtree:true});
      });window.location.hash=`/bible/LUK/${chapter}`;return finished;
    },chapter);samples.push(elapsed);
  }
  await info.attach('warm-reader-navigation',{body:JSON.stringify({viewport:page.viewportSize(),engine:info.project.name,samplesMs:samples,meanMs:samples.reduce((a,b)=>a+b,0)/samples.length,targetMs:200,environment:'browser-local loopback; timings include route rendering, not a physical-device certification'}),contentType:'application/json'});
  expect(await dataSnapshot(page)).toEqual(before);
});
