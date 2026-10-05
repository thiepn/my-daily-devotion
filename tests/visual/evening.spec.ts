import {expect,test} from '@playwright/test';
import {openRoute,enrollCalendarPlan} from '../ux/helpers';
import {seedHistoryJournal} from '../ux/history-fixture';

test.beforeEach(async({page})=>{await page.clock.setFixedTime(new Date('2026-04-24T19:00:00+02:00'));await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});});
for(const surface of ['today','bible','history'] as const)for(const [width,height]of [[320,568],[360,800],[390,844],[430,932],[768,1024],[1440,900]])test(`Evening ${surface} ${width}`,async({page})=>{
  await page.setViewportSize({width,height});if(surface==='today')await enrollCalendarPlan(page);if(surface==='history')await seedHistoryJournal(page);
  await openRoute(page,surface==='bible'?'/bible/LUK/9':'/'+surface);await expect(page.locator(surface==='history'?'.grace-art--reflection img':'.grace-art img').first()).toHaveAttribute('src',/evening-/);
  await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>window.scrollTo(0,0));await expect(page).toHaveScreenshot(`evening-${surface}-${width}.png`,{fullPage:surface==='history'});
});
for(const surface of ['today','bible','history'] as const)test(`Evening ${surface} text200`,async({page})=>{
  await page.setViewportSize({width:320,height:844});if(surface==='today')await enrollCalendarPlan(page);if(surface==='history')await seedHistoryJournal(page);
  await openRoute(page,surface==='bible'?'/bible/LUK/9':'/'+surface);await page.evaluate(()=>{document.documentElement.style.fontSize='200%'});await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>window.scrollTo(0,0));
  await expect(page).toHaveScreenshot(`evening-${surface}-text200.png`,{fullPage:true});
});
