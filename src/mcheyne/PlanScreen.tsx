import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../app/visual/Icon";
import { todayLocalDate } from "../domain/time";
import type { LocalDate, PlanEnrollment, ReadingProgress } from "../domain/types";
import { calendarYear, monthForCalendarKey, sequenceOnOrBefore } from "./calendar";
import { buildPlanReadingUrl } from "./context";
import { loadMcheynePlan } from "./loader";
import { McheyneRepository } from "./repository";
import type { McheynePlan } from "./types";

const repository = new McheyneRepository();
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function key(sequence: number, readingIndex: number): string { return `${sequence}:${readingIndex}`; }

export function PlanScreen() {
  const today = todayLocalDate();
  const [plan, setPlan] = useState<McheynePlan | null>(null);
  const [enrollment, setEnrollment] = useState<PlanEnrollment | null>(null);
  const [progress, setProgress] = useState<Map<string, ReadingProgress>>(new Map());
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [importDate, setImportDate] = useState<LocalDate>(today);
  const [currentSelfPaced, setCurrentSelfPaced] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const nextPlan = await loadMcheynePlan();
      const nextEnrollment = await repository.getActiveEnrollment(today);
      setPlan(nextPlan);
      setEnrollment(nextEnrollment ?? null);
      if (nextEnrollment) {
        setProgress(await repository.completionMap(nextEnrollment.id));
        if (nextEnrollment.mode === "SELF_PACED") {
          const sequence = await repository.getCurrentSelfPacedSequence(nextPlan, nextEnrollment);
          setCurrentSelfPaced(sequence);
          if (sequence) setMonth(monthForCalendarKey(nextPlan.assignments[sequence - 1]!.calendarKey));
        }
      }
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load the plan.");
    }
  }, [today]);

  useEffect(() => { void refresh(); }, [refresh]);

  const monthAssignments = useMemo(
    () => plan?.assignments.filter((assignment) => monthForCalendarKey(assignment.calendarKey) === month) ?? [],
    [month, plan],
  );
  const totalCompleted = [...progress.values()].filter((item) => item.completedAt !== null).length;

  const importThrough = async () => {
    if (!plan || !enrollment || enrollment.mode !== "CALENDAR") return;
    const through = sequenceOnOrBefore(plan, importDate);
    if (!through) return;
    await repository.bulkImportThrough(enrollment.id, through);
    await refresh();
  };

  if (error) return <main className="visual-screen plan-screen"><p className="eyebrow">M’Cheyne plan</p><p role="alert">{error}</p></main>;
  if (!plan) return <main className="visual-screen plan-screen"><p className="eyebrow">M’Cheyne plan</p><p>Opening the plan…</p></main>;
  if (!enrollment) return <main className="visual-screen plan-screen"><p className="eyebrow">M’Cheyne plan</p><h1>Reading plan</h1><p>Set up the plan from Today first.</p><Link to="/today" className="future-action">Go to Today <Icon name="arrow" /></Link></main>;

  return (
    <main className="visual-screen plan-screen">
      <header className="screen-heading compact-heading">
        <p className="eyebrow">M’Cheyne · {enrollment.mode === "CALENDAR" ? "Calendar" : "Self-paced"}</p>
        <h1>Reading plan</h1>
        <p className="screen-intro">Review earlier readings or read ahead without changing what Today means. Completion is always explicit.</p>
      </header>

      <div className="plan-summary">
        <div><strong>{totalCompleted}</strong><span>of 1,460 readings marked complete</span></div>
        <div><strong>{Math.round((totalCompleted / 1460) * 100)}%</strong><span>factual plan progress</span></div>
        <Link to="/today">Back to Today</Link>
      </div>

      <section className="plan-calendar" aria-labelledby="plan-calendar-heading">
        <div className="section-heading-line plan-month-heading">
          <div><p className="section-kicker">365 assignments</p><h2 id="plan-calendar-heading">{monthNames[month - 1]}</h2></div>
          <select aria-label="Choose month" value={month} onChange={(event) => setMonth(Number(event.target.value))}>
            {monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
          </select>
        </div>

        <div className="plan-day-list">
          {monthAssignments.map((assignment) => {
            const completedCount = [0, 1, 2, 3].filter((index) => progress.get(key(assignment.sequence, index))?.completedAt).length;
            const todayKey = today.slice(5);
            const current = enrollment.mode === "CALENDAR" ? assignment.calendarKey === todayKey : assignment.sequence === currentSelfPaced;
            return (
              <article className={`plan-day${current ? " is-current" : ""}`} key={assignment.sequence}>
                <div className="plan-day-meta"><span>Day {assignment.sequence}</span><strong>{assignment.calendarKey}</strong><small>{completedCount}/4</small></div>
                <div className="plan-day-readings">
                  {assignment.readings.map((reading, readingIndex) => {
                    const done = Boolean(progress.get(key(assignment.sequence, readingIndex))?.completedAt);
                    return <Link className={done ? "is-complete" : ""} key={readingIndex} to={buildPlanReadingUrl(reading, enrollment.id, assignment.sequence, readingIndex, "plan")}><span>{reading.group === "family" ? "Family" : "Private"}</span><strong>{reading.displayReference}</strong>{done ? <Icon name="check" /> : <Icon name="arrow" />}</Link>;
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {enrollment.mode === "CALENDAR" ? (
        <section className="plan-import editorial-section">
          <div><p className="section-kicker">Progress import</p><h2>Already read more this year?</h2><p>Mark all four readings through a date as complete without creating fake history entries. You can still undo individual readings later.</p></div>
          <div className="import-controls">
            <input type="date" min={`${calendarYear(today)}-01-01`} max={today} value={importDate} onChange={(event) => setImportDate(event.target.value as LocalDate)} />
            <button type="button" onClick={() => void importThrough()}>Import through date</button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
