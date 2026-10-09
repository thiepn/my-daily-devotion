import { expect, type Page } from "@playwright/test";
import { seedVersionReview, versionSnapshot } from "./version-review-fixture";
export { versionSnapshot as removalSnapshot } from "./version-review-fixture";
export async function seedRemoval(page:Page,count=1) {
  await seedVersionReview(page);
  await page.getByRole("button",{name:"Remove reflection",exact:true}).click();
  await page.getByRole("dialog").getByRole("button",{name:"Remove reflection",exact:true}).click();
  await expect(page.getByText("Reflection removed.",{exact:true})).toBeVisible();
  await expect.poll(async()=>(await versionSnapshot(page)).editorDrafts?.length).toBe(0);
  return page.evaluate(async count=>new Promise<string>((resolve,reject)=>{
    const open=indexedDB.open("my-daily-devotion");open.onerror=()=>reject(open.error);open.onsuccess=()=>{
      const db=open.result,tx=db.transaction(["removalGroups","removalGroupContents"],"readwrite"),groups=tx.objectStore("removalGroups"),contents=tx.objectStore("removalGroupContents"),get=groups.getAll();let id="";
      get.onsuccess=()=>{const metadata=get.result[0];id=metadata.id;const read=contents.get(id);read.onsuccess=()=>{for(let i=1;i<count;i++){const next=crypto.randomUUID();groups.add({...metadata,id:next});contents.add({...read.result,id:next});}};};
      tx.oncomplete=()=>{db.close();resolve(id);};tx.onerror=()=>{db.close();reject(tx.error);};
    };
  }),count);
}
