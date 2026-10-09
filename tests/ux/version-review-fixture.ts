import { expect, type Page } from "@playwright/test";
import { openRoute } from "./helpers";
export async function seedVersionReview(page: Page, count = 1) {
  await openRoute(page, "/today/reflection/2024-02-29");
  const editor = page.getByRole("textbox", { name: "Daily reflection" });
  await editor.fill("Earlier writing.\n\nGrace in ordinary days."); await page.getByRole("button", { name: "Save reflection", exact: true }).click();
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await editor.fill("Current writing.\n\nStill learning to notice."); await page.getByRole("button", { name: "Save reflection", exact: true }).click();
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  // Finish the editor's existing committed-draft acknowledgment cleanup before
  // measuring readonly recovery browsing, rather than counting that save cleanup.
  await openRoute(page, "/today");
  await expect.poll(async () => (await versionSnapshot(page)).editorDrafts?.length).toBe(0);
  await openRoute(page, "/today/reflection/2024-02-29");
  await expect(page.getByRole("textbox", { name: "Daily reflection" })).toHaveValue("Current writing.\n\nStill learning to notice.");
  return page.evaluate(async count => {
    const request = indexedDB.open("my-daily-devotion");
    return new Promise<string>((resolve,reject) => { request.onerror=()=>reject(request.error); request.onsuccess=()=>{
      const db=request.result, tx=db.transaction(["savedVersions","savedVersionContents"],"readwrite"), versions=tx.objectStore("savedVersions"), contents=tx.objectStore("savedVersionContents"), get=versions.getAll();
      let selected=""; get.onsuccess=()=>{const metadata=get.result[0]; selected=metadata.id; const content=contents.get(selected);content.onsuccess=()=>{
        for(let i=1;i<count;i++){const id=crypto.randomUUID(); versions.add({...metadata,id,targetId:id,targetKey:`reflection:${id}`});contents.add({...content.result,id});}
      };};tx.oncomplete=()=>{db.close();resolve(selected);};tx.onerror=()=>{db.close();reject(tx.error);};
    };});
  },count);
}
export async function versionSnapshot(page: Page) {
  return page.evaluate(async()=>new Promise<Record<string,unknown[]>>((resolve,reject)=>{
    const open=indexedDB.open("my-daily-devotion");open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,names=Array.from(db.objectStoreNames),tx=db.transaction(names),result:Record<string,unknown[]>={};for(const name of names){const read=tx.objectStore(name).getAll();read.onsuccess=()=>{result[name]=read.result;};}tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=()=>reject(tx.error);};
  }));
}
