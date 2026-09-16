import { Icon } from "./Icon";

const readings = [
  { group: "Family", passage: "Genesis 1", done: true },
  { group: "Family", passage: "Matthew 1", done: true },
  { group: "Private", passage: "Ezra 1", done: false },
  { group: "Private", passage: "Acts 1", done: false },
];

function ScreenHeader({ eyebrow, title, intro }: { eyebrow: string; title: string; intro: string }) {
  return (
    <header className="screen-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="screen-intro">{intro}</p>
    </header>
  );
}

export function TodayVisual() {
  return (
    <main className="visual-screen today-screen">
      <ScreenHeader
        eyebrow="Wednesday · September 16"
        title="Today"
        intro="A quiet place to continue Scripture, respond when something matters, and move into prayer without turning devotion into a dashboard."
      />

      <section className="editorial-section reading-section" aria-labelledby="reading-heading">
        <div className="section-heading-line">
          <div>
            <p className="section-kicker">M’Cheyne · sample day</p>
            <h2 id="reading-heading">Today’s readings</h2>
          </div>
          <span className="progress-copy">2 of 4</span>
        </div>

        <div className="reading-list">
          {readings.map((reading) => (
            <div className={`reading-row${reading.done ? " is-complete" : ""}`} key={reading.passage}>
              <span className="reading-state" aria-hidden="true">{reading.done ? <Icon name="check" /> : <span />}</span>
              <span className="reading-group">{reading.group}</span>
              <strong>{reading.passage}</strong>
              <span className="reading-arrow"><Icon name="arrow" aria-hidden="true" /></span>
            </div>
          ))}
        </div>

        <div className="future-action" aria-hidden="true">
          <span>Continue reading</span>
          <Icon name="arrow" />
        </div>
      </section>

      <div className="today-lower-grid">
        <section className="editorial-section reflection-preview" aria-labelledby="reflection-heading">
          <p className="section-kicker">Response</p>
          <h2 id="reflection-heading">A place to write, not a task to finish.</h2>
          <div className="journal-page">
            <span className="journal-date">Today</span>
            <p>What stood out?</p>
            <span className="journal-line" />
            <span className="journal-line short" />
          </div>
        </section>

        <section className="editorial-section prayer-preview" aria-labelledby="prayer-heading">
          <p className="section-kicker">Prayer</p>
          <h2 id="prayer-heading">Pray now</h2>
          <p className="muted-copy">A focused session can surface what is due without making prayer feel like inbox zero.</p>
          <div className="prayer-count-line">
            <strong>4</strong>
            <span>prayers in a quick session</span>
          </div>
          <div className="future-text-link" aria-hidden="true">Begin quietly <Icon name="arrow" /></div>
        </section>
      </div>
    </main>
  );
}

export function BibleVisual() {
  return (
    <main className="visual-screen reader-screen">
      <ScreenHeader
        eyebrow="Scripture reader"
        title="Bible"
        intro="The reader is treated as a page first: generous measure, restrained controls, semantic typography, and almost no decorative chrome."
      />

      <article className="reader-page" aria-label="Scripture reader visual prototype">
        <header className="reader-heading">
          <div>
            <p>Berean Standard Bible</p>
            <h2>Genesis 1</h2>
          </div>
          <span className="reader-context">M’Cheyne · Family</span>
        </header>

        <div className="scripture-copy">
          <p><sup>1</sup> In the beginning God created the heavens and the earth.</p>
          <p><sup>2</sup> Now the earth was formless and void, and darkness was over the surface of the deep. And the Spirit of God was hovering over the surface of the waters.</p>
          <p className="scripture-break"><sup>3</sup> And God said, “Let there be light,” and there was light.</p>
        </div>

        <footer className="reader-actions" aria-label="Verse action visual language">
          <span><Icon name="bookmark" /> Bookmark</span>
          <span><Icon name="note" /> Reflect</span>
          <span><Icon name="prayer" /> Pray</span>
        </footer>
      </article>
    </main>
  );
}

export function PrayerVisual() {
  return (
    <main className="visual-screen prayer-screen">
      <ScreenHeader
        eyebrow="Prayer system"
        title="Prayer"
        intro="Prayer uses calm sequencing and strong typographic hierarchy. Status is visible, but administrative metadata stays out of the devotional foreground."
      />

      <div className="prayer-layout">
        <section className="prayer-list-panel" aria-labelledby="prayer-list-heading">
          <div className="section-heading-line compact">
            <div>
              <p className="section-kicker">Active</p>
              <h2 id="prayer-list-heading">Prayer list</h2>
            </div>
            <span className="quiet-count">12</span>
          </div>

          {[
            ["Family", "Wisdom and peace for a difficult conversation"],
            ["Mission", "Strength and encouragement for the church plant"],
            ["Study", "Faithfulness in work and studies"],
          ].map(([category, body]) => (
            <div className="prayer-row" key={body}>
              <span className="prayer-category">{category}</span>
              <p>{body}</p>
              <Icon name="arrow" aria-hidden="true" />
            </div>
          ))}
        </section>

        <aside className="focus-preview" aria-label="Focused prayer visual prototype">
          <p className="section-kicker">Focused prayer</p>
          <div className="focus-index">02 <span>/ 10</span></div>
          <h2>A friend facing an important decision</h2>
          <blockquote>“Trust in the LORD with all your heart…”</blockquote>
          <p className="focus-source">Proverbs 3:5</p>
          <div className="focus-actions" aria-hidden="true">
            <span>Update</span><span>Answered</span><span>Skip</span>
          </div>
          <div className="focus-next" aria-hidden="true">Next <Icon name="arrow" /></div>
        </aside>
      </div>
    </main>
  );
}

export function HistoryVisual() {
  return (
    <main className="visual-screen history-screen">
      <ScreenHeader
        eyebrow="Remember"
        title="History"
        intro="History is an automatic record of meaningful moments, not a scorecard. The visual language favors dates, context, and continuity over charts and streaks."
      />

      <section className="history-timeline" aria-label="Devotional history visual prototype">
        <div className="timeline-day">
          <div className="timeline-date"><strong>16</strong><span>Sep · 2026</span></div>
          <div className="timeline-events">
            <div className="history-event scripture-event"><span className="event-mark" /><div><p>Scripture</p><strong>Romans 10 · Psalm 119</strong></div></div>
            <div className="history-event"><span className="event-mark" /><div><p>Reflection</p><strong>“Faith comes by hearing…”</strong></div></div>
          </div>
        </div>

        <div className="timeline-day">
          <div className="timeline-date"><strong>12</strong><span>Sep · 2026</span></div>
          <div className="timeline-events">
            <div className="history-event answer-event"><span className="event-mark" /><div><p>Answered prayer</p><strong>A long-running request received an answer.</strong></div></div>
          </div>
        </div>

        <div className="timeline-day subdued">
          <div className="timeline-date"><strong>08</strong><span>Sep · 2026</span></div>
          <div className="timeline-events">
            <div className="history-event"><span className="event-mark" /><div><p>Highlight</p><strong>Isaiah 40:31</strong></div></div>
          </div>
        </div>
      </section>
    </main>
  );
}
