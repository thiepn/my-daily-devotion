import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useUnsavedChanges } from "../app/useUnsavedChanges";
import { db } from "../data/database";
import { CategoryRepository, PersonRepository } from "../data/repositories/prayer-metadata";
import { PrayerRepository } from "../data/repositories/prayers";
import type { Category, Person, Prayer } from "../domain/types";
import { administrationInputFromValue, administrationValueFrom, PrayerAdministrationFields, type PrayerAdministrationValue } from "./PrayerAdministrationFields";

const prayers = new PrayerRepository(db); const peopleRepository = new PersonRepository(db); const categoriesRepository = new CategoryRepository(db);
export function PrayerSettingsScreen() {
  const { prayerId = "" } = useParams(); const navigate = useNavigate(); const [prayer, setPrayer] = useState<Prayer | null>(null); const [people, setPeople] = useState<Person[]>([]); const [categories, setCategories] = useState<Category[]>([]); const [value, setValue] = useState<PrayerAdministrationValue | null>(null); const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true); const baseline = useRef(""); const saving = useRef(false);
  const allowNavigation = useUnsavedChanges(Boolean(value && baseline.current && JSON.stringify(value) !== baseline.current));
  useEffect(() => { let cancelled = false; Promise.all([prayers.get(prayerId), prayers.getScheduleForPrayer(prayerId), peopleRepository.list(), categoriesRepository.list()]).then(([item, schedule, nextPeople, nextCategories]) => { if (!cancelled) { setPrayer(item ?? null); setPeople(nextPeople); setCategories(nextCategories); if (item) { const next = administrationValueFrom(item, schedule); baseline.current = JSON.stringify(next); setValue(next); } } }).catch(() => { if (!cancelled) setStatus("Could not open prayer details. Please try again."); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, [prayerId]);
  if (!loading && (!prayer || !value)) return <main className="visual-screen"><h1>Prayer unavailable</h1><p>{status || "This prayer may have been removed."}</p><Link to="/prayer">Return to Prayer</Link></main>;
  if (!prayer || !value) return <main className="visual-screen"><p className="eyebrow">Prayer details</p><p>Opening prayer details…</p></main>;
  const save = async () => { if (saving.current) return; saving.current = true; try { await prayers.updateAdministration(prayer.id, administrationInputFromValue(value)); allowNavigation(); navigate(`/prayer/${prayer.id}`, { replace: true }); } catch (reason) { setStatus(reason instanceof Error ? reason.message : "Could not save prayer details."); } finally { saving.current = false; } };
  return <main className="visual-screen prayer-settings-screen"><header className="screen-heading compact-heading"><p className="eyebrow">Prayer</p><h1>Prayer details</h1><p className="screen-intro">Choose when this prayer appears and who it is for.</p><Link className="quiet-back-link" to={`/prayer/${prayer.id}`}>← Back to prayer</Link></header><section className="prayer-settings-panel"><PrayerAdministrationFields value={value} people={people} categories={categories} onChange={setValue} /><div className="metadata-manage-links"><Link to="/prayer/people">Manage people</Link><Link to="/prayer/categories">Manage categories</Link></div><div className="prayer-settings-actions"><button className="primary-editorial-action compact-action" type="button" onClick={() => void save()}>Save details</button><Link to={`/prayer/${prayer.id}`}>Cancel</Link></div><p className="prayer-form-status" aria-live="polite">{status}</p></section></main>;
}
