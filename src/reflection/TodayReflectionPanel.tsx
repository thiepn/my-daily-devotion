import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../data/database";
import { ReflectionRepository } from "../data/repositories/reflections";
import type { LocalDate, Reflection } from "../domain/types";
import { buildReflectionUrl } from "./context";

const repository = new ReflectionRepository(db);

function excerpt(markdown: string): string {
  return markdown.replace(/[#>*_`\[\]()~-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 220);
}

export function TodayReflectionPanel({ localDate }: { localDate: LocalDate }) {
  const [reflection, setReflection] = useState<Reflection | null>(null);
  const [linkCount, setLinkCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    repository.getDaily(localDate).then(async (value) => {
      const links = value ? await repository.listScriptureLinks(value.id) : [];
      if (!cancelled) {
        setReflection(value ?? null);
        setLinkCount(links.length);
      }
    });
    return () => { cancelled = true; };
  }, [localDate]);

  return (
    <section className="editorial-section reflection-preview live-reflection-preview" aria-labelledby="reflection-heading">
      <p className="section-kicker">Respond</p>
      <h2 id="reflection-heading">{reflection ? "Today’s reflection" : "Reflection stays optional."}</h2>
      {reflection ? (
        <>
          <p className="reflection-excerpt">{excerpt(reflection.bodyMd)}{reflection.bodyMd.length > 220 ? "…" : ""}</p>
          <p className="reflection-meta">Saved locally{linkCount ? ` · ${linkCount} linked Scripture ${linkCount === 1 ? "passage" : "passages"}` : ""}</p>
          <Link className="future-text-link" to={buildReflectionUrl(localDate)}>Continue reflection →</Link>
        </>
      ) : (
        <>
          <p className="muted-copy">Write one sentence or several pages. Nothing here is required for the day to count.</p>
          <Link className="future-text-link" to={buildReflectionUrl(localDate)}>Write reflection →</Link>
        </>
      )}
    </section>
  );
}
