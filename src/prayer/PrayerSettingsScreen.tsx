import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { db } from "../data/database";
import { CategoryRepository, PersonRepository } from "../data/repositories/prayer-metadata";
import { PrayerRepository } from "../data/repositories/prayers";
import type { Category, Person, Prayer } from "../domain/types";
import { administrationInputFromValue, administrationValueFrom, PrayerAdministrationFields, type PrayerAdministrationValue } from "./PrayerAdministrationFields";

const prayers = new PrayerRepository(db); const peopleRepository = new PersonRepository(db); const categoriesRepository = new CategoryRepository(db);
export function PrayerSettingsScreen() {
  const { prayerId = "" } = useParams(); const navigate = useNavigate(); const [prayer, setPrayer] = useState<Prayer | null>(null); const [people, setPeople] = useState<Person[]>([]); const [categories, setCategories] = useState<Category[]>([]); const [value, setValue] = useState<PrayerAdministrationValue | null>(null); const [status, setStatus] = useState("");
  useEffect(() => { let cancelled = false; Promise.all([prayers.get(prayerId), prayers.getScheduleForPrayer(prayerId), peopleRepository.list(), categoriesRepository.list()]).then(([item, schedule, nextPeople, nextCategories]) => { if (!cancelled) { setPrayer(item ?? null); setPeople(nextPeople); setCategories(nextCategories); if (item) setValue(administrationValueFrom(item, schedule)); } }); return () => { cancelled = true; }; }, [prayerId]);
  if (!prayer || !value) return <main className="visual-screen"><p className="eyebrow">Prayer details</p><p>Opening prayer details…</p></main>;
  const save = async () => { try { await prayers.updateAdministration(prayer.id, administrationInputFromValue(value)); navigate(`/prayer/${prayer.id}`, { replace: true }); } catch (reason) { setStatus(reason instanceof Error ? reason.message : "Could not save prayer details."); } };
  return <main className="visual-screen prayer-settings-screen"><header className="screen-heading compact-heading"><p className="eyebrow">Prayer administration</p><h1>Prayer details</h1><p className="screen-intro">Use these only when they reduce future administration. Focus is temporary; schedules create no missed-day debt.</p><Link className="quiet-back-link" to={`/prayer/${prayer.id}`}>← Back to prayer</Link></header><section className="prayer-settings-panel"><PrayerAdministrationFields value={value} people={people} categories={categories} onChange={setValue} /><div className="metadata-manage-links"><Link to="/prayer/people">Manage people</Link><Link to="/prayer/categories">Manage categories</Link></div><div className="prayer-settings-actions"><button className="primary-editorial-action compact-action" type="button" onClick={() => void save()}>Save details</button><Link to={`/prayer/${prayer.id}`}>Cancel</Link></div><p className="prayer-form-status" aria-live="polite">{status}</p></section></main>;
}
