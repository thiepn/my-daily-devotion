import { expect, test } from "@playwright/test";
import { seedMetadata, selectMetadata, editMetadata } from "../ux/metadata-fixture";
import { openRoute } from "../ux/helpers";
test.beforeEach(async ({page}) => { await page.clock.setFixedTime(new Date("2026-04-24T07:00:00+02:00")); });
for (const kind of ["people","categories"] as const) {
  for (const [width,height] of [[320,568],[360,800],[390,844],[430,932],[768,1024],[1440,900]]) test(kind + " journal " + width, async ({page}) => {
    await page.setViewportSize({width,height}); await seedMetadata(page,kind);
    await page.mouse.move(0,0); await expect(page).toHaveScreenshot("metadata-"+kind+"-"+width+".png",{fullPage:true});
  });
  for (const state of ["dark","text200","empty","expanded","editor","confirmation","error","long","no-results"]) test(kind+" "+state,async({page})=>{
    await page.setViewportSize({width:390,height:844});
    if(state==="dark")await page.emulateMedia({colorScheme:"dark"});
    if(state==="empty")await openRoute(page,"/prayer/"+kind); else await seedMetadata(page,kind,{long:state==="long"});
    const singular=kind==="people"?"person":"category";
    const name=kind==="people"?"Anna Wilson":"Personal";
    if(state==="text200"){await page.setViewportSize({width:320,height:844});await page.evaluate(()=>{document.documentElement.style.fontSize="200%";});}
    if(state==="expanded")await selectMetadata(page,name);
    if(state==="editor"){await editMetadata(page,name,singular);await page.getByLabel("Name",{exact:true}).fill(name+" edited");}
    if(state==="confirmation"){await selectMetadata(page,kind==="people"?"Daniel Kim":"Family");await page.getByRole("button",{name:"Remove "+singular,exact:true}).click();}
    if(state==="error"){await page.addInitScript(()=>{const cursor=IDBObjectStore.prototype.openCursor;IDBObjectStore.prototype.openCursor=function(...args){if(["people","categories"].includes(this.name))throw new Error("Read unavailable");return cursor.apply(this,args);};});await page.reload();await expect(page.getByRole("button",{name:"Retry refresh",exact:true})).toBeVisible();}
    if(state==="no-results")await page.getByLabel("Search "+kind).fill("No matching entry");
    await page.evaluate(async()=>{await document.fonts.ready;await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));if(document.activeElement?.matches(".skip-link"))(document.activeElement as HTMLElement).blur();window.scrollTo({top:0,behavior:"instant"});});await page.mouse.move(0,0);await expect(page).toHaveScreenshot("metadata-"+kind+"-"+state+".png",{fullPage:true});
  });
}
test("People conflict comparison",async({page,context})=>{
  await page.setViewportSize({width:390,height:844});await seedMetadata(page);await editMetadata(page,"Anna Wilson");await page.getByLabel("Notes",{exact:false}).fill("My local notes to keep.");
  const other=await context.newPage();await openRoute(other,"/prayer/people");await editMetadata(other,"Anna Wilson");await other.getByLabel("Notes",{exact:false}).fill("The version saved in another tab.");await other.getByRole("button",{name:"Save changes"}).click();await expect(other.locator(".directory-notes")).toContainText("another tab");
  await page.getByRole("button",{name:"Save changes"}).click();await page.getByRole("button",{name:"Compare versions"}).click();await page.evaluate(()=>window.scrollTo(0,0));await expect(page).toHaveScreenshot("metadata-people-conflict.png",{fullPage:true});
});
