import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "../app/visual/Icon";
import { db } from "../data/database";
import { PrayerRepository } from "../data/repositories/prayers";
import type { Prayer, PrayerUpdate, ScriptureLink } from "../domain/types";
import { loadBibleManifest } from "../scripture/loader";
import type { BibleManifest } from "../scripture/types";
import { prayerBibleHref, prayerReferenceLabel } from "./references";

const repository = new PrayerRepository(db);
const depthCounts = { quick: 4, regular: 10, extended: 20 } as const;
type Depth = keyof typeof depthCounts;

export function PrayerSessionScreen() {
  const [params] = useSearchParams();
  const requested = params.get("depth") as Depth | null;
  const depth: Depth = requested && requested in depthCounts ? requested : "quick";
  const [queue, setQueue] = useState<Prayer[]>([]);
  const [index, setIndex] = useState(0);
  const [updates, setUpdates] = useState<PrayerUpdate[]>([]);
  const [links, setLinks] = useState<ScriptureLink[]>([]);
  const [manifest, setManifest] = useState<BibleManifest | null>(null);
  const [answerOpen, setAnswerOpen] = useState(false);
  const [answerBody, setAnswerBody] = useState("");
  const [loading, setLoading] = useState(true);
  const current = queue[index] ?? null;

  useEffect(() => {
    let cancelled = false;
    Promise.all([repository.rotationQueue(depthCounts[depth]), loadBibleManifest()]).then(([nextQueue, nextManifest]) => {
      if (!cancelled) { setQueue(nextQueue); setManifest(nextManifest); setIndex(0); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [depth]);

  useEffect(() => {
    let cancelled = false;
    if (!current) { setUpdates([]); setLinks([]); return () => { cancelled = true; }; }
    Promise.all([repository.listUpdates(current.id), repository.listScriptureLinks(current.id)]).then(([nextUpdates, nextLinks]) => {
      if (!cancelled) { setUpdates(nextUpdates); setLinks(nextLinks); setAnswerOpen(false); setAnswerBody(""); }
    });
    return () => { cancelled = true; };
  }, [current]);

  const latestUpdate = useMemo(() => updates.at(-1) ?? null, [updates]);
  const advance = async (prayed: boolean) => { if (!current) return; if (prayed) await repository.markPrayed(current.id); setIndex((value) => value + 1); };
  const answer = async () => { if (!current) return; await repository.answer(current.id, answerBody); setIndex((value) => value + 1); };

  if (loading) return <main className="visual-screen focused-prayer-screen"><p className="eyebrow">Focused prayer</p><p>Preparing a quiet session…</p></main>;
  if (queue.length === 0) return <main className="visual-screen focused-prayer-screen"><p className="eyebrow">Focused prayer</p><h1>No active prayers</h1><p className="screen-intro">Add a request first. Waiting, answered and archived prayers are not surfaced here.</p><Link className="future-text-link" to="/prayer/new">Add prayer →</Link></main>;
  if (!current) return <main className="visual-screen focused-prayer-screen"><p className="eyebrow">Focused prayer</p><h1>Session finished.</h1><p className="screen-intro">There is nothing to score or complete. Return whenever you want to pray again.</p><Link className="future-text-link" to="/prayer">Return to Prayer →</Link></main>;

  return (
    <main className="visual-screen focused-prayer-screen">
      <header className="focused-prayer-header"><Link to="/prayer">Exit</Link><span>{index + 1} / {queue.length}</span><span>{depth}</span></header>
      <article className="focused-prayer-card">
        <p className="section-kicker">Prayer</p><h1>{current.body}</h1>
        {latestUpdate ? <div className={latestUpdate.type === "encouragement" ? "focused-latest is-encouragement" : "focused-latest"}><span>Latest {latestUpdate.type}</span><p>{latestUpdate.body}</p></div> : null}
        {links.length ? <div className="focused-scripture">{links.map((link) => <Link key={link.id} to={prayerBibleHref(link)}>{prayerReferenceLabel(link, manifest)}</Link>)}</div> : null}
        {answerOpen ? <div className="focused-answer-form"><label htmlFor="focused-answer">What happened? <span>optional</span></label><textarea id="focused-answer" value={answerBody} onChange={(event) => setAnswerBody(event.target.value)} /><div><button type="button" onClick={() => void answer()}>Mark answered</button><button type="button" onClick={() => setAnswerOpen(false)}>Cancel</button></div></div> : null}
        <div className="focused-prayer-secondary"><Link to={`/prayer/${current.id}`}>Update / details</Link><button type="button" onClick={() => setAnswerOpen(true)}>Answered</button><button type="button" onClick={() => void advance(false)}>Skip</button></div>
        <button className="focused-next-button" type="button" onClick={() => void advance(true)}>Next <Icon name="arrow" /></button>
      </article>
    </main>
  );
}
