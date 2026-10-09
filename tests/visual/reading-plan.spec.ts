import {expect,test} from '@playwright/test';
import {openRoute,enrollCalendarPlan} from '../ux/helpers';
test.beforeEach(async({page})=>{await page.clock.setFixedTime(new Date('2026-04-24T07:00:00+02:00'));await page.emulateMedia({reducedMotion:'reduce'});});
for(const surface of ['plan','welcome'] as const)for(const [width,height] of [[320,568],[360,800],[390,844],[430,932],[768,1024],[1440,900]])test(`Reading journal ${surface} ${width}`,async({page})=>{
 await page.setViewportSize({width:width!,height:height!});if(surface==='plan')await enrollCalendarPlan(page);await openRoute(page,surface==='plan'?'/today/plan':'/welcome');await expect(page.locator(surface==='plan'?'.plan-current':'.welcome-paths')).toBeVisible();await page.evaluate(()=>document.fonts.ready);await expect(page).toHaveScreenshot(`reading-${surface}-${width}.png`,{fullPage:surface==='welcome'});
});
for(const state of ['dark','text200','setup','details','self-paced','failure'] as const)test(`Reading plan ${state}`,async({page})=>{
 await page.setViewportSize({width:state==='text200'?320:390,height:844});if(state==='dark')await page.emulateMedia({colorScheme:'dark'});
 if(state==='failure')await page.route('**/plans/mcheyne-classic.v1.json',route=>route.abort());
 if(!['setup','failure','self-paced'].includes(state))await enrollCalendarPlan(page);await openRoute(page,'/today/plan');
 if(state==='self-paced'){await page.getByRole('button',{name:'Start self-paced at Day 1'}).click();await expect(page.locator('.plan-current')).toContainText('Day 1');}
 if(state==='failure')await expect(page.getByRole('alert')).toBeVisible();else if(state==='setup')await expect(page.locator('.plan-setup')).toBeVisible();else await expect(page.locator('.plan-current')).toBeVisible();
 if(state==='details'){await page.locator('.plan-explanations>summary').click();await page.locator('.plan-explanations').scrollIntoViewIfNeeded();}
 if(state==='text200')await page.evaluate(()=>document.documentElement.style.fontSize='200%');await page.evaluate(()=>document.fonts.ready);await expect(page).toHaveScreenshot(`reading-plan-${state}.png`,{fullPage:state==='setup'});
});
for(const state of ['dark','text200','name','saved'] as const)test(`Introduction ${state}`,async({page})=>{
 await page.setViewportSize({width:state==='text200'?320:390,height:844});if(state==='dark')await page.emulateMedia({colorScheme:'dark'});await openRoute(page,'/welcome');await expect(page.locator('.welcome-paths')).toBeVisible();if(['name','saved'].includes(state))await page.getByLabel('Preferred name (optional)').fill('Anna Marie');if(state==='saved'){await page.getByRole('button',{name:'Save greeting'}).click();await expect(page.getByRole('status')).toContainText('Greeting saved locally');}if(state==='text200')await page.evaluate(()=>document.documentElement.style.fontSize='200%');await page.evaluate(()=>document.fonts.ready);await expect(page).toHaveScreenshot(`reading-welcome-${state}.png`,{fullPage:true});
});
for(const state of ['evening','long-name'] as const)test(`Today personalized ${state}`,async({page})=>{
 await page.setViewportSize({width:state==='long-name'?320:390,height:844});await enrollCalendarPlan(page);await openRoute(page,'/welcome');await page.getByLabel('Preferred name (optional)').fill(state==='long-name'?'Alexandria Catherine Elizabeth Margaret Alexandra Grace':'Anna');await page.getByRole('button',{name:'Save greeting'}).click();await expect(page.getByRole('status')).toContainText('Greeting saved locally');if(state==='evening')await page.clock.setFixedTime(new Date('2026-04-24T19:00:00+02:00'));await openRoute(page,'/today');await expect(page.getByRole('heading',{level:1,name:state==='long-name'?'Good morning, Alexandria Catherine Elizabeth Margaret Alexandra Grace.':'Good evening, Anna.'})).toBeVisible();await expect(page.locator('.today-verse blockquote')).toBeVisible();await page.evaluate(()=>document.fonts.ready);await expect(page).toHaveScreenshot(`reading-today-${state}.png`);
});

