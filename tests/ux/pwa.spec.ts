import { expect, test } from "@playwright/test";
import { APP_VERSION } from "../../src/app/version";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";

test.describe("offline PWA UX", () => {
  test("a controlled cold start can read Scripture and search while fully offline", async ({ context, page }, testInfo) => {
    test.setTimeout(120_000);
    await page.goto("/#/bible/JHN/3");
    await expect(page.getByRole("heading", { level: 2, name: "John 3" })).toBeVisible();
    await page.waitForFunction(async () => {
      if (!("serviceWorker" in navigator)) return false;
      const registration = await navigator.serviceWorker.ready;
      return Boolean(registration.active);
    }, undefined, { timeout: 90_000 });

    await page.reload();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), undefined, { timeout: 20_000 });
    const missingBuildAssets = await page.evaluate(async () => {
      const manifestUrl = new URL(".vite/manifest.json", location.origin + location.pathname).href;
      const manifest = await fetch(manifestUrl).then((response) => response.json()) as Record<string, { file: string; css?: string[]; assets?: string[] }>;
      const files = [...new Set(Object.values(manifest).flatMap((entry) => [entry.file, ...(entry.css ?? []), ...(entry.assets ?? [])]).filter(Boolean))];
      const missing: string[] = [];
      for (const file of files) {
        const url = new URL(file, location.origin + location.pathname).href;
        if (!(await caches.match(url, { ignoreVary: true }))) missing.push(file);
      }
      return missing;
    });
    expect(missingBuildAssets, "Every generated lazy-route asset must be available in Cache Storage before offline use").toEqual([]);

    await page.close();
    await context.setOffline(true);
    const coldPage = await context.newPage();
    const pageErrors: string[] = [];
    coldPage.on("pageerror", (error) => pageErrors.push(error.message));
    await coldPage.goto("/#/bible/JHN/3", { waitUntil: "domcontentloaded" });
    await expect(coldPage.getByRole("heading", { level: 1, name: "Bible" })).toBeVisible();
    await expect(coldPage.getByRole("heading", { level: 2, name: "John 3" })).toBeVisible();
    await expect(coldPage.getByRole("button", { name: "Select John 3:16" })).toBeVisible();

    await coldPage.getByRole("link", { name: "Search", exact: true }).click();
    await expect(coldPage.getByRole("heading", { level: 1, name: "Search" })).toBeVisible();
    await coldPage.getByLabel("Search MDD").fill("John 3:16");
    await coldPage.getByRole("button", { name: "Search", exact: true }).click();
    await expect(coldPage.getByText("John 3:16", { exact: true }).first()).toBeVisible();
    await expect(coldPage.locator(".platform-status")).toContainText(/Offline|offline/i);
    await coldPage.goto("/#/prayer/new");
    await coldPage.getByLabel("What do you want to pray about?").fill("A request saved while completely offline.");
    await coldPage.getByRole("button", { name: "Save prayer", exact: true }).click();
    await coldPage.getByRole("button", { name: "Prayed now", exact: true }).click();
    await expect(coldPage.getByText("Prayed now recorded.")).toBeVisible();
    await coldPage.goto("/#/history/moments");
    await expect(coldPage.getByText("A request saved while completely offline.")).toBeVisible();
    await coldPage.reload(); await expect(coldPage.getByText("A request saved while completely offline.")).toBeVisible();
    for (const theme of ["Light", "Dark"]) {
      await coldPage.getByRole("button", { name: `${theme} theme` }).click();
      for (const [name, route, heading] of [["today", "/today", "Good morning, Friend."], ["bible", "/bible/JHN/3", "Bible"], ["search", "/search?q=John+3%3A16", "Search"], ["prayer", "/prayer", "Prayer"], ["history", "/history", "History"]]) {
        await coldPage.goto(`/#${route}`); await expect(coldPage.getByRole("heading", { name: heading!, exact: true, level: 1 })).toBeVisible();
        if (name === "bible") await expect(coldPage.locator(".scripture-copy")).toBeVisible();
        if (name === "today") {
          await expect(coldPage.locator(".grace-art img")).toBeVisible();
          expect(await coldPage.locator(".grace-art img").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
          await expect(coldPage.locator(".today-verse blockquote")).toBeVisible();
        }
        if (name === "search") await expect(coldPage.locator(".search-hit").first()).toBeVisible();
        await coldPage.screenshot({ path: testInfo.outputPath(`offline-${theme}-${name}.png`) });
      }
    }
    expect(pageErrors).toEqual([]);
  });

  test("interrupted updates preserve the working subpath app and old tabs retain lazy assets", async ({ browser }) => {
    test.setTimeout(120_000);
    let generation = "old";
    const root = resolve("dist");
    const server = createServer(async (request, response) => {
      const requestGeneration = generation;
      const path = new URL(request.url!, "http://localhost").pathname.replace(/^\/devotion\//, "");
      // A failed build stays failed even if an automatic update overlaps the next deployment.
      if (request.headers["x-mdd-test-build"] === "broken" && path === "bible/books/GEN.json") { response.writeHead(503); response.end("Interrupted deployment"); return; }
      if (path === "assets/old-only.js") { response.writeHead(generation === "old" ? 200 : 404, { "Content-Type": "text/javascript" }); response.end("old tab lazy asset"); return; }
      const file = resolve(root, path || "index.html");
      if (!file.startsWith(root)) { response.writeHead(400); response.end(); return; }
      try {
        let bytes = await readFile(file);
        if (path === "sw.js") bytes = Buffer.from(bytes.toString()
          .replace(/const BUILD_ID = "[^"]+"/, `const BUILD_ID = "fixture-${requestGeneration}"`)
          .replace('fetch(url, { cache:', `fetch(url, { headers: { "X-Mdd-Test-Build": "${requestGeneration}" }, cache:`));
        if (path === ".vite/manifest.json" && requestGeneration === "old") { const manifest = JSON.parse(bytes.toString()); manifest.oldTab = { file: "assets/old-only.js" }; bytes = Buffer.from(JSON.stringify(manifest)); }
        const types: Record<string,string> = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".webmanifest":"application/manifest+json", ".svg":"image/svg+xml", ".png":"image/png" };
        response.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); response.end(bytes);
      } catch { response.writeHead(404); response.end(); }
    });
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    const port = (server.address() as { port: number }).port;
    const base = `http://127.0.0.1:${port}/devotion/`;
    const context = await browser.newContext({ serviceWorkers: "allow" });
    try {
      const page = await context.newPage(); await page.goto(base+"#/today");
      await page.waitForFunction(async () => Boolean((await navigator.serviceWorker.ready).active));
      await page.reload(); await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
      const oldTab = await context.newPage(); await oldTab.goto(base+"#/bible/JHN/3"); await expect(oldTab.getByRole("heading", { name: "John 3", exact: true })).toBeVisible();
      generation = "broken";
      await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.ready;
        await new Promise<void>((done, reject) => {
          const watchInstalling = () => {
            const worker = registration.installing; if (!worker) return;
            const checkState = () => {
              if (worker.state === "redundant") { registration.removeEventListener("updatefound", watchInstalling); done(); }
              if (worker.state === "installed") reject(new Error("The interrupted build unexpectedly installed"));
            };
            worker.addEventListener("statechange", checkState); checkState();
          };
          registration.addEventListener("updatefound", watchInstalling);
          watchInstalling(); void registration.update().catch(reject);
        });
      });
      await expect.poll(() => page.evaluate(() => caches.keys())).toEqual([`mdd-app-v${APP_VERSION}-fixture-old`]);
      await context.setOffline(true); await page.reload(); await expect(page.getByRole("heading", { name: "Good morning, Friend.", exact: true })).toBeVisible();
      // Publish the complete generation before the online event automatically checks for updates.
      generation = "new";
      await context.setOffline(false);
      await page.evaluate(async () => { await (await navigator.serviceWorker.ready).update(); });
      await page.waitForFunction(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting));
      await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reload to update" }).click()]);
      await expect(page.getByRole("heading", { name: "Good morning, Friend.", exact: true })).toBeVisible();
      expect(await oldTab.evaluate(async () => (await fetch("./assets/old-only.js")).text())).toBe("old tab lazy asset");
      await oldTab.close(); await page.reload();
      await expect.poll(() => page.evaluate(() => caches.keys())).toEqual([`mdd-app-v${APP_VERSION}-fixture-new`]);
      await context.setOffline(true); await page.goto(base+"#/search?q=John+3%3A16"); await expect(page.locator(".search-hit").first()).toContainText("John 3:16");
    } finally { await context.close(); await new Promise<void>((done) => server.close(() => done())); }
  });
});
