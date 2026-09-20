import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useUnsavedChanges } from "../app/useUnsavedChanges";
import { useDraftGuard } from "../app/useDraftGuard";
import { useMutation } from "../app/useMutation";
import { ConflictReview } from "../app/ConflictReview";
import { isEditConflict } from "../data/conflicts";
import { db } from "../data/database";
import { CategoryRepository } from "../data/repositories/prayer-metadata";
import type { Category } from "../domain/types";
const repository = new CategoryRepository(db);
export function CategoriesScreen() {
  const [items, setItems] = useState<Category[]>([]); const [name, setName] = useState(""); const [editing, setEditing] = useState<Category | null>(null); const [conflict, setConflict] = useState(false);
  const { busy, status, setStatus, run } = useMutation();
  const refresh = useCallback(async () => setItems(await repository.list()), []);
  useEffect(() => { void refresh().catch(() => setStatus("Could not open this list. Reload to try again.")); }, [refresh]);
  const clear = () => { setName(""); setEditing(null); setConflict(false); };
  const apply = (item: Category) => { setEditing(item); setName(item.name); setConflict(false); };
  const dirty = name !== (editing?.name ?? ""); useUnsavedChanges(dirty);
  const save = async () => {
    try { if (editing) await repository.updateCategory(editing.id, name, editing.revision); else await repository.createCategory(name); clear(); setStatus("Category saved locally."); await refresh().catch(() => setStatus("Category saved. Reopen this list to refresh it.")); }
    catch (reason) { setConflict(isEditConflict(reason)); throw reason; }
  };
  const { confirmDrafts, draftDialog } = useDraftGuard(dirty, save, clear);
  const edit = async (item: Category) => { if (await confirmDrafts()) { const latest = await repository.get(item.id); if (!latest) throw new Error("This category was removed in another tab."); apply(latest); } };
  const remove = async (item: Category) => { if (!await confirmDrafts() || !window.confirm(`Remove ${item.name}?`)) return; await repository.removeCategory(item.id); if (editing?.id === item.id) clear(); await refresh(); };
  return <main className="visual-screen metadata-screen mg-secondary-screen mg-prayer-metadata-workspace"><header className="screen-heading compact-heading mg-secondary-header"><p className="eyebrow">Prayer · Categories</p><h1>Categories</h1><p className="screen-intro">Keep categories flat and few. They are light organization, not a filing hierarchy.</p><Link className="quiet-back-link" to="/prayer">← Prayer</Link></header><div className="metadata-layout"><section className="metadata-list"><p className="section-kicker">Categories</p>{items.map((item) => <div className="metadata-row" key={item.id}><strong>{item.name}</strong><div><button type="button" disabled={busy} onClick={() => void run(() => edit(item))}>Rename</button><button type="button" disabled={busy} onClick={() => void run(() => remove(item))}>Remove</button></div></div>)}</section><section className="metadata-editor"><p className="section-kicker">{editing ? "Rename category" : "Add category"}</p><label><span>Name</span><input disabled={busy} value={name} onChange={(event) => setName(event.target.value)} /></label><div><button type="button" disabled={busy || !name.trim()} onClick={() => void run(save)}>{editing ? "Save name" : "Add category"}</button>{editing ? <button type="button" disabled={busy} onClick={() => void run(async () => { if (await confirmDrafts()) clear(); })}>Cancel</button> : null}</div><p className="prayer-form-status" aria-live="polite">{status}</p><ConflictReview active={conflict} draftText={name} describe={(item: Category) => item.name} loadLatest={async () => { const latest = editing && await repository.get(editing.id); if (!latest) throw new Error("This category is no longer available."); return latest; }} useLatest={apply} /></section></div>{draftDialog}</main>;
}
