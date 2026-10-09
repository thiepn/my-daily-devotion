import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { RememberSuggestions } from "../history/RememberChoices";
import { DevotionalIcon } from "../app/visual/DevotionalIcon";
import { TodayVerse } from "./TodayVerse";
import { MorningGraceArtwork } from "../app/visual/MorningGraceArtwork";
import { useLocalClock } from "../app/useLocalClock";
import { useMutation } from "../app/useMutation";
import { PlanSetup } from "./PlanSetup";
import { readPlanJournal, greeting } from "./journal-model";
import { usePrayerRead } from "../prayer/detail-hooks";
import type { LocalDate, PlanEnrollment, ReadingProgress } from "../domain/types";
import { TodayPrayerPanel } from "../prayer/TodayPrayerPanel";
import { TodayReflectionPanel } from "../reflection/TodayReflectionPanel";
import { assignmentForCalendarDate } from "./calendar";
import { buildPlanReadingUrl } from "./context";
import { loadMcheynePlan } from "./loader";
import { McheyneRepository } from "./repository";
import type { AssignmentProgressSummary, McheyneAssignment, McheynePlan } from "./types";

const repository = new McheyneRepository();

function key(sequence: number, readingIndex: number): string {
  return `${sequence}:${readingIndex}`;
}

export function TodayScreen() {
  const { localDate: today, hour } = useLocalClock();
  const location = useLocation();
  const { busy, status, failed, run } = useMutation();
  const read = usePrayerRead('today-plan:' + today, () => readPlanJournal(today));
  // Plan and greeting are read from one consistent, reactive IndexedDB snapshot.
  const plan = read.data?.plan ?? null, enrollment = read.data?.enrollment ?? null;
  const assignment = enrollment ? read.data?.assignment ?? null : null;
  const progress = read.data?.progress ?? new Map();
  const earlierUnread = read.data?.earlierUnread ?? [];
  const loading = !read.data && !read.error, error = read.error;
  const refresh = async () => read.retry();

  const completedCount = assignment
    ? [0, 1, 2, 3].filter((index) => progress.get(key(assignment.sequence, index))?.completedAt).length
    : 0;
  const firstIncompleteIndex = assignment
    ? [0, 1, 2, 3].find((index) => !progress.get(key(assignment.sequence, index))?.completedAt) ?? null
    : null;
  const unreadReadingCount = useMemo(
    () => earlierUnread.reduce((sum, item) => sum + (4 - item.completedCount), 0),
    [earlierUnread],
  );

  const toggleReading = async (readingIndex: number) => {
    if (!enrollment || !assignment) return;
    const done = Boolean(progress.get(key(assignment.sequence, readingIndex))?.completedAt);
    await repository.setReadingCompleted(enrollment.id, assignment.sequence, readingIndex, !done, today);
    await refresh();
  };


  const previewAssignment = assignment ?? (plan ? assignmentForCalendarDate(plan, today) : null);
  const previewReading = previewAssignment?.readings.find(reading => reading.references[0]?.startVerseKey.startsWith("PSA.")) ?? previewAssignment?.readings[firstIncompleteIndex ?? 0];
  const isLeapPause = enrollment?.mode === "CALENDAR" && assignment === null && today.slice(5) === "02-29";
  const planComplete = enrollment?.mode === "SELF_PACED" && assignment === null;
  const devotionalHref = assignment && enrollment && firstIncompleteIndex !== null
    ? buildPlanReadingUrl(assignment.readings[firstIncompleteIndex]!, enrollment.id, assignment.sequence, firstIncompleteIndex, "today")
    : `/today/reflection/${today}`;

  if (loading || error) {
    return <main className="grace-today today-recovery"><h1>Today</h1><p role={error ? "alert" : "status"}>{error ?? "Opening today’s devotion…"}</p>{error ? <button className="quiet-button" onClick={() => void refresh()}>Try again</button> : null}</main>;
  }

  return <main className="grace-today">
    <header className="today-opening">
      <MorningGraceArtwork />
      <h1>{greeting(hour)},<br />{read.data?.preference.name || "Friend"}.</h1>
      <p>{hour < 12 ? "A new day. A fresh opportunity" : "A quiet moment. A fresh opportunity"}<br />to walk with God.</p>
      <Link className="today-profile" to="/data?return=%2Ftoday" aria-label="Data and settings"><DevotionalIcon name="profile" /></Link>
    </header>
    <div className="today-journal">
      <TodayVerse reference={previewReading?.references[0]} today={today} />
      <p className="today-status" role={failed ? "alert" : "status"}>{busy ? "Saving…" : status}</p>
      {!enrollment ? plan && <PlanSetup plan={plan} today={today} onSaved={read.retry} introduction={!read.data?.preference.dismissed} /> : <section className="today-plan" aria-labelledby="reading-heading">
        <div className="today-section-heading"><h2 id="reading-heading">Today’s Reading Plan</h2><span>{assignment ? `Day ${assignment.sequence}` : "M’Cheyne"}</span></div>
        {assignment ? <details className="today-plan-card grace-paper">
          <summary aria-label={`View Day ${assignment.sequence} readings`}>
            <span className="grace-icon-circle"><DevotionalIcon name="plan" /></span>
            <span><strong className="today-plan-title">My Daily Plan</strong><span className="today-plan-references">{assignment.readings.map(reading => reading.displayReference).join(" · ")}</span>{completedCount > 0 ? <span className="today-plan-references">{completedCount} of 4</span> : null}</span>
            <DevotionalIcon name="chevron" className="today-plan-chevron" />
          </summary>
          <div className="today-reading-list">
            <p>M’Cheyne · {enrollment.mode === "CALENDAR" ? "Calendar" : "Self-paced"}</p>
            {assignment.readings.map((reading, index) => {
              const done = Boolean(progress.get(key(assignment.sequence, index))?.completedAt);
              return <div className="today-reading-row" key={`${assignment.sequence}-${index}`}>
                <button className="today-reading-check" type="button" disabled={busy} aria-pressed={done} aria-label={`${done ? "Mark unread" : "Mark complete"}: ${reading.displayReference}`} onClick={() => void run(() => toggleReading(index))}>{done ? <DevotionalIcon name="check" /> : <span className="sr-only">Unread</span>}</button>
                <Link className="reading-passage" to={buildPlanReadingUrl(reading, enrollment.id, assignment.sequence, index, "today")}><small>{reading.group === "family" ? "Family" : "Private"}</small><strong>{reading.displayReference}</strong></Link>
              </div>;
            })}
            {completedCount === 4 ? <p>Today’s M’Cheyne readings are complete.</p> : null}
            <Link className="today-plan-link" to="/today/plan">Open full plan</Link>
            {earlierUnread.length ? <p>{unreadReadingCount} earlier unread {unreadReadingCount === 1 ? "reading" : "readings"} across {earlierUnread.length} {earlierUnread.length === 1 ? "day" : "days"}. Available when you want them.</p> : null}
          </div>
        </details> : <div className="today-note grace-paper">
          {isLeapPause ? <><strong>Leap-day pause</strong><p>No canonical M’Cheyne assignment exists for February 29. March 1 keeps its historical assignment.</p></> : planComplete ? <><strong>All 365 assignments are complete.</strong><p>Your readings remain available in the plan and History.</p></> : <p>Your reading plan is ready to explore.</p>}
          <Link className="today-plan-link" to="/today/plan">Open full plan</Link>
        </div>}
      </section>}
      <section className="today-responses" aria-label="Reflect and pray">
        <TodayReflectionPanel localDate={today} />
        <TodayPrayerPanel />
      </section>
      {enrollment ? <Link className="grace-primary today-devotion" to={devotionalHref}>{assignment && firstIncompleteIndex !== null ? completedCount ? "Continue Today’s Devotion" : "Begin Today’s Devotion" : "Reflect on Today’s Reading"}<DevotionalIcon name="arrow" /></Link> : null}
    </div>
    <RememberSuggestions url={location.pathname + location.search} />
  </main>;
}
