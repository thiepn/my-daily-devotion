import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useConfirmDialog } from "../app/useConfirmDialog";
import { useUnsavedChanges } from "../app/useUnsavedChanges";
import { useDraftGuard } from "../app/useDraftGuard";
import { useMutation } from "../app/useMutation";
import { ConflictReview } from "../app/ConflictReview";
import { isEditConflict } from "../data/conflicts";
import { db } from "../data/database";
import { PersonRepository } from "../data/repositories/prayer-metadata";
import type { Person } from "../domain/types";
const repository = new PersonRepository(db);
const describe = (person: Person) => `${person.name}\n${person.relationship ?? ""}\n${person.notes ?? ""}`;
export function PeopleScreen() {
  const [items, setItems] = useState<Person[]>([]);
  const [name, setName] = useState(""); const [relationship, setRelationship] = useState(""); const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState<Person | null>(null); const [conflict, setConflict] = useState(false);
  const { busy, status, setStatus, run } = useMutation();
  const refresh = useCallback(async () => setItems(await repository.list()), []);
  useEffect(() => { void refresh().catch(() => setStatus("Could not open this list. Reload to try again.")); }, [refresh]);
  const clear = () => { setName(""); setRelationship(""); setNotes(""); setEditing(null); setConflict(false); };
  const applyPerson = (item: Person) => { setEditing(item); setName(item.name); setRelationship(item.relationship ?? ""); setNotes(item.notes ?? ""); setConflict(false); };
  const dirty = name !== (editing?.name ?? "") || relationship !== (editing?.relationship ?? "") || notes !== (editing?.notes ?? "");
  useUnsavedChanges(dirty);
  const save = async () => {
    try {
      if (editing) await repository.updatePerson(editing.id, { name, relationship, notes }, editing.revision);
      else await repository.createPerson(name, relationship, notes);
      clear(); setStatus("Person saved locally.");
      await refresh().catch(() => setStatus("Person saved. Reopen this list to refresh it."));
    } catch (reason) { setConflict(isEditConflict(reason)); throw reason; }
  };
  const { confirmDrafts, draftDialog } = useDraftGuard(dirty, save, clear);
  const confirm = useConfirmDialog();
  const edit = async (item: Person) => { if (await confirmDrafts()) { const latest = await repository.get(item.id); if (!latest) throw new Error("This person was removed in another tab."); applyPerson(latest); } };
  const remove = async (item: Person) => { if (!await confirmDrafts() || !await confirm({ title: "Remove person?", message: `Remove ${item.name} from the active people list? Existing prayer history is preserved.`, confirmLabel: "Remove person", tone: "danger" })) return; await repository.removePerson(item.id); if (editing?.id === item.id) clear(); await refresh(); };
  return <main className="visual-screen metadata-screen mg-secondary-screen mg-prayer-metadata-workspace">
    <header className="screen-heading compact-heading mg-secondary-header"><p className="eyebrow">Prayer · People</p><h1>People</h1><p className="screen-intro">A person is optional, but useful when several requests belong to the same relationship and history.</p><Link className="quiet-back-link" to="/prayer">← Prayer</Link></header>
    <div className="metadata-layout"><section className="metadata-list"><p className="section-kicker">Saved people</p>{items.length ? items.map((item) => <div className="metadata-row" key={item.id}><div><strong>{item.name}</strong><span>{item.relationship ?? "No relationship label"}</span></div><div><button type="button" disabled={busy} onClick={() => void run(() => edit(item))}>Edit</button><button type="button" disabled={busy} onClick={() => void run(() => remove(item))}>Remove</button></div></div>) : <p className="muted-copy">No people yet.</p>}</section>
    <section className="metadata-editor"><p className="section-kicker">{editing ? "Edit person" : "Add person"}</p><label><span>Name</span><input disabled={busy} value={name} onChange={(event) => setName(event.target.value)} /></label><label><span>Relationship <small>optional</small></span><input disabled={busy} value={relationship} onChange={(event) => setRelationship(event.target.value)} /></label><label><span>Notes <small>optional</small></span><textarea disabled={busy} value={notes} onChange={(event) => setNotes(event.target.value)} /></label><div><button type="button" disabled={busy || !name.trim()} onClick={() => void run(save)}>{editing ? "Save changes" : "Add person"}</button>{editing ? <button type="button" disabled={busy} onClick={() => void run(async () => { if (await confirmDrafts()) clear(); })}>Cancel</button> : null}</div><p className="prayer-form-status" aria-live="polite">{status}</p>
      <ConflictReview active={conflict} draftText={`${name}\n${relationship}\n${notes}`} describe={describe} loadLatest={async () => { const latest = editing && await repository.get(editing.id); if (!latest) throw new Error("This person is no longer available."); return latest; }} useLatest={applyPerson} />
    </section></div>{draftDialog}
  </main>;
}
