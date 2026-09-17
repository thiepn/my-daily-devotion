const CACHE_NAME = "mdd-app-v1.0.0";
const CACHE_PREFIX = "mdd-app-v";

function scopeRoot() { return new URL("./", self.registration.scope); }
function localUrl(path) { return new URL(path.replace(/^\//, ""), scopeRoot()).href; }
async function fetchRequired(url) { const response = await fetch(url, { cache: "reload", credentials: "same-origin" }); if (!response.ok) throw new Error(`Required offline asset failed: ${response.status} ${url}`); return response; }
async function cacheRequired(cache, url) { const response = await fetchRequired(url); await cache.put(url, response.clone()); return response; }
async function cacheInBatches(cache, urls, size = 8) { for (let index = 0; index < urls.length; index += size) { const batch = urls.slice(index, index + size); await Promise.all(batch.map((url) => cacheRequired(cache, url))); } }
async function matchCached(request) { return caches.match(request, { ignoreVary: true }); }

async function precache() {
  const cache = await caches.open(CACHE_NAME);
  const root = scopeRoot();
  const rootUrl = root.href;
  const htmlResponse = await cacheRequired(cache, rootUrl);
  const html = await htmlResponse.text();
  const shellAssets = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => match[1])
    .filter((value) => value && !value.startsWith("data:") && !value.startsWith("http:"))
    .map((value) => new URL(value, root).href)
    .filter((value) => value.startsWith(root.origin));
  const coreAssets = [localUrl("manifest.webmanifest"), localUrl("brand-mark.svg"), localUrl("icons/icon-192.png"), localUrl("icons/icon-512.png"), localUrl("icons/maskable-512.png"), localUrl("apple-touch-icon.png"), localUrl("plans/mcheyne-classic.v1.json")];
  await cacheInBatches(cache, [...new Set([...shellAssets, ...coreAssets])]);

  const buildManifestUrl = localUrl(".vite/manifest.json");
  const buildManifestResponse = await cacheRequired(cache, buildManifestUrl);
  const buildManifest = await buildManifestResponse.json();
  const buildAssets = Object.values(buildManifest).flatMap((entry) => [entry.file, ...(entry.css ?? []), ...(entry.assets ?? [])]).filter(Boolean).map(localUrl);
  await cacheInBatches(cache, [...new Set(buildAssets)]);

  const manifestUrl = localUrl("bible/manifest.json");
  const bibleManifestResponse = await cacheRequired(cache, manifestUrl);
  const bibleManifest = await bibleManifestResponse.json();
  const scriptureAssets = [localUrl(bibleManifest.searchIndexPath), ...bibleManifest.books.map((book) => localUrl(book.path))];
  await cacheInBatches(cache, scriptureAssets);
}

self.addEventListener("install", (event) => { event.waitUntil(precache()); });
self.addEventListener("activate", (event) => { event.waitUntil((async () => { const names = await caches.keys(); await Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map((name) => caches.delete(name))); await self.clients.claim(); })()); });
self.addEventListener("message", (event) => { if (event.data?.type === "SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("fetch", (event) => {
  const request = event.request; if (request.method !== "GET") return; const url = new URL(request.url); if (url.origin !== self.location.origin) return; if (url.pathname.endsWith("/sw.js")) return;
  if (request.mode === "navigate") { event.respondWith((async () => { try { const response = await fetch(request); if (response.ok) { const cache = await caches.open(CACHE_NAME); await cache.put(scopeRoot().href, response.clone()); } return response; } catch { const cached = await matchCached(scopeRoot().href); return cached ?? Response.error(); } })()); return; }
  event.respondWith((async () => { const cached = await matchCached(request); if (cached) return cached; try { const response = await fetch(request); if (response.ok && response.type === "basic") { const cache = await caches.open(CACHE_NAME); await cache.put(request, response.clone()); } return response; } catch { return Response.error(); } })());
});
