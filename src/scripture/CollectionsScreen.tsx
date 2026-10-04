import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { db } from '../data/database';
import { CollectionRepository } from '../data/repositories/collections';
import { isEditConflict } from '../data/conflicts';
import type { Collection, CollectionItem } from '../domain/types';
import { JournalDialog, JournalHeading } from '../writing/JournalPrimitives';
import { usePrayerDraftGuard } from '../prayer/usePrayerDraftGuard';
import { usePrayerPosition } from '../prayer/detail-hooks';
import { useMetadataRead } from '../prayer/metadata-hooks';
import { parsePendingScripture } from '../reflection/context';
import { loadBibleManifest } from './loader';
import type { BibleManifest } from './types';
import { readCollection } from './saved-model';
import { savedPassageUrl, shownCount, withSearchReturn } from '../search/context';
import { safeDataReturn } from '../data/data-context';
import { prayerReferenceLabel } from '../prayer/references';

const repository = new CollectionRepository(db);
type Editor = { kind: 'create'; value: string } | { kind: 'rename'; value: string; base: Collection } | { kind: 'note'; value: string; base: CollectionItem };
export function CollectionsScreen() {
  const location = useLocation(), [params, setParams] = useSearchParams(), url = location.pathname + location.search;
  const selectedId = params.get('collection'), targetItem = params.get('item'), pending = parsePendingScripture(params);
  const returnTo = safeDataReturn(params.get('return') ?? '/bible/saved?view=collections');
  const shown = shownCount(params.get('shown'), 20);
  const read = useMetadataRead(selectedId ?? '', () => readCollection(db, selectedId));
  const [manifest, setManifest] = useState<BibleManifest | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null), [busy, setBusy] = useState(false), [status, setStatus] = useState('');
  const [error, setError] = useState(''), [conflict, setConflict] = useState(false), [latest, setLatest] = useState<Collection | CollectionItem | null>(null);
  const [remove, setRemove] = useState<Collection | CollectionItem | null>(null);
  const lock = useRef(false), draft = useRef(editor); draft.current = editor;
  const selected = read.data?.selected ?? null, items = read.data?.items ?? [];
  const editorUnavailable = Boolean(read.data && editor && editor.kind !== 'create' && (editor.kind === 'rename' ? !read.data.collections.some(item => item.id === editor.base.id) : !items.some(item => item.id === editor.base.id)));
  const dirty = Boolean(editor && (editor.kind === 'create' ? editor.value.trim() : editor.value !== (editor.kind === 'rename' ? editor.base.name : editor.base.note ?? '')));
  useEffect(() => { let active = true; void loadBibleManifest().then(value => { if (active) setManifest(value); }).catch(() => {}); return () => { active = false; }; }, []);
  useEffect(() => {
    const next = new URLSearchParams(params);
    for (const key of ['collection', 'item']) if (next.has(key) && !/^[a-zA-Z0-9_-]+$/.test(next.get(key)!)) next.delete(key);
    if (params.has('shown')) { if (shown === 20) next.delete('shown'); else next.set('shown', String(shown)); }
    if (params.has('return') && returnTo !== params.get('return')) next.delete('return');
    if (next.toString() !== params.toString()) setParams(next, {replace: true});
  }, [location.search, shown, returnTo, setParams]);
  const selectedIndex = items.findIndex(item => item.id === targetItem), visible = items.slice(0, Math.max(shown, selectedIndex + 1));
  usePrayerPosition(url, Boolean(read.data), selectedIndex >= 0 ? targetItem : null, '.collections-journal', 'collection-item-');
  const clear = () => { setEditor(null); setConflict(false); setLatest(null); setError(''); };
  const save = async (): Promise<Collection | CollectionItem | null> => {
    const snapshot = draft.current;
    if (!snapshot) return null;
    if (lock.current) throw new Error('Please wait while these changes are saved.');
    lock.current = true; setBusy(true); setError('');
    try {
      const result = snapshot.kind === 'create' ? await repository.create(snapshot.value) : snapshot.kind === 'rename' ? await repository.rename(snapshot.base.id, snapshot.value, snapshot.base.description, snapshot.base.revision) : await repository.saveItemNote(snapshot.base.id, snapshot.value, snapshot.base.revision);
      setStatus(snapshot.kind === 'create' ? 'Collection ready.' : 'Saved locally.');
      if (draft.current !== snapshot) { setEditor(current => current && current.kind !== 'create' ? {...current, base: result} as Editor : current); throw new Error('Newer changes remain unsaved. Review them before continuing.'); }
      clear();
      // The committed result is accepted without relying on a successful refresh.
      read.accept(old => {
        if (!old) return {collections: 'name' in result ? [result] : [], selected: 'name' in result ? result : null, items: 'collectionId' in result ? [result] : []};
        return 'name' in result ? {...old, collections: [...old.collections.filter(item => item.id !== result.id), result], selected: old.selected?.id === result.id || snapshot.kind === 'create' ? result : old.selected} : {...old, items: old.items.map(item => item.id === result.id ? result : item)};
      });
      read.retry(); return result;
    } catch (reason) { if (isEditConflict(reason)) setConflict(true); setError(reason instanceof Error ? reason.message : 'Could not save. Your writing is still here.'); throw reason; }
    finally { lock.current = false; setBusy(false); }
  };
  const guard = usePrayerDraftGuard({dirty, save: async () => { await save(); }, discard: clear, canSave: !editorUnavailable && (Boolean(editor?.value.trim()) || editor?.kind === 'note'), pending: busy});
  const choose = (id: string) => guard.request(() => { clear(); const next = new URLSearchParams(params); next.set('collection', id); next.delete('item'); next.delete('shown'); setParams(next); });
  const openEditor = (next: Editor) => guard.request(() => { clear(); setEditor(next); });
  const submit = (event: FormEvent) => { event.preventDefault(); void save().then(result => { if (result && 'name' in result) { guard.allowNavigation(); const next = new URLSearchParams(params); next.set('collection', result.id); setParams(next); } }).catch(() => {}); };
  const addPending = async (id: string) => {
    if (!pending || lock.current) return; lock.current = true; setBusy(true); setError('');
    try { const saved = await repository.addReference(id, pending); setStatus('Passage added to collection.'); if (selected?.id === id) read.accept(old => old ? {...old, items: [...old.items.filter(item => item.id !== saved.id), saved]} : {collections: [], selected: null, items: []}); read.retry(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save this passage.'); } finally { lock.current = false; setBusy(false); }
  };
  const removeRecord = async () => {
    if (!remove || lock.current) return; const record = remove; lock.current = true; setBusy(true); setError('');
    try {
      if ('name' in record) await repository.removeCollection(record.id, record.revision); else await repository.removeItem(record.id, record.revision);
      setRemove(null); setStatus('Removed from current views. Existing backups are unaffected.');
      read.accept(old => old ? 'name' in record ? {...old, collections: old.collections.filter(item => item.id !== record.id), selected: null, items: []} : {...old, items: old.items.filter(item => item.id !== record.id)} : {collections: [], selected: null, items: []});
      if ('name' in record) { guard.allowNavigation(); const next = new URLSearchParams(params); next.delete('collection'); next.delete('item'); setParams(next); } read.retry();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not remove. Please try again.'); } finally { lock.current = false; setBusy(false); }
  };
  const editorForm = editor && <form className="collection-editor" onSubmit={submit}>
    <label htmlFor="collection-editor">{editor.kind === 'create' ? 'New collection' : editor.kind === 'rename' ? 'Collection name' : 'Passage note'}</label>
    {editor.kind === 'note' ? <textarea id="collection-editor" className="journal-textarea" disabled={busy} value={editor.value} onChange={event => setEditor({...editor, value: event.target.value})} /> : <input id="collection-editor" disabled={busy} value={editor.value} onChange={event => setEditor({...editor, value: event.target.value})} placeholder="Promises, Wisdom, Family…" />}
    <p className="journal-help">{dirty ? 'Unsaved changes' : 'No unsaved changes'} · Unsaved writing stays in memory until you save.</p>
    <div className="journal-actions"><button className="grace-primary" disabled={busy || editorUnavailable || (!editor.value.trim() && editor.kind !== 'note')} type="submit">{busy ? 'Saving…' : editor.kind === 'create' ? 'Save collection' : editor.kind === 'rename' ? 'Save name' : 'Save note'}</button><button type="button" disabled={busy} onClick={() => guard.request(clear)}>Cancel</button></div>
    {conflict && <div className="journal-conflict"><h3>Review this change</h3><p>Your writing has not been replaced.</p><button type="button" onClick={async () => { try { const current = editor.kind === 'note' ? await db.collectionItems.get(editor.base.id) : editor.kind === 'rename' ? await db.collections.get(editor.base.id) : null; if (!current || current.deletedAt) throw new Error('This record was removed. Copy your writing before closing.'); setLatest(current); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load the saved version.'); } }}>Review latest saved version</button>{latest && <><label>Your changes<textarea readOnly value={editor.value} /></label><label>Saved version<textarea readOnly value={'name' in latest ? latest.name : latest.note ?? ''} /></label><div className="journal-actions"><button type="button" onClick={() => { if (editor.kind !== 'create') setEditor({...editor, base: latest, value: 'name' in latest ? latest.name : latest.note ?? ''} as Editor); setConflict(false); setLatest(null); }}>Use saved version</button><button type="button" onClick={() => { if (editor.kind !== 'create') setEditor({...editor, base: latest} as Editor); setConflict(false); setLatest(null); }}>Keep my changes for explicit save</button></div></>}</div>}
  </form>;
  return <main className="journal-workspace collections-journal mg-collections-workspace">
    <JournalHeading title="Collections" subtitle="Scripture to keep close" back={returnTo} />
    <div className="journal-actions"><button disabled={busy} onClick={() => openEditor({kind: 'create', value: ''})}>Add collection</button><Link to={withSearchReturn('/search?scope=saved', url)}>Search</Link><Link to={withSearchReturn('/bible/saved?view=collections', url)}>Saved Scripture</Link></div>
    {pending && <section className="journal-notice"><p className="journal-kicker">Selected passage</p><strong>{prayerReferenceLabel(pending, manifest)}</strong><p>Choose a collection below.</p></section>}
    {error && <p role="alert" className="journal-notice">{error}</p>}
    <p role="status" className="journal-status">{status}</p>
    {read.error && <div role="alert" className="journal-notice">{read.error}<button onClick={read.retry}>Retry refresh</button></div>}
    {!read.data && !read.error && <p role="status">Opening collections…</p>}
    {editor?.kind === 'create' && editorForm}
    {editorUnavailable && <><p className="journal-notice">This saved record was removed. Your unsaved writing is still here to copy. Saving cannot recreate it.</p>{editorForm}</>}
    <aside className="collection-sidebar"><nav className="collection-directory" aria-label="Scripture collections">{read.data?.collections.map(collection => <div className="collection-directory-row" key={collection.id}><button id={'collection-' + collection.id} className={selected?.id === collection.id ? 'is-active' : ''} disabled={busy} onClick={() => choose(collection.id)} aria-pressed={selected?.id === collection.id}>{collection.name}</button>{pending && <button className="collection-add-here" disabled={busy} aria-label={'Add selected passage to ' + collection.name} onClick={() => void addPending(collection.id)}>Add here</button>}</div>)}</nav></aside>
    {read.data && !read.data.collections.length && <div className="archive-empty mg-empty-state"><h2>No collections yet.</h2><p>Create a collection to gather meaningful Scripture.</p></div>}
    {read.data && selectedId && !selected && <p className="journal-notice">This collection is no longer available. Choose another collection or add a new one.</p>}
    {selected && <section className="collection-content"><div className="archive-section-heading"><h2>{selected.name}</h2><span>{visible.length} of {items.length} passages</span></div><div className="journal-actions"><button disabled={busy} onClick={() => openEditor({kind: 'rename', value: selected.name, base: selected})}>Rename</button><button className="journal-remove" disabled={busy} onClick={() => guard.request(() => setRemove(selected))}>Delete collection</button></div>{editor?.kind === 'rename' && editorForm}
      {!items.length && <p className="archive-empty mg-empty-state">No passages saved here yet. Select Scripture in the reader and choose More → Add to collection.</p>}
      {targetItem && selectedIndex < 0 && <p className="journal-notice">That saved passage is no longer in this collection.</p>}
      {visible.map(item => <article className="collection-journal-item" id={'collection-item-' + item.id} tabIndex={-1} key={item.id}><Link id={'collection-read-' + item.id} to={savedPassageUrl(item, url)}>{prayerReferenceLabel(item, manifest)}</Link><small> · {item.translationId}</small>{item.note && <p>{item.note}</p>}<div className="journal-actions"><button id={'collection-note-' + item.id} disabled={busy} onClick={() => openEditor({kind: 'note', value: item.note ?? '', base: item})}>{item.note ? 'Edit note' : 'Add note'}</button><button className="journal-remove" disabled={busy} aria-label={'Remove ' + prayerReferenceLabel(item, manifest)} onClick={() => guard.request(() => setRemove(item))}>Remove</button></div>{editor?.kind === 'note' && editor.base.id === item.id && editorForm}</article>)}
      {visible.length < items.length && <button onClick={() => { const next = new URLSearchParams(params); next.set('shown', String(Math.max(shown, visible.length) + 20)); setParams(next); }}>Show more</button>}
    </section>}
    {remove && <JournalDialog title={'name' in remove ? 'Remove this collection?' : 'Remove this saved passage?'} close={() => setRemove(null)} busy={busy}><p>{'name' in remove ? 'This removes the collection and its saved passages from current views.' : 'This removes the passage and its collection note from current views.'} Copies in existing backups are unaffected.</p><div className="journal-dialog-actions"><button disabled={busy} onClick={() => void removeRecord()}>Remove</button><button disabled={busy} data-initial-focus onClick={() => setRemove(null)}>Keep it</button></div>{error && <p role="alert">{error}</p>}</JournalDialog>}
    {guard.dialog}
  </main>;
}
