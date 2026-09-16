import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { db } from "../data/database";
import { PrayerRepository } from "../data/repositories/prayers";
import { ReflectionRepository } from "../data/repositories/reflections";
import { todayLocalDate } from "../domain/time";
import type { Reflection, ScriptureLink, ScriptureReference } from "../domain/types";
import { parsePendingScripture } from "../reflection/context";
import { loadBibleManifest } from "../scripture/loader";
import type { BibleManifest } from "../scripture/types";
import { prayerReferenceLabel } from "./references";

const prayers = new PrayerRepository(db);
const reflections = new ReflectionRepository(db);

function uniqueReferences(items: ScriptureReference[]): ScriptureReference[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.translationId}|${item.startVerseKey}|${item.endVerseKey}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function NewPrayerScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sourceReflectionId = params.get("sourceReflectionId");
  const pending = useMemo(() => parsePendingScripture(params), [params]);
  const returnParam = params.get("return");
  const [sourceReflection, setSourceReflection] = useState<Reflection | null>(null);
  const [sourceLinks, setSourceLinks] = useState<ScriptureLink[]>([]);
  const [manifest, setManifest] = useState<BibleManifest | null>(null);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadBibleManifest(),
      sourceReflectionId ? reflections.getById(sourceReflectionId) : Promise.resolve(undefined),
    ]).then(async ([nextManifest, reflection]) => {
      const links = reflection ? await reflections.listScriptureLinks(reflection.id) : [];
      if (!cancelled) {
        setManifest(nextManifest);
        setSourceReflection(reflection ?? null);
        setSourceLinks(links);
      }
    }).catch((reason: unknown) => {
      if (!cancelled) setStatus(reason instanceof Error ? reason.message : "Could not load prayer context.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sourceReflectionId]);

  const references = useMemo(() => uniqueReferences([
    ...sourceLinks.map((item) => ({ translationId: item.translationId, startVerseKey: item.startVerseKey, endVerseKey: item.endVerseKey })),
    ...(pending ? [pending] : []),
  ]), [pending, sourceLinks]);

  const backTarget = returnParam?.startsWith("/")
    ? returnParam
    : sourceReflection
      ? `/today/reflection/${sourceReflection.localDate}`
      : "/prayer";

  const create = async () => {
    try {
      const prayer = await prayers.createPrayer({
        body,
        sourceReflectionId: sourceReflection?.id ?? null,
        sourceDevotionDate: sourceReflection?.localDate ?? (pending ? todayLocalDate() : null),
        scriptureReferences: references,
      });
      navigate(`/prayer/${prayer.id}`, { replace: true });
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : "Could not save prayer.");
    }
  };

  if (loading) return <main className="visual-screen prayer-new-screen"><p className="eyebrow">Quick Add</p><p>Opening prayer capture…</p></main>;

  return (
    <main className="visual-screen prayer-new-screen">
      <header className="screen-heading compact-heading">
        <p className="eyebrow">Quick Add</p>
        <h1>Add prayer</h1>
        <p className="screen-intro">Capture the request first. People, categories, schedules and event rules arrive later; the prayer itself is the only required field.</p>
        <Link className="quiet-back-link" to={backTarget}>← Back</Link>
      </header>

      <div className="prayer-capture-layout">
        <section className="prayer-capture-editor">
          <label htmlFor="prayer-body">What do you want to pray about?</label>
          <textarea id="prayer-body" autoFocus value={body} onChange={(event) => { setBody(event.target.value); setStatus(""); }} placeholder="Write the request in your own words." />
          <div className="prayer-capture-actions">
            <button className="primary-editorial-action compact-action" type="button" disabled={!body.trim()} onClick={() => void create()}>Save prayer</button>
            <Link to={backTarget}>Cancel</Link>
          </div>
          <p className="prayer-form-status" aria-live="polite">{status}</p>
        </section>

        <aside className="prayer-source-context">
          <p className="section-kicker">Source context</p>
          {sourceReflection ? <><h2>From your {sourceReflection.localDate} reflection</h2><blockquote>{sourceReflection.bodyMd}</blockquote></> : pending ? <h2>From Scripture</h2> : <><h2>No source required.</h2><p className="muted-copy">A standalone prayer is fully valid. Context is attached only when it already exists.</p></>}
          {references.length ? <div className="prayer-source-links">{references.map((reference) => <span key={`${reference.startVerseKey}-${reference.endVerseKey}`}>{prayerReferenceLabel(reference, manifest)}</span>)}</div> : null}
        </aside>
      </div>
    </main>
  );
}
