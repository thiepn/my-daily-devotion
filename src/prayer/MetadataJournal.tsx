import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { TagIcon } from "@phosphor-icons/react/dist/csr/Tag";
import { db } from "../data/database";
import { isEditConflict } from "../data/conflicts";
import { CategoryRepository, PersonRepository, DEFAULT_CATEGORIES, MetadataReferencedError } from "../data/repositories/prayer-metadata";
import { JournalDialog, JournalHeading } from "../writing/JournalPrimitives";
import { DevotionalIcon } from "../app/visual/DevotionalIcon";
import { identityTone, personInitials, prayerStatusLabels } from "./journal";
import { prayerDetailUrl } from "./detail-model";
import { usePrayerPosition } from "./detail-hooks";
import { usePrayerDraftGuard } from "./usePrayerDraftGuard";
import { useMetadataRead } from "./metadata-hooks";
import { compareMetadata, parseMetadataQuery, personFields, readLinkedPrayers, readMetadataCounts, readMetadataDirectory, type MetadataKind, type MetadataRecord } from "./metadata-model";

const people = new PersonRepository(db), categories = new CategoryRepository(db);
type Fields = { name: string; relationship: string; notes: string };
type Editor = { record: MetadataRecord | null; baseline: Fields; value: Fields };
const fields = (record?: MetadataRecord | null): Fields => ({ name: record?.name ?? "", relationship: record ? personFields(record)?.relationship ?? "" : "", notes: record ? personFields(record)?.notes ?? "" : "" });
const same = (a: Fields, b: Fields) => a.name === b.name && a.relationship === b.relationship && a.notes === b.notes;
const normalized = (value: Fields): Fields => ({ name: value.name.trim(), relationship: value.relationship.trim(), notes: value.notes.trim() });
const errorText = (error: unknown) => error instanceof Error ? error.message : "Could not save. Your changes are still here.";

export function MetadataJournal({ kind }: { kind: MetadataKind }) {
  const location = useLocation(), [params, setParams] = useSearchParams();
  const query = parseMetadataQuery(location.search), url = location.pathname + query.search;
  const title = kind === "people" ? "People" : "Categories", singular = kind === "people" ? "person" : "category";
  const directory = useMetadataRead(kind + query.search, () => readMetadataDirectory(db, kind, query));
  const [editor, setEditor] = useState<Editor | null>(null), editorRef = useRef(editor); editorRef.current = editor;
  const [message, setMessage] = useState(""), [busy, setBusy] = useState(false), locked = useRef(false);
  const [conflict, setConflict] = useState(false), [review, setReview] = useState<MetadataRecord | null>(null), [reviewError, setReviewError] = useState("");
  const [removing, setRemoving] = useState<MetadataRecord | null>(null), [removeError, setRemoveError] = useState("");
  const [committed, setCommitted] = useState<MetadataRecord | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const changeEditor = (value: Editor | null) => { editorRef.current = value; setEditor(value); };
  const dirty = Boolean(editor && !same(editor.value, editor.baseline));
  const editedRecord = useMetadataRead(kind + ":edit:" + (editor?.record?.id ?? ""), async () => {
    if (!editorRef.current?.record) return null;
    const record = await db[kind].get(editorRef.current.record.id);
    return record && !record.deletedAt ? record as MetadataRecord : null;
  });
  const deleted = Boolean(editor?.record && editedRecord.data === null);
  const selected = directory.data?.selected ?? (committed?.id === query.entry && !directory.data ? committed : null);
  const countIds = [...new Set([...(directory.data?.records.map(record => record.id) ?? []), ...(selected ? [selected.id] : [])])];
  const counts = useMetadataRead(kind + ":counts:" + countIds.join("|"), () => readMetadataCounts(db, kind, countIds));
  const linked = useMetadataRead(kind + ":linked:" + query.entry + ":" + query.prayersShown, () => query.entry ? readLinkedPrayers(db, kind, query.entry, query.prayersShown) : Promise.resolve(null));
  const save = async () => {
    const captured = editorRef.current;
    if (!captured || locked.current) throw new Error("Please wait for the current action to finish.");
    if (captured.record && same(normalized(captured.value), normalized(captured.baseline))) return;
    if (!captured.value.name.trim()) throw new Error("A name is required.");
    if (deleted) throw new Error("This entry was removed. Copy your writing before leaving.");
    locked.current = true; setBusy(true); setMessage("");
    try {
      let record: MetadataRecord, created = !captured.record;
      if (kind === "people") record = captured.record
        ? await people.updatePerson(captured.record.id, captured.value, captured.record.revision)
        : await people.createPerson(captured.value.name, captured.value.relationship, captured.value.notes);
      else if (captured.record) record = await categories.updateCategory(captured.record.id, captured.value.name, captured.record.revision);
      else { const result = await categories.createCategoryResult(captured.value.name); record = result.record; created = result.created; }
      if (!alive.current) return;
      const newer = editorRef.current && !same(editorRef.current.value, captured.value);
      changeEditor({ record, baseline: fields(record), value: newer ? editorRef.current!.value : fields(record) });
      setCommitted(record); setConflict(false); setReview(null);
      directory.accept(old => {
        const matches = (item: MetadataRecord) => (item.name + " " + (personFields(item)?.relationship ?? "")).toLocaleLowerCase().includes(query.q.trim().toLocaleLowerCase());
        const records = [...(old?.records.filter(item => item.id !== record.id) ?? []), ...(matches(record) ? [record] : [])].sort(compareMetadata).slice(0, query.shown);
        const difference = created ? Number(matches(record)) : captured.record ? Number(matches(record)) - Number(matches(captured.record)) : 0;
        return { records, total: (old?.total ?? 0) + (created ? 1 : 0), matching: (old?.matching ?? 0) + difference, selected: record, untouched: false };
      });
      if (newer) throw new Error("Your earlier changes were saved. Newer writing is still unsaved.");
      setMessage(!captured.record && !created ? "This category already exists. Its saved entry is shown below." : "Saved locally.");
    } catch (reason) {
      if (alive.current) { setMessage(errorText(reason)); if (isEditConflict(reason)) { setConflict(true); setReview(null); } }
      throw reason;
    } finally { locked.current = false; if (alive.current) setBusy(false); }
  };
  const discard = () => { changeEditor(null); setConflict(false); setReview(null); setReviewError(""); setMessage(""); };
  const guard = usePrayerDraftGuard({ dirty, save, discard, canSave: Boolean(editor?.value.name.trim()) && !deleted && !conflict, pending: busy });
  const setQuery = (patch: Record<string, string | null>, replace = false) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) { if (value === null || value === "") next.delete(key); else next.set(key, value); }
    setParams(next, { replace });
  };
  useEffect(() => { if (query.search !== location.search && !dirty && !busy) setParams(new URLSearchParams(query.search), { replace: true }); }, [query.search, location.search, dirty, busy, setParams]);
  useEffect(() => {
    if (!editor?.record || dirty || busy || !editedRecord.data || editedRecord.data.id !== editor.record.id) return;
    if (editedRecord.data.revision > editor.record.revision) changeEditor({ record: editedRecord.data, baseline: fields(editedRecord.data), value: fields(editedRecord.data) });
  }, [editedRecord.data, dirty, busy, editor?.record]);
  usePrayerPosition(url, Boolean(directory.data) && (!query.entry || linked.data !== undefined || Boolean(linked.error)), query.entry, ".metadata-journal");
  const select = (id: string) => guard.request(() => { discard(); guard.allowNavigation(); setQuery({ entry: query.entry === id ? null : id, prayersShown: null }); });
  const begin = (record: MetadataRecord | null) => guard.request(() => {
    discard(); changeEditor({ record, baseline: fields(record), value: fields(record) });
    requestAnimationFrame(() => {
      const heading = document.getElementById("metadata-editor-heading");
      // A quick typist may already be in a field before this frame arrives.
      if (!heading?.parentElement?.contains(document.activeElement)) heading?.focus();
    });
  });
  const reveal = (record: MetadataRecord) => {
    guard.allowNavigation(); setQuery({ q: null, entry: record.id, prayersShown: null });
    requestAnimationFrame(() => document.getElementById("prayer-entry-" + record.id)?.focus());
  };
  const saveAndClose = async () => { try { await save(); const record = editorRef.current?.record; changeEditor(null); if (record) reveal(record); } catch { /* writing remains in place */ } };
  const retryAll = () => { directory.retry(); counts.retry(); linked.retry(); editedRecord.retry(); };
  const remove = async () => {
    if (!removing || locked.current) return;
    locked.current = true; setBusy(true); setRemoveError("");
    try {
      if (kind === "people") await people.removePerson(removing.id, removing.revision); else await categories.removeCategory(removing.id, removing.revision);
      setCommitted(null); setRemoving(null); setMessage(title === "People" ? "Person removed." : "Category removed.");
      directory.accept(old => ({ records: old?.records.filter(item => item.id !== removing.id) ?? [], total: Math.max(0, (old?.total ?? 1) - 1), matching: Math.max(0, (old?.matching ?? 1) - 1), selected: null, untouched: false }));
      guard.allowNavigation(); setQuery({ entry: null, prayersShown: null }, true);
      requestAnimationFrame(() => document.getElementById("metadata-add")?.focus());
    } catch (reason) { setRemoveError(errorText(reason)); if (reason instanceof MetadataReferencedError) { counts.retry(); linked.retry(); } }
    finally { locked.current = false; setBusy(false); }
  };
  const editorPanel = editor ? <section className="directory-editor journal-paper" aria-labelledby="metadata-editor-heading">
    <h2 id="metadata-editor-heading" tabIndex={-1}>{editor.record ? "Edit " : "Add "}{singular}</h2>
    {deleted ? <p role="alert">This {singular} was removed in another tab. Your unsaved writing is still here to copy; it will not recreate the entry.</p> : null}
    {editedRecord.error ? <Notice retry={editedRecord.retry}>Could not check the saved entry. Your writing is retained.</Notice> : null}
    <fieldset disabled={busy || deleted}>
      <label htmlFor="metadata-name">Name</label><input id="metadata-name" value={editor.value.name} onChange={event => changeEditor({ ...editor, value: { ...editor.value, name: event.target.value } })} />
      {kind === "people" ? <><label htmlFor="metadata-relationship">Relationship <small>optional</small></label><input id="metadata-relationship" value={editor.value.relationship} onChange={event => changeEditor({ ...editor, value: { ...editor.value, relationship: event.target.value } })} />
        <label htmlFor="metadata-notes">Notes <small>optional</small></label><textarea id="metadata-notes" value={editor.value.notes} onChange={event => changeEditor({ ...editor, value: { ...editor.value, notes: event.target.value } })} /></> : null}
    </fieldset>
    {deleted ? <label>Your unsaved writing<textarea readOnly value={[editor.value.name, editor.value.relationship, editor.value.notes].filter(Boolean).join("\n\n")} /></label> : null}
    <div className="journal-actions"><button className="grace-primary" disabled={busy || deleted || conflict || !editor.value.name.trim() || Boolean(editor.record && !dirty)} onClick={() => void saveAndClose()}>{busy ? "Saving…" : editor.record ? "Save changes" : "Save " + singular}</button>
      <button disabled={busy} onClick={() => guard.request(() => { discard(); requestAnimationFrame(() => document.getElementById(editor.record ? "metadata-edit-" + editor.record.id : "metadata-add")?.focus()); })}>Cancel</button></div>
    <p className="journal-help">Changes stay in memory until you save. Closing the app can discard unsaved changes.</p>
    {conflict ? <section className="journal-conflict" aria-label="Edit conflict"><h3>Review changed details</h3><p>Your writing has not been replaced. Compare versions before choosing what to keep.</p>
      {reviewError ? <p role="alert">{reviewError}</p> : null}
      {!review ? <button onClick={() => { void db[kind].get(editor.record!.id).then(record => { if (!record || record.deletedAt) throw new Error("This entry is no longer available."); setReview(record); setReviewError(""); }).catch(reason => setReviewError(errorText(reason))); }}>Compare versions</button> : <>
        <div className="directory-versions"><Version title="Your changes" value={editor.value} kind={kind}/><Version title="Saved version" value={fields(review)} kind={kind}/></div>
        <button onClick={() => { changeEditor({ record: review, baseline: fields(review), value: fields(review) }); setReview(null); setConflict(false); setMessage("Saved details loaded."); }}>Use saved version</button>
        <button onClick={() => { changeEditor({ record: review, baseline: fields(review), value: editor.value }); setReview(null); setConflict(false); setMessage("Your changes are ready for an explicit save."); }}>Keep my changes for review</button>
      </>}
    </section> : null}
  </section> : null;
  const expanded = (record: MetadataRecord) => editor?.record?.id === record.id ? editorPanel : <section className="directory-expanded" id={"metadata-panel-" + record.id} aria-label={record.name + " details"}>
    {personFields(record)?.notes ? <div className="directory-notes"><h3>Notes</h3><p>{personFields(record)!.notes}</p></div> : null}
    <div className="directory-linked-heading"><h3>Linked prayers</h3><span>All statuses</span></div>
    {linked.error ? <Notice retry={linked.retry}>Linked requests could not be refreshed.</Notice> : null}
    {linked.data === undefined ? linked.error ? null : <p role="status">Opening linked requests…</p> : linked.data?.available ? <>
      {linked.data.items.length ? <div className="directory-prayers">{linked.data.items.map(prayer => <Link key={prayer.id} id={"metadata-prayer-" + prayer.id} to={prayerDetailUrl(prayer.id, url)}><span><small>{prayerStatusLabels[prayer.status]}</small><span>{prayer.body}</span></span><DevotionalIcon name="chevron"/></Link>)}</div> : <p className="directory-empty-copy">No saved prayers are linked to this {singular}.</p>}
      <div className="directory-pagination"><span>Showing {linked.data.items.length} of {linked.data.total} prayers</span>{linked.data.items.length < linked.data.total ? <button id="metadata-more-prayers" onClick={() => setQuery({ prayersShown: String(query.prayersShown + 10) }, true)}>Show more prayers</button> : null}</div>
    </> : linked.data ? <p>This entry is no longer available.</p> : null}
    <div className="journal-actions directory-management"><button id={"metadata-edit-" + record.id} onClick={() => begin(record)}>Edit {singular}</button><button className="directory-remove" onClick={() => guard.request(() => { discard(); setRemoveError(""); setRemoving(record); })}>Remove {singular}</button></div>
  </section>;
  const records = directory.data?.records ?? [];
  const extraSelection = selected && !records.some(record => record.id === selected.id) ? selected : null;
  const visibleRecords = extraSelection ? [...records, extraSelection].sort(compareMetadata) : records;
  return <main className="journal-workspace metadata-journal">
    <JournalHeading title={title} subtitle={kind === "people" ? "The people you hold in prayer" : "A little order for your prayers"} back={query.returnTo}/>
    <div className="directory-toolbar"><p>{kind === "people" ? "Keep their stories close." : "Gather requests around what matters."}</p><button id="metadata-add" className="grace-primary" disabled={busy} onClick={() => begin(null)}>Add {singular}</button></div>
    <label className="directory-search" htmlFor="metadata-search"><span>Search {kind}</span><input id="metadata-search" type="search" value={query.q} onChange={event => { const q = event.target.value; guard.request(() => { discard(); guard.allowNavigation(); setQuery({ q, shown: null, entry: null, prayersShown: null }, true); }); }}/></label>
    {editor && !editor.record ? editorPanel : null}
    {editor?.record && (deleted || editor.record.id !== query.entry) ? editorPanel : null}
    <p className="journal-status" role="status">{message || (editor ? busy ? "Saving…" : dirty ? "Unsaved changes" : editor.record ? "Saved locally" : "Not saved yet" : "")}</p>
    {directory.error ? <Notice retry={retryAll}>Could not refresh the directory. Saved changes have not been undone.</Notice> : null}
    {!directory.data && !committed ? directory.error ? null : <p role="status">Opening {kind}…</p> : <>
      {query.entry && directory.data && !selected ? <div className="journal-notice"><p>This {singular} is no longer available.</p><button onClick={() => guard.request(() => { discard(); guard.allowNavigation(); setQuery({ entry: null, prayersShown: null }, true); })}>Return to directory</button></div> : null}
      {counts.error ? <Notice retry={counts.retry}>Prayer counts could not be refreshed.</Notice> : null}
      <section className="directory-list" aria-label={"Saved " + kind}>
        {visibleRecords.map(record => <article className="directory-row" key={record.id}>
          {extraSelection?.id === record.id ? <p className="journal-help">Selected entry · outside this page or search</p> : null}
          <button id={"prayer-entry-" + record.id} className="directory-row-toggle" aria-expanded={query.entry === record.id} aria-controls={query.entry === record.id && editor?.record?.id !== record.id ? "metadata-panel-" + record.id : undefined} onClick={() => select(record.id)}>
            <span className={"prayer-identity prayer-identity--" + identityTone(record.id)} aria-hidden="true">{kind === "people" ? personInitials(record.name) : <TagIcon weight="light"/>}</span>
            <span className="directory-row-copy"><strong>{record.name}</strong>{personFields(record)?.relationship ? <span>{personFields(record)!.relationship}</span> : null}<small>{counts.data?.[record.id] === undefined ? "Prayer count unavailable" : counts.data[record.id] + (counts.data[record.id] === 1 ? " linked prayer" : " linked prayers")}</small></span><DevotionalIcon name={query.entry === record.id ? "down" : "chevron"}/>
          </button>
          {query.entry === record.id && !deleted ? expanded(record) : null}
        </article>)}
        {!visibleRecords.length && directory.data ? <div className="directory-empty"><h2>{query.q ? "No matching " + kind : kind === "people" ? "Keep someone in mind." : "Room for what matters."}</h2><p>{query.q ? "Try another name" + (kind === "people" ? " or relationship." : ".") : kind === "people" ? "Add a person when you want to keep their requests together. People are always optional." : "Categories are optional. Add your own" + (directory.data.untouched ? ", or begin with the suggested set." : " when you need them.")}</p>{query.q ? <button onClick={() => setQuery({ q: null, shown: null }, true)}>Clear search</button> : null}</div> : null}
      </section>
      {directory.data?.matching ? <div className="directory-pagination"><span>Showing {records.length} of {directory.data.matching} {kind}{extraSelection ? ". Selected entry also shown." : ""}</span>{records.length < directory.data.matching ? <button id="metadata-more" onClick={() => guard.request(() => { guard.allowNavigation(); setQuery({ shown: String(query.shown + 20) }, true); })}>Show more</button> : null}</div> : null}
      {kind === "categories" && directory.data?.untouched && !query.q ? <section className="directory-suggestions journal-paper"><h2>A place to begin</h2><p>{DEFAULT_CATEGORIES.join(" · ")}</p><button disabled={busy} onClick={() => guard.request(() => { void (async () => {
        if (locked.current) return; locked.current = true; setBusy(true);
        try { await categories.ensureDefaults(); setMessage("Suggested categories are ready. Your prayers are unchanged."); retryAll(); }
        catch (reason) { setMessage(errorText(reason)); } finally { locked.current = false; setBusy(false); }
      })(); })}>Add suggested categories</button></section> : null}
    </>}
    {removing ? <JournalDialog title={"Remove " + removing.name + "?"} busy={busy} close={() => setRemoving(null)}>
      <p>Removal hides this {singular} from your directory. Existing backups are unaffected.</p>
      {counts.data?.[removing.id] ? <p>This entry is used by {counts.data[removing.id]} saved prayers. Active and Waiting assignments can be changed in Prayer Settings. Answered and Archived prayers retain their links.</p> : <p>It can only be removed when no saved prayer uses it.</p>}
      {removeError ? <p role="alert">{removeError}</p> : null}
      <div className="journal-dialog-actions">{counts.data?.[removing.id] ? <button onClick={() => { setRemoving(null); guard.allowNavigation(); setQuery({ entry: removing.id }); }}>View linked prayers</button> : <button className="directory-remove" disabled={busy || counts.data?.[removing.id] === undefined} onClick={() => void remove()}>{busy ? "Removing…" : "Remove " + singular}</button>}<button data-initial-focus disabled={busy} onClick={() => setRemoving(null)}>Keep {singular}</button></div>
    </JournalDialog> : null}{guard.dialog}
  </main>;
}
function Notice({ children, retry }: { children: ReactNode; retry: () => void }) { return <div className="journal-notice" role="alert"><p>{children}</p><button onClick={retry}>Retry refresh</button></div>; }
function Version({ title, value, kind }: { title: string; value: Fields; kind: MetadataKind }) {
  return <section><h4>{title}</h4><dl><dt>Name</dt><dd>{value.name}</dd>{kind === "people" ? <><dt>Relationship</dt><dd>{value.relationship || "Not set"}</dd><dt>Notes</dt><dd>{value.notes || "Not set"}</dd></> : null}</dl></section>;
}
