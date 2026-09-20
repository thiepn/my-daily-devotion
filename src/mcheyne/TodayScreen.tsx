import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../app/visual/Icon";
import { MorningLandscape, SunriseOrnament } from "../app/visual/MorningGraceMotifs";
import { useLocalClock } from "../app/useLocalClock";
import { useMutation } from "../app/useMutation";
import { validateCompletedThroughDate } from "./import-date";
import type { LocalDate, PlanEnrollment, ReadingProgress } from "../domain/types";
import { TodayPrayerPanel } from "../prayer/TodayPrayerPanel";
import { TodayReflectionPanel } from "../reflection/TodayReflectionPanel";
import { assignmentForCalendarDate, calendarYear, sequenceOnOrAfter, sequenceOnOrBefore } from "./calendar";
import { buildPlanReadingUrl } from "./context";
import { loadMcheynePlan } from "./loader";
import { McheyneRepository } from "./repository";
import type { AssignmentProgressSummary, McheyneAssignment, McheynePlan } from "./types";

const repository = new McheyneRepository();

function key(sequence: number, readingIndex: number): string {
  return `${sequence}:${readingIndex}`;
}

function formatDate(localDate: LocalDate): string {
  const [year, month, day] = localDate.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" })
    .format(new Date(year!, month! - 1, day!, 12));
}

function TodayHero({ today, intro }: { today: LocalDate; intro: string }) {
  return (
    <header className="mg-canonical-hero mg-today-hero">
      <div className="mg-hero-copy">
        <p className="eyebrow">{formatDate(today)}</p>
        <p className="mg-hero-greeting">Good morning.</p>
        <h1>Today</h1>
        <p className="screen-intro">{intro}</p>
        <SunriseOrnament className="mg-hero-ornament" />
      </div>
      <div className="mg-hero-art" aria-hidden="true">
        <MorningLandscape />
      </div>
    </header>
  );
}

export function TodayScreen() {
  const { localDate: today } = useLocalClock();
  const { busy, status, failed, run } = useMutation();
  const [plan, setPlan] = useState<McheynePlan | null>(null);
  const [enrollment, setEnrollment] = useState<PlanEnrollment | null>(null);
  const [assignment, setAssignment] = useState<McheyneAssignment | null>(null);
  const [progress, setProgress] = useState<Map<string, ReadingProgress>>(new Map());
  const [earlierUnread, setEarlierUnread] = useState<AssignmentProgressSummary[]>([]);
  const [importDate, setImportDate] = useState<LocalDate>(today);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const nextPlan = await loadMcheynePlan();
      const nextEnrollment = await repository.getActiveEnrollment(today);
      setPlan(nextPlan);
      setEnrollment(nextEnrollment ?? null);
      if (!nextEnrollment) {
        setAssignment(null);
        setProgress(new Map());
        setEarlierUnread([]);
        return;
      }
      const nextProgress = await repository.completionMap(nextEnrollment.id);
      setProgress(nextProgress);
      if (nextEnrollment.mode === "CALENDAR") {
        const current = assignmentForCalendarDate(nextPlan, today);
        setAssignment(current);
        const before = current?.sequence ?? sequenceOnOrAfter(nextPlan, today) ?? 366;
        setEarlierUnread(await repository.getEarlierUnreadAssignments(nextPlan, nextEnrollment, before));
      } else {
        const sequence = await repository.getCurrentSelfPacedSequence(nextPlan, nextEnrollment);
        setAssignment(sequence ? nextPlan.assignments[sequence - 1] ?? null : null);
        setEarlierUnread([]);
      }
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load today's reading plan.");
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => { void refresh(); }, [refresh]);

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

  const followCalendar = async () => {
    if (!plan) return;
    await repository.enrollCalendar(today, sequenceOnOrAfter(plan, today) ?? 365);
    await refresh();
  };

  const startSelfPaced = async () => {
    await repository.enrollSelfPaced(today);
    await refresh();
  };

  const importExistingProgress = async () => {
    if (!plan) return;
    validateCompletedThroughDate(importDate, today);
    const through = sequenceOnOrBefore(plan, importDate);
    if (!through) throw new Error("No reading assignment exists for this date.");
    await repository.enrollCalendarWithProgress(today, through);
    await refresh();
  };

  const toggleReading = async (readingIndex: number) => {
    if (!enrollment || !assignment) return;
    const done = Boolean(progress.get(key(assignment.sequence, readingIndex))?.completedAt);
    await repository.setReadingCompleted(enrollment.id, assignment.sequence, readingIndex, !done, today);
    await refresh();
  };

  if (loading) {
    return <main className="visual-screen today-screen mg-canonical-screen"><p className="eyebrow">Today</p><p className="mcheyne-loading">Opening today’s devotion…</p></main>;
  }

  if (error) {
    return <main className="visual-screen today-screen mg-canonical-screen"><p className="eyebrow">Today</p><h1>Today</h1><p role="alert">{error}</p><button type="button" onClick={() => void refresh()}>Try again</button></main>;
  }

  if (!plan || !enrollment) {
    return (
      <main className="visual-screen today-screen mg-canonical-screen">
        <TodayHero today={today} intro="Begin with Scripture. Set the rhythm once, then return here each day." />
        <p className="mutation-status" role={failed ? "alert" : "status"}>{busy ? "Saving…" : status}</p>
        <section className="mcheyne-setup mg-setup-section" aria-labelledby="setup-heading">
          <p className="section-kicker">M’Cheyne reading plan</p>
          <h2 id="setup-heading">Choose where your reading begins.</h2>
          <div className="setup-options">
            <button type="button" disabled={busy} className="primary-editorial-action" onClick={() => void run(() => followCalendar())}>
              <span><strong>Follow today’s calendar</strong><small>Start tracking from {formatDate(today)}. Earlier readings are not marked missed.</small></span>
              <Icon name="arrow" />
            </button>
            <button type="button" disabled={busy} className="editorial-option" onClick={() => void run(() => startSelfPaced())}>
              <strong>Start self-paced at Day 1</strong>
              <span>Move forward only when each day’s four readings are complete.</span>
            </button>
          </div>
          <div className="existing-progress">
            <div>
              <p className="section-kicker">Already following this year?</p>
              <h3>Import completed-through date</h3>
              <p>Already read part of the plan? Bring your progress with you.</p>
            </div>
            <div className="import-controls">
              <input aria-label="Completed through date" type="date" disabled={busy} min={`${calendarYear(today)}-01-01`} max={today} value={importDate} onChange={(event) => setImportDate(event.target.value as LocalDate)} />
              <button type="button" disabled={busy} onClick={() => void run(() => importExistingProgress())}>Import through this date</button>
            </div>
          </div>
        </section>
        <div className="today-lower-grid future-devotional-tools mg-response-grid">
          <TodayReflectionPanel localDate={today} />
          <TodayPrayerPanel />
        </div>
      </main>
    );
  }

  const isLeapPause = enrollment.mode === "CALENDAR" && assignment === null && today.slice(5) === "02-29";
  const planComplete = enrollment.mode === "SELF_PACED" && assignment === null;

  return (
    <main className="visual-screen today-screen mg-canonical-screen">
      <TodayHero
        today={today}
        intro={enrollment.mode === "CALENDAR"
          ? "Meet God in today’s readings, then respond in reflection and prayer."
          : "Continue slowly. Your next reading is ready when you are."}
      />
      <p className="mutation-status" role={failed ? "alert" : "status"}>{busy ? "Saving…" : status}</p>

      <section className="editorial-section reading-section mg-today-reading" aria-labelledby="reading-heading">
        <div className="section-heading-line">
          <div>
            <p className="section-kicker">M’Cheyne · {enrollment.mode === "CALENDAR" ? "Calendar" : "Self-paced"}</p>
            <h2 id="reading-heading">{assignment ? `Day ${assignment.sequence} readings` : isLeapPause ? "Leap-day pause" : "Reading plan"}</h2>
          </div>
          {assignment ? <div className="mg-reading-progress" aria-label={`${completedCount} of 4 readings complete`}><span className="progress-copy">{completedCount} of 4</span></div> : null}
        </div>

        {isLeapPause ? (
          <div className="leap-note"><strong>No canonical M’Cheyne assignment exists for February 29.</strong><p>March 1 remains the historical March 1 assignment; the plan does not shift.</p></div>
        ) : planComplete ? (
          <div className="completion-note"><strong>All 365 M’Cheyne assignments are complete.</strong><p>Your completed readings remain available in the plan and History.</p></div>
        ) : assignment ? (
          <>
            <div className="reading-list live-reading-list mg-reading-cards">
              {assignment.readings.map((reading, index) => {
                const done = Boolean(progress.get(key(assignment.sequence, index))?.completedAt);
                return (
                  <div className={`reading-row mg-reading-card${done ? " is-complete" : ""}`} key={`${assignment.sequence}-${index}`}>
                    <button className="reading-state reading-toggle" type="button" disabled={busy} aria-pressed={done} aria-label={`${done ? "Mark unread" : "Mark complete"}: ${reading.displayReference}`} onClick={() => void run(() => toggleReading(index))}>
                      {done ? <Icon name="check" /> : <span />}
                    </button>
                    <span className="reading-group">{reading.group === "family" ? "Family" : "Private"}</span>
                    <Link className="reading-passage" to={buildPlanReadingUrl(reading, enrollment.id, assignment.sequence, index, "today")}>
                      <strong>{reading.displayReference}</strong>
                    </Link>
                    <Link className="reading-arrow" aria-label={`Open ${reading.displayReference}`} to={buildPlanReadingUrl(reading, enrollment.id, assignment.sequence, index, "today")}><Icon name="arrow" /></Link>
                  </div>
                );
              })}
            </div>
            {completedCount === 4 ? (
              <p className="factual-completion">Today’s M’Cheyne readings are complete.</p>
            ) : firstIncompleteIndex !== null ? (
              <Link className="future-action mg-continue-reading" to={buildPlanReadingUrl(assignment.readings[firstIncompleteIndex]!, enrollment.id, assignment.sequence, firstIncompleteIndex, "today")}>
                Continue reading <Icon name="arrow" />
              </Link>
            ) : null}
          </>
        ) : null}

        <div className="plan-links-row">
          <Link to="/today/plan">Open full plan</Link>
          {earlierUnread.length > 0
            ? <span>{unreadReadingCount} earlier unread {unreadReadingCount === 1 ? "reading" : "readings"} across {earlierUnread.length} {earlierUnread.length === 1 ? "day" : "days"}</span>
            : <span>No earlier unread assignments in your tracked range.</span>}
        </div>
      </section>

      {earlierUnread.length > 0 ? (
        <section className="earlier-unread" aria-labelledby="earlier-heading">
          <div>
            <p className="section-kicker">Earlier unread</p>
            <h2 id="earlier-heading">Available when you want them.</h2>
            <p>These stay visible because they are unread, not because you owe a streak.</p>
          </div>
          <div className="earlier-list">
            {earlierUnread.slice(-4).map((item) => (
              <Link key={item.assignment.sequence} to="/today/plan">
                <span>Day {item.assignment.sequence}</span>
                <strong>{4 - item.completedCount} unread</strong>
                <Icon name="arrow" />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mg-response-section" aria-label="Respond and pray">
        <div className="mg-response-heading">
          <p className="section-kicker">Respond</p>
          <h2>Carry the Word into your day.</h2>
        </div>
        <div className="today-lower-grid future-devotional-tools mg-response-grid">
          <TodayReflectionPanel localDate={today} />
          <TodayPrayerPanel />
        </div>
      </section>
    </main>
  );
}
