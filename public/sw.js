const CACHE_NAME = "mdd-app-v1.3.0";
const CACHE_PREFIX = "mdd-app-v";
const BUILD_ID = "development";
const CACHE_KEY = `${CACHE_NAME}-${BUILD_ID}`;

function scopeRoot() { return new URL("./", self.registration.scope); }
function localUrl(path) { return new URL(path.replace(/^\//, ""), scopeRoot()).href; }
function validateRequiredAsset(url, response) {
  const root = scopeRoot();
  const parsed = new URL(url, root);
  if (parsed.origin !== root.origin || !parsed.pathname.startsWith(root.pathname)) throw new Error("Required offline asset escapes the app scope.");
  if (!response.ok) throw new Error(`Required offline asset failed: ${response.status} ${url}`);
  const type = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if ((parsed.href === root.href || parsed.pathname.endsWith("/index.html")) && type !== "text/html") throw new Error("Offline app shell is not HTML.");
  if (parsed.pathname.endsWith(".js") && !/(?:javascript|ecmascript)/.test(type)) throw new Error("Offline JavaScript asset has an unexpected content type.");
  if (parsed.pathname.endsWith(".css") && type !== "text/css") throw new Error("Offline stylesheet has an unexpected content type.");
  if (parsed.pathname.endsWith(".json") && !/\bjson\b/.test(type)) throw new Error("Offline JSON asset has an unexpected content type.");
  if (parsed.pathname.endsWith(".webmanifest") && !/(?:json|manifest)/.test(type)) throw new Error("Offline manifest has an unexpected content type.");
  if (parsed.pathname.endsWith(".svg") && type !== "image/svg+xml") throw new Error("Offline SVG asset has an unexpected content type.");
  if (parsed.pathname.endsWith(".png") && type !== "image/png") throw new Error("Offline PNG asset has an unexpected content type.");
  if (parsed.pathname.endsWith(".webp") && type !== "image/webp") throw new Error("Offline WebP asset has an unexpected content type.");
  if (/\.jpe?g$/.test(parsed.pathname) && type !== "image/jpeg") throw new Error("Offline JPEG asset has an unexpected content type.");
  if (/\.woff2?$/.test(parsed.pathname) && !/^font\/woff2?$/.test(type)) throw new Error("Offline font asset has an unexpected content type.");
}
async function fetchRequired(url) {
  const root = scopeRoot();
  const target = new URL(url, root);
  if (target.origin !== root.origin || !target.pathname.startsWith(root.pathname)) throw new Error("Required offline asset escapes the app scope.");
  const response = await fetch(target.href, { cache: "reload", credentials: "same-origin" });
  validateRequiredAsset(target.href, response);
  return response;
}
async function cacheRequired(cache, url) { const response = await fetchRequired(url); await cache.put(url, response.clone()); return response; }
async function cacheInBatches(cache, urls, size = 8) { for (let index = 0; index < urls.length; index += size) { const batch = urls.slice(index, index + size); await Promise.all(batch.map((url) => cacheRequired(cache, url))); } }
async function matchCached(request) { const cache = await caches.open(CACHE_KEY); return cache.match(request, { ignoreVary: true }); }

async function precache() {
  const cache = await caches.open(CACHE_KEY);
  const root = scopeRoot();
  const rootUrl = root.href;
  const htmlResponse = await cacheRequired(cache, rootUrl);
  const html = await htmlResponse.text();
  const shellAssets = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => match[1])
    .filter((value) => value && !value.startsWith("data:") && !value.startsWith("http:"))
    .map((value) => new URL(value, root).href)
    .filter((value) => { const parsed = new URL(value); return parsed.origin === root.origin && parsed.pathname.startsWith(root.pathname); });
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

async function cleanupUnusedCaches(event) {
  // The active worker must never remove an installing or deliberately waiting update.
  if (self.registration.installing || self.registration.waiting) return;
  // Other tabs may still be running the previous shell and need its lazy chunks.
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  if (clients.some((client) => client.id !== event.clientId && client.id !== event.resultingClientId)) return;
  const names = await caches.keys();
  if (self.registration.installing || self.registration.waiting) return;
  await Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_KEY).map((name) => caches.delete(name)));
}
self.addEventListener("install", (event) => { event.waitUntil(precache().catch(async (error) => { await caches.delete(CACHE_KEY); throw error; })); });
self.addEventListener("activate", (event) => { event.waitUntil(self.clients.claim()); });
self.addEventListener("message", (event) => { if (event.data?.type === "SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("fetch", (event) => {
  const request = event.request; if (request.method !== "GET") return; const url = new URL(request.url); if (url.origin !== self.location.origin) return; if (url.pathname.endsWith("/sw.js")) return;
  if (request.mode === "navigate") { event.respondWith((async () => { const cached = await matchCached(scopeRoot().href); return cached ?? fetch(request); })()); event.waitUntil(cleanupUnusedCaches(event)); return; }
  event.respondWith((async () => { const cached = await matchCached(request); if (cached) return cached; if (url.pathname.includes("/assets/")) { const previous = await caches.match(request, { ignoreVary: true }); if (previous) return previous; } try { return await fetch(request); } catch { return Response.error(); } })());
});
