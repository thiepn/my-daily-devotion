import type { Category, LocalDate, Person, Prayer, PrayerSchedule, PrayerScheduleMode, UUID } from "../domain/types";
import { todayLocalDate } from "../domain/time";
import type { PrayerAdministrationInput } from "../data/repositories/prayers";

export interface PrayerAdministrationValue {
  personId: UUID | null;
  categoryId: UUID | null;
  scheduleMode: PrayerScheduleMode;
  weekdays: number[];
  intervalDays: string;
  anchorDate: string;
  monthlyDay: string;
  onDate: string;
  eventDate: string;
  focusUntil: string;
}

const weekdayOptions = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [7, "Sun"]] as const;

export function blankPrayerAdministration(anchorDate = todayLocalDate()): PrayerAdministrationValue {
  return { personId: null, categoryId: null, scheduleMode: "ROTATION", weekdays: [], intervalDays: "3", anchorDate, monthlyDay: "1", onDate: anchorDate, eventDate: "", focusUntil: "" };
}

export function administrationValueFrom(prayer: Prayer, schedule: PrayerSchedule | null): PrayerAdministrationValue {
  return {
    personId: prayer.personId,
    categoryId: prayer.categoryId,
    scheduleMode: schedule?.mode ?? "ROTATION",
    weekdays: schedule?.weekdays ?? [],
    intervalDays: String(schedule?.intervalDays ?? 3),
    anchorDate: schedule?.anchorDate ?? todayLocalDate(),
    monthlyDay: String(schedule?.monthlyDay ?? 1),
    onDate: schedule?.onDate ?? todayLocalDate(),
    eventDate: prayer.eventDate ?? "",
    focusUntil: prayer.focusUntil ?? "",
  };
}

function dateOrNull(value: string): LocalDate | null { return value ? value as LocalDate : null; }

export function administrationInputFromValue(value: PrayerAdministrationValue): PrayerAdministrationInput {
  let schedule: PrayerAdministrationInput["schedule"] = null;
  if (value.scheduleMode === "DAILY" || value.scheduleMode === "MANUAL_ONLY") schedule = { mode: value.scheduleMode };
  if (value.scheduleMode === "WEEKDAYS") schedule = { mode: "WEEKDAYS", weekdays: value.weekdays };
  if (value.scheduleMode === "INTERVAL_DAYS") schedule = { mode: "INTERVAL_DAYS", intervalDays: Number(value.intervalDays), anchorDate: dateOrNull(value.anchorDate) };
  if (value.scheduleMode === "MONTHLY") schedule = { mode: "MONTHLY", monthlyDay: Number(value.monthlyDay) };
  if (value.scheduleMode === "ON_DATE") schedule = { mode: "ON_DATE", onDate: dateOrNull(value.onDate) };
  return { personId: value.personId, categoryId: value.categoryId, eventDate: dateOrNull(value.eventDate), focusUntil: dateOrNull(value.focusUntil), schedule };
}

export function PrayerAdministrationFields({ value, people, categories, onChange }: { value: PrayerAdministrationValue; people: Person[]; categories: Category[]; onChange: (next: PrayerAdministrationValue) => void }) {
  const set = (patch: Partial<PrayerAdministrationValue>) => onChange({ ...value, ...patch });
  const toggleWeekday = (day: number) => set({ weekdays: value.weekdays.includes(day) ? value.weekdays.filter((item) => item !== day) : [...value.weekdays, day].sort((a, b) => a - b) });
  return (
    <div className="prayer-administration-fields">
      <div className="prayer-field-grid">
        <label><span>Person <small>optional</small></span><select value={value.personId ?? ""} onChange={(event) => set({ personId: event.target.value || null })}><option value="">No person</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
        <label><span>Category <small>optional</small></span><select value={value.categoryId ?? ""} onChange={(event) => set({ categoryId: event.target.value || null })}><option value="">No category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      </div>

      <label className="schedule-field"><span>Schedule</span><select value={value.scheduleMode} onChange={(event) => set({ scheduleMode: event.target.value as PrayerScheduleMode })}>
        <option value="ROTATION">Normal rotation</option><option value="DAILY">Daily</option><option value="WEEKDAYS">Selected weekdays</option><option value="INTERVAL_DAYS">Every N days</option><option value="MONTHLY">Monthly</option><option value="ON_DATE">One specific date</option><option value="MANUAL_ONLY">Manual only</option>
      </select></label>
      {value.scheduleMode === "WEEKDAYS" ? <div className="weekday-picker" aria-label="Scheduled weekdays">{weekdayOptions.map(([day, label]) => <label key={day}><input type="checkbox" checked={value.weekdays.includes(day)} onChange={() => toggleWeekday(day)} /><span>{label}</span></label>)}</div> : null}
      {value.scheduleMode === "INTERVAL_DAYS" ? <div className="prayer-field-grid"><label><span>Every</span><input type="number" min="1" max="3650" value={value.intervalDays} onChange={(event) => set({ intervalDays: event.target.value })} /></label><label><span>Starting</span><input type="date" value={value.anchorDate} onChange={(event) => set({ anchorDate: event.target.value })} /></label></div> : null}
      {value.scheduleMode === "MONTHLY" ? <label><span>Day of month</span><input type="number" min="1" max="31" value={value.monthlyDay} onChange={(event) => set({ monthlyDay: event.target.value })} /></label> : null}
      {value.scheduleMode === "ON_DATE" ? <label><span>Date</span><input type="date" value={value.onDate} onChange={(event) => set({ onDate: event.target.value })} /></label> : null}
      <p className="field-help">Scheduled prayers surface only when due on the current local date. Missed dates do not create overdue prayer debt.</p>

      <div className="prayer-field-grid">
        <label><span>Event date <small>optional</small></span><input type="date" value={value.eventDate} onChange={(event) => set({ eventDate: event.target.value })} /><small>Boosts the day before, the day itself, and one follow-up day.</small></label>
        <label><span>Focus until <small>optional</small></span><input type="date" value={value.focusUntil} onChange={(event) => set({ focusUntil: event.target.value })} /><small>Temporarily keeps this request near the front. It is not a priority score.</small></label>
      </div>
    </div>
  );
}
