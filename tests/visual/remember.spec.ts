import {expect,test} from '@playwright/test';
import {seedAnniversaryHistory} from '../ux/remember-fixture';
import {openRoute} from '../ux/helpers';
test.beforeEach(async({page})=>{await page.clock.setFixedTime(new Date('2026-04-24T07:00:00+02:00'));});
for(const width of [320,360,390,430,768,1440])test(`Remember ${width}`,async({page})=>{
  await page.setViewportSize({width,height:844});await seedAnniversaryHistory(page);
  await page.evaluate(()=>localStorage.setItem('mdd-remember-choices-v1',JSON.stringify({version:1,anniversaries:true,dismissedDates:[],backupReminder:null})));
  await openRoute(page,'/history/on-this-day');await expect(page.locator('.history-journal-row')).toHaveCount(1);await page.evaluate(()=>document.fonts.ready);await expect(page).toHaveScreenshot(`remember-${width}.png`,{fullPage:true});
});
for(const state of ['dark','text200','off','choices','suggestions'])test(`Remember ${state}`,async({page})=>{
  await page.setViewportSize({width:state==='text200'?320:390,height:844});if(state==='dark')await page.emulateMedia({colorScheme:'dark'});await seedAnniversaryHistory(page);
  if(state!=='off')await page.evaluate(()=>localStorage.setItem('mdd-remember-choices-v1',JSON.stringify({version:1,anniversaries:true,dismissedDates:[],backupReminder:{next:'2026-04-24'}})));
  await openRoute(page,state==='choices'?'/data?section=privacy':state==='suggestions'?'/history':'/history/on-this-day');await page.reload();
  if(state==='text200')await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
  if(state==='suggestions')await expect(page.locator('.remember-suggestions')).toBeVisible();
  if(state!=='off'&&state!=='choices'&&state!=='suggestions')await expect(page.locator('.history-journal-row')).toHaveCount(1);
  await page.evaluate(()=>document.fonts.ready);await expect(page).toHaveScreenshot(`remember-${state}.png`,{fullPage:true});
});
