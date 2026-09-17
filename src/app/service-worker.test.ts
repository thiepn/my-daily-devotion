import { describe, expect, it } from "vitest";
import source from "../../public/sw.js?raw";

function worker(failPath = "", clients: string[] = []) {
  const stores = new Map<string, Map<string, Response>>();
  const listeners: Record<string, (event: any) => void> = {};
  const root = "https://mdd.test/app/";
  const key = "mdd-app-v1.0.0-development";
  const old = new Map([[root, new Response("old shell")], [root+"assets/old.js", new Response("old chunk")]]);
  stores.set("mdd-app-v1.0.0-previous", old);
  const caches = {
    async open(name: string) { if (!stores.has(name)) stores.set(name, new Map()); const store = stores.get(name)!; return { async put(url: string, response: Response) { store.set(url, response); }, async match(request: string | Request) { return store.get(typeof request === "string" ? request : request.url)?.clone(); } }; },
    async keys() { return [...stores.keys()]; }, async delete(name: string) { return stores.delete(name); },
    async match(request: Request) { for (const store of stores.values()) if (store.has(request.url)) return store.get(request.url)!.clone(); },
  };
  const fetches: string[] = [];
  const fetch = async (request: string | Request) => {
    const url = typeof request === "string" ? request : request.url; fetches.push(url);
    if (failPath && url.endsWith(failPath)) return new Response("failed", { status: 503 });
    if (url === root) return new Response('<script src="./assets/new.js"></script>new shell');
    if (url.endsWith(".vite/manifest.json")) return Response.json({ main: { file: "assets/new.js" }, lazy: { file: "assets/lazy.js" } });
    if (url.endsWith("bible/manifest.json")) return Response.json({ searchIndexPath: "/bible/search-index.json", books: [{ path: "/bible/books/GEN.json" }] });
    return new Response("asset");
  };
  const registration = { scope: root, installing: null as object | null, waiting: null as object | null };
  const self = { registration, location: { origin: "https://mdd.test" }, clients: { async matchAll() { return clients.map((id) => ({ id })); }, async claim() {} }, addEventListener(name: string, handler: (event: any) => void) { listeners[name] = handler; } };
  new Function("self", "caches", "fetch", "Response", "URL", source)(self, caches, fetch, Response, URL);
  const lifecycle = (name: string) => { let pending!: Promise<void>; listeners[name]!({ waitUntil(p: Promise<void>) { pending = p; } }); return pending; };
  const navigate = async (clientId: string, resultingClientId: string) => {
    let response!: Promise<Response>; let cleanup!: Promise<void>;
    listeners.fetch!({ clientId, resultingClientId, request: { method: "GET", mode: "navigate", url: root }, respondWith(p: Promise<Response>) { response = p; }, waitUntil(p: Promise<void>) { cleanup = p; } });
    await cleanup; return (await response).text();
  };
  return { stores, key, root, fetches, lifecycle, navigate, registration };
}

describe("atomic offline updates", () => {
  it("failed installation deletes only the incomplete build cache", async () => {
    const w = worker("bible/books/GEN.json");
    await expect(w.lifecycle("install")).rejects.toThrow("Required offline asset failed");
    expect(w.stores.has(w.key)).toBe(false);
    expect(await w.stores.get("mdd-app-v1.0.0-previous")!.get(w.root)!.text()).toBe("old shell");
  });
  it("caches every lazy route before activation and serves a consistent shell offline", async () => {
    const w = worker(); await w.lifecycle("install"); await w.lifecycle("activate");
    expect(w.stores.get(w.key)!.has(w.root+"assets/lazy.js")).toBe(true);
    const before = w.fetches.length;
    expect(await w.navigate("", "new-tab")).toContain("new shell"); expect(w.fetches).toHaveLength(before);
  });
  it("opening a new tab retains assets required by a previous tab", async () => {
    const w = worker("", ["old-tab"]); await w.lifecycle("install"); await w.lifecycle("activate");
    await w.navigate("", "new-tab"); expect(w.stores.has("mdd-app-v1.0.0-previous")).toBe(true);
  });
  it("reloading the last old tab safely releases the previous cache", async () => {
    const w = worker("", ["old-tab"]); await w.lifecycle("install"); await w.navigate("old-tab", "new-tab");
    expect([...w.stores.keys()]).toEqual([w.key]);
  });
  it.each(["installing", "waiting"] as const)("navigation preserves a %s update cache", async (state) => {
    const w = worker("", ["current-tab"]); await w.lifecycle("install");
    w.registration[state] = {};
    w.stores.set("mdd-app-v1.0.0-next", new Map([[w.root, new Response("next shell")]]));
    await w.navigate("current-tab", "reloaded-tab");
    expect(w.stores.has("mdd-app-v1.0.0-next")).toBe(true);
  });
});
