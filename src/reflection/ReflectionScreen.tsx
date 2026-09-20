import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useUnsavedChanges } from "../app/useUnsavedChanges";
import { BotanicalSprig } from "../app/visual/MorningGraceMotifs";
import { db } from "../data/database";
import { ReflectionRepository } from "../data/repositories/reflections";
import { assertLocalDate } from "../domain/time";
import type { LocalDate, Reflection, ScriptureLink, ScriptureReference } from "../domain/types";
import { loadBibleManifest } from "../scripture/loader";
import { parseVerseKey } from "../scripture/repository";
import type { BibleManifest } from "../scripture/types";
import { buildPrayerHandoffUrl, parsePendingScripture } from "./context";

const repository = new ReflectionRepository(db);
const prompts = [
  "What stood out?",
  "What does this show about God?",
  "What should I obey or change?",
  "What should I pray about?",
  "What am I thankful for?",
];

function formatDate(localDate: LocalDate): string {
  const [year, month, day] = localDate.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(new Date(year!, month! - 1, day!, 12));
}

function labelReference(reference: ScriptureReference, manifest: BibleManifest | null): string {
  const start = parseVerseKey(reference.startVerseKey);
  const end = parseVerseKey(reference.endVerseKey);
  const name = manifest?.books.find((book) => book.id === start.bookId)?.name ?? start.bookId;
  if (start.chapter === end.chapter) return `${name} ${start.chapter}:${start.verse}${start.verse === end.verse ? "" : `–${end.verse}`}`;
  return `${name} ${start.chapter}:${start.verse}–${end.chapter}:${end.verse}`;
}

function bibleHref(reference: ScriptureReference): string {
  const start = parseVerseKey(reference.startVerseKey);
  return `/bible/${start.bookId}/${start.chapter}?verse=${start.verse}`;
}

export function ReflectionScreen() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const rawDate = params.localDate ?? "";
  let localDate: LocalDate | null = null;
  try { assertLocalDate(rawDate); localDate = rawDate as LocalDate; } catch { localDate = null; }
  const pending = useMemo(() => parsePendingScripture(searchParams), [searchParams]);
  const returnParam = searchParams.get("return");
  const backTarget = (returnParam?.startsWith("/") && !returnParam.startsWith("//")) ? returnParam : "/today";
  const textarea = useRef<HTMLTextAreaElement | null>(null);
  const [reflection, setReflection] = useState<Reflection | null>(null);
  const [links, setLinks] = useState<ScriptureLink[]>([]);
  const [manifest, setManifest] = useState<BibleManifest | null>(null);
  const [body, setBody] = useState("");
  const [savedBody, setSavedBody] = useState("");
  const [showPrompts, setShowPrompts] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!localDate) return;
    const existing = await repository.getDaily(localDate);
    const nextLinks = existing ? await repository.listScriptureLinks(existing.id) : [];
    setReflection(existing ?? null);
    setLinks(nextLinks);
    setBody(existing?.bodyMd ?? "");
    setSavedBody(existing?.bodyMd ?? "");
  }, [localDate]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([refresh(), loadBibleManifest().then((value) => { if (!cancelled) setManifest(value); })])
      .catch((reason: unknown) => { if (!cancelled) setStatus(reason instanceof Error ? reason.message : "Could not open reflection."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refresh]);

  const pendingAlreadyLinked = pending ? links.some((item) => item.translationId === pending.translationId && item.startVerseKey === pending.startVerseKey && item.endVerseKey === pending.endVerseKey) : false;
  const dirty = body !== savedBody || Boolean(pending && !pendingAlreadyLinked);
  useUnsavedChanges(!loading && body !== savedBody);
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);

  if (!localDate) return <main className="visual-screen reflection-screen mg-secondary-screen mg-reflection-workspace"><p className="eyebrow">Reflection</p><h1>Invalid date</h1><Link to="/today">Return to Today</Link></main>;
  if (loading) return <main className="visual-screen reflection-screen"><p className="eyebrow">Reflection</p><p>Opening your local reflection…</p></main>;

  const save = async () => {
    if (saving.current || !body.trim()) return;
    saving.current = true; setBusy(true);
    const text = body;
    try {
      const result = await repository.saveDaily(localDate!, text, reflection?.revision ?? null, pending && !pendingAlreadyLinked ? pending : undefined);
      const nextLinks = await repository.listScriptureLinks(result.reflection.id);
      setReflection(result.reflection);
      setLinks(nextLinks);
      setSavedBody(result.reflection.bodyMd);
      setBody((current) => current === text ? result.reflection.bodyMd : current);
      setStatus(result.created ? "Reflection created and saved locally." : "Reflection saved locally.");
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : "Could not save reflection.");
    } finally { saving.current = false; setBusy(false); }
  };

  const remove = async () => {
    if (!window.confirm("Remove this reflection and its linked passages?")) return;
    try { await repository.removeDaily(localDate!);
    setReflection(null);
    setLinks([]);
    setBody("");
    setSavedBody("");
    setStatus("Reflection removed.");
    } catch { setStatus("Could not remove the reflection. Please try again."); }
  };

  const insert = (before: string, after = "", placeholder = "text") => {
    const node = textarea.current;
    if (!node) return;
    const start = node.selectionStart;
    const end = node.selectionEnd;
    const selected = body.slice(start, end) || placeholder;
    const next = `${body.slice(0, start)}${before}${selected}${after}${body.slice(end)}`;
    setBody(next);
    requestAnimationFrame(() => {
      node.focus();
      const cursorStart = start + before.length;
      node.setSelectionRange(cursorStart, cursorStart + selected.length);
    });
  };

  const addPrompt = (prompt: string) => {
    setBody((current) => `${current}${current.trim() ? "\n\n" : ""}### ${prompt}\n`);
    requestAnimationFrame(() => textarea.current?.focus());
  };

  return (
    <main className="visual-screen reflection-screen mg-secondary-screen mg-reflection-workspace">
      <header className="screen-heading compact-heading reflection-heading mg-secondary-header">
        <p className="eyebrow">Personal reflection · {formatDate(localDate)}</p>
        <h1>Reflect</h1>
        <p className="screen-intro">Write what stood out and what you want to remember.</p>
        <Link className="quiet-back-link" to={backTarget}>← Back</Link>
      </header>

      <div className="reflection-layout">
        <section className="reflection-editor-panel" aria-labelledby="editor-heading">
          <div className="reflection-editor-topline">
            <div><p className="section-kicker">Your response</p><h2 id="editor-heading">Write freely.</h2></div>
            <span className={dirty ? "save-state is-dirty" : "save-state"}>{dirty ? "Unsaved changes" : reflection ? "Saved locally" : "Not saved yet"}</span>
          </div>

          <div className="markdown-toolbar" aria-label="Reflection formatting">
            <button type="button" onClick={() => insert("**", "**", "bold text")}><strong>B</strong><span className="sr-only">Bold</span></button>
            <button type="button" onClick={() => insert("_", "_", "italic text")}><em>I</em><span className="sr-only">Italic</span></button>
            <button type="button" onClick={() => insert("- ", "", "list item")}>• List</button>
            <button type="button" onClick={() => insert("1. ", "", "list item")}>1. List</button>
            <button type="button" onClick={() => insert("> ", "", "quote")}>Quote</button>
            <button type="button" onClick={() => insert("[", "](https://)", "link text")}>Link</button>
          </div>

          <textarea
            ref={textarea}
            className="reflection-textarea"
            value={body}
            onChange={(event) => { setBody(event.target.value); setStatus(""); }}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
                event.preventDefault();
                void save();
              }
            }}
            placeholder="Write what stood out, what you want to remember, or nothing at all until you have something to say."
            aria-label="Daily reflection"
          />

          <div className="reflection-editor-actions">
            <button className="primary-editorial-action compact-action" type="button" disabled={busy || !dirty || !body.trim()} onClick={() => void save()}>Save reflection</button>
            <button className="quiet-button" type="button" aria-expanded={showPrompts} onClick={() => setShowPrompts((value) => !value)}>{showPrompts ? "Hide prompts" : "Optional prompts"}</button>
            {reflection ? <button className="quiet-button danger-quiet" type="button" onClick={() => void remove()}>Remove reflection</button> : null}
          </div>

          {showPrompts ? <div className="reflection-prompts">{prompts.map((prompt) => <button key={prompt} type="button" onClick={() => addPrompt(prompt)}>{prompt}</button>)}</div> : null}
          <p className="reflection-status" aria-live="polite">{status}</p>
        </section>

        <aside className="reflection-context-panel"><BotanicalSprig className="mg-reflection-sprig" />
          <section>
            <p className="section-kicker">Linked Scripture</p>
            <h2>From Scripture</h2>
            {pending && !pendingAlreadyLinked ? <div className="pending-scripture"><span>Will attach on save</span><strong>{labelReference(pending, manifest)}</strong></div> : null}
            {links.length ? (
              <div className="linked-scripture-list">
                {links.map((link) => (
                  <div className="linked-scripture-row" key={link.id}>
                    <Link to={bibleHref(link)}>{labelReference(link, manifest)}</Link>
                    <button type="button" aria-label={`Detach ${labelReference(link, manifest)}`} onClick={async () => { await repository.detachScripture(link.id); setLinks(await repository.listScriptureLinks(link.ownerId)); }}>×</button>
                  </div>
                ))}
              </div>
            ) : pending ? null : <p className="muted-copy">Select a verse in the Bible reader and choose Reflect to link it here.</p>}
          </section>

          <section className="reflection-prayer-handoff">
            <p className="section-kicker">Prayer</p>
            <h2>Bring it into prayer</h2>
            <p className="muted-copy">Your reflection and linked passages will stay with the prayer.</p>
            {reflection ? <Link className="future-text-link" to={buildPrayerHandoffUrl(reflection)}>Create prayer →</Link> : <span className="disabled-handoff">Save the reflection first.</span>}
          </section>
        </aside>
      </div>
    </main>
  );
}
