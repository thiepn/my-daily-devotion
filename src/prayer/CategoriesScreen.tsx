import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useUnsavedChanges } from "../app/useUnsavedChanges";
import { db } from "../data/database";
import { CategoryRepository } from "../data/repositories/prayer-metadata";
import type { Category } from "../domain/types";
const repository = new CategoryRepository(db);
export function CategoriesScreen() {
  const [items, setItems] = useState<Category[]>([]); const [name, setName] = useState(""); const [editing, setEditing] = useState<Category | null>(null); const [status, setStatus] = useState(""); const refresh = useCallback(async () => setItems(await repository.list()), []); useEffect(() => { void refresh().catch(() => setStatus("Could not open this list. Reload to try again.")); }, [refresh]);
  useUnsavedChanges(name !== (editing?.name ?? ""));
  const save = async () => { try { if (editing) await repository.updateCategory(editing.id, name); else await repository.createCategory(name); setName(""); setEditing(null); setStatus(""); await refresh(); } catch (reason) { setStatus(reason instanceof Error ? reason.message : "Could not save category."); } };
  const remove = async (item: Category) => { try { if (!window.confirm(`Remove ${item.name}?`)) return; await repository.removeCategory(item.id); await refresh(); } catch (reason) { setStatus(reason instanceof Error ? reason.message : "Could not remove category."); } };
  return <main className="visual-screen metadata-screen"><header className="screen-heading compact-heading"><p className="eyebrow">Prayer · Categories</p><h1>Categories</h1><p className="screen-intro">Keep categories flat and few. They are light organization, not a filing hierarchy.</p><Link className="quiet-back-link" to="/prayer">← Prayer</Link></header><div className="metadata-layout"><section className="metadata-list"><p className="section-kicker">Categories</p>{items.map((item) => <div className="metadata-row" key={item.id}><strong>{item.name}</strong><div><button type="button" onClick={() => { setEditing(item); setName(item.name); }}>Rename</button><button type="button" onClick={() => void remove(item)}>Remove</button></div></div>)}</section><section className="metadata-editor"><p className="section-kicker">{editing ? "Rename category" : "Add category"}</p><label><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} /></label><div><button type="button" disabled={!name.trim()} onClick={() => void save()}>{editing ? "Save name" : "Add category"}</button>{editing ? <button type="button" onClick={() => { setEditing(null); setName(""); }}>Cancel</button> : null}</div><p className="prayer-form-status" aria-live="polite">{status}</p></section></div></main>;
}
