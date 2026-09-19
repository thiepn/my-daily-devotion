import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useUnsavedChanges } from "../app/useUnsavedChanges";
import { useDraftGuard } from "../app/useDraftGuard";
import { useMutation } from "../app/useMutation";
import { ConflictReview } from "../app/ConflictReview";
import { isEditConflict } from "../data/conflicts";
import { db } from "../data/database";
import { CollectionRepository } from "../data/repositories/collections";
import type { Collection, CollectionItem, ScriptureReference } from "../domain/types";
import { parsePendingScripture } from "../reflection/context";
import { loadBibleManifest } from "./loader";
import { parseVerseKey } from "./repository";
import type { BibleManifest } from "./types";

const repository = new CollectionRepository(db);
function label(reference: ScriptureReference, manifest: BibleManifest | null) {
  const start = parseVerseKey(reference.startVerseKey), end = parseVerseKey(reference.endVerseKey);
  const name = manifest?.books.find((b) => b.id === start.bookId)?.name ?? start.bookId;
  return start.chapter === end.chapter ? `${name} ${start.chapter}:${start.verse}${start.verse === end.verse ? "" : `–${end.verse}`}` : `${name} ${start.chapter}:${start.verse}–${end.chapter}:${end.verse}`;
}
function bibleHref(reference: ScriptureReference) { const start = parseVerseKey(reference.startVerseKey); return `/bible/${start.bookId}/${start.chapter}?verse=${start.verse}`; }

export function CollectionsScreen() {
  const [params, setParams] = useSearchParams();
  const pending = useMemo(() => parsePendingScripture(params), [params]); const returnTo = params.get("return"); const selectedId = params.get("collection");
  const [rename, setRename] = useState<string | null>(null); const [renameBase, setRenameBase] = useState<Collection | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]); const [items, setItems] = useState<CollectionItem[]>([]);
  const [manifest, setManifest] = useState<BibleManifest | null>(null); const [name, setName] = useState(""); const [conflict, setConflict] = useState(false);
  const { busy, status, setStatus, run } = useMutation();
  const selected = collections.find((item) => item.id === selectedId) ?? collections[0] ?? null;
  const refresh = async () => { const next = await repository.list(); const active = next.find((item) => item.id === selectedId) ?? next[0]; const nextItems = active ? await repository.listItems(active.id) : []; setCollections(next); setItems(nextItems); };
  useEffect(() => {
    let cancelled = false;
    void Promise.all([repository.list(), loadBibleManifest()]).then(async ([next, nextManifest]) => {
      const active = next.find((item) => item.id === selectedId) ?? next[0]; const nextItems = active ? await repository.listItems(active.id) : [];
      if (!cancelled) { setCollections(next); setManifest(nextManifest); setItems(nextItems); }
    }).catch((error: unknown) => { if (!cancelled) setStatus(error instanceof Error ? error.message : "Could not open collections."); });
    return () => { cancelled = true; };
  }, [selectedId]);
  const renameDirty = rename !== null && rename !== renameBase?.name;
  const dirty = Boolean(name) || renameDirty;
  const allowNavigation = useUnsavedChanges(dirty);
  const clearRename = () => { setRename(null); setRenameBase(null); setConflict(false); };
  const saveRename = async () => {
    if (rename === null || !renameBase) return;
    try { await repository.rename(renameBase.id, rename, renameBase.description, renameBase.revision); clearRename(); await refresh(); }
    catch (reason) { setConflict(isEditConflict(reason)); throw reason; }
  };
  const saveDrafts = async () => { if (name.trim()) { await repository.create(name); setName(""); } if (renameDirty) await saveRename(); await refresh(); };
  const { confirmDrafts, draftDialog } = useDraftGuard(dirty, saveDrafts, () => { setName(""); clearRename(); });
  const choose = async (id: string) => { if (!await confirmDrafts()) return; clearRename(); allowNavigation(); const next = new URLSearchParams(params); next.set("collection", id); setParams(next); };
  const create = (event: FormEvent) => { event.preventDefault(); void run(async () => { const created = await repository.create(name); setName(""); setStatus("Collection ready."); if (!renameDirty) { clearRename(); allowNavigation(); const next = new URLSearchParams(params); next.set("collection", created.id); setParams(next); } await refresh(); }); };
  const addPending = async (id: string) => { if (!pending) return; await repository.addReference(id, pending); setStatus("Passage added to collection."); if (id === selected?.id) setItems(await repository.listItems(id)); };
  return <main className="visual-screen collections-screen mg-secondary-screen mg-collections-workspace"><header className="screen-heading compact-heading mg-secondary-header"><p className="eyebrow">Bible · Saved</p><h1>Collections</h1><p className="screen-intro">Keep meaningful passages together.</p><div className="quiet-link-row"><Link to="/bible">← Bible</Link><Link to="/search">Search</Link>{returnTo?.startsWith("/") && !returnTo.startsWith("//") ? <Link to={returnTo}>Back to passage</Link> : null}</div></header>
    {pending ? <section className="collection-pending"><p className="section-kicker">Selected passage</p><strong>{label(pending, manifest)}</strong><span>Choose a collection below.</span></section> : null}
    <div className="collections-layout"><aside className="collection-sidebar"><form onSubmit={create}><label htmlFor="collection-name">New collection</label><div><input id="collection-name" disabled={busy} value={name} onChange={(e) => setName(e.target.value)} placeholder="Mission, Promises, Wisdom…" /><button type="submit" disabled={busy || !name.trim()}>Add</button></div></form><nav aria-label="Scripture collections">{collections.map((collection) => <div className="collection-nav-row" key={collection.id}><button disabled={busy} className={selected?.id === collection.id ? "is-active" : ""} type="button" onClick={() => void run(() => choose(collection.id))}><span>{collection.name}</span></button>{pending ? <button disabled={busy} className="collection-add-here" type="button" aria-label={`Add selected passage to ${collection.name}`} onClick={() => void run(() => addPending(collection.id))}>Add here</button> : null}</div>)}</nav></aside>
      <section className="collection-content">{selected ? <><div className="section-heading-line"><div><p className="section-kicker">Collection</p><h2>{selected.name}</h2><div className="collection-manage"><button disabled={busy} className="quiet-button" type="button" onClick={() => { if (rename !== null) return; setRenameBase(selected); setRename(selected.name); }}>Rename</button><button disabled={busy} className="quiet-button danger-quiet" type="button" onClick={() => void run(async () => { if (!await confirmDrafts() || !window.confirm(`Remove ${selected.name} and its saved passages?`)) return; await repository.removeCollection(selected.id); clearRename(); allowNavigation(); const next = new URLSearchParams(params); next.delete("collection"); setParams(next); await refresh(); })}>Delete collection</button></div></div><span className="quiet-count">{items.length}</span></div>
        {rename !== null ? <form className="collection-rename" onSubmit={(event) => { event.preventDefault(); void run(saveRename); }}><label>Collection name<input disabled={busy} value={rename} onChange={(event) => setRename(event.target.value)} /></label><button disabled={busy || !rename.trim()} className="quiet-button" type="submit">Save name</button><button disabled={busy} className="quiet-button" type="button" onClick={() => void run(async () => { if (await confirmDrafts()) clearRename(); })}>Cancel</button></form> : null}
        <ConflictReview active={conflict} draftText={rename ?? ""} loadLatest={async () => { const latest = (await repository.list()).find((item) => item.id === renameBase?.id); if (!latest) throw new Error("This collection is no longer available."); return latest; }} describe={(item) => `${item.name}\n${item.description ?? ""}`} useLatest={(item) => { setRenameBase(item); setRename(item.name); setConflict(false); }} />
        {items.length ? <div className="collection-items">{items.map((item) => <article key={item.id}><Link to={bibleHref(item)}>{label(item, manifest)}</Link>{item.note ? <p>{item.note}</p> : null}<button disabled={busy} type="button" aria-label={`Remove ${label(item, manifest)}`} onClick={() => void run(async () => { await repository.removeItem(item.id); setItems(await repository.listItems(selected.id)); })}>Remove</button></article>)}</div> : <p className="muted-copy">No passages saved here yet. Select Scripture in the reader and choose More → Add to collection.</p>}</> : <div className="prayer-empty"><h2>No collections yet.</h2><p>Create one when you have passages that belong together.</p></div>}</section>
    </div><p className="prayer-form-status" aria-live="polite">{status}</p>{draftDialog}</main>;
}
