import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { db } from "../data/database";
import { ReflectionRepository } from "../data/repositories/reflections";
import type { Reflection, ScriptureLink } from "../domain/types";

const repository = new ReflectionRepository(db);

export function PrayerHandoffScreen() {
  const [params] = useSearchParams();
  const reflectionId = params.get("sourceReflectionId");
  const [reflection, setReflection] = useState<Reflection | null>(null);
  const [links, setLinks] = useState<ScriptureLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!reflectionId) { setLoading(false); return; }
    repository.getById(reflectionId).then(async (value) => {
      const nextLinks = value ? await repository.listScriptureLinks(value.id) : [];
      if (!cancelled) { setReflection(value ?? null); setLinks(nextLinks); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [reflectionId]);

  if (loading) return <main className="visual-screen"><p className="eyebrow">Prayer handoff</p><p>Loading source reflection…</p></main>;
  if (!reflection) return <main className="visual-screen"><p className="eyebrow">Prayer handoff</p><h1>Source unavailable</h1><Link to="/prayer">Return to Prayer</Link></main>;

  return (
    <main className="visual-screen prayer-handoff-screen">
      <header className="screen-heading compact-heading">
        <p className="eyebrow">Reflection → Prayer</p>
        <h1>Carry it into prayer.</h1>
        <p className="screen-intro">The source context is preserved now so Phase 6 can create the prayer without losing where it came from.</p>
      </header>
      <section className="prayer-handoff-source">
        <p className="section-kicker">Source reflection · {reflection.localDate}</p>
        <blockquote>{reflection.bodyMd}</blockquote>
        <p>{links.length} linked Scripture {links.length === 1 ? "passage" : "passages"} will remain available to the prayer flow.</p>
      </section>
      <div className="prayer-handoff-actions">
        <button type="button" disabled>Create prayer · Phase 6</button>
        <Link to={`/today/reflection/${reflection.localDate}`}>Back to reflection</Link>
      </div>
    </main>
  );
}
