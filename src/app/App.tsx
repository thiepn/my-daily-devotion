import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { PlanScreen } from "../mcheyne/PlanScreen";
import { TodayScreen } from "../mcheyne/TodayScreen";
import { NewPrayerScreen } from "../prayer/NewPrayerScreen";
import { PrayerDetailScreen } from "../prayer/PrayerDetailScreen";
import { PrayerScreen } from "../prayer/PrayerScreen";
import { PrayerSessionScreen } from "../prayer/PrayerSessionScreen";
import { ReflectionScreen } from "../reflection/ReflectionScreen";
import { BibleScreen } from "../scripture/BibleScreen";
import { Icon, type IconName } from "./visual/Icon";
import { BrandMark } from "./visual/BrandMark";
import { ThemeSwitcher } from "./visual/ThemeSwitcher";
import { HistoryVisual } from "./visual/VisualScreens";

const sections: Array<{ label: string; to: string; icon: IconName }> = [
  { label: "Today", to: "/today", icon: "today" },
  { label: "Bible", to: "/bible", icon: "bible" },
  { label: "Prayer", to: "/prayer", icon: "prayer" },
  { label: "History", to: "/history", icon: "history" },
];

function PrimaryNavigation({ mobile = false }: { mobile?: boolean }) {
  return <nav className={mobile ? "mobile-nav" : "side-nav"} aria-label="Primary">{sections.map(({ label, to, icon }) => <NavLink key={to} to={to} className="nav-link"><Icon name={icon} aria-hidden="true" /><span>{label}</span></NavLink>)}</nav>;
}

export function App() {
  return (
    <div className="app-shell">
      <aside className="side-rail">
        <NavLink className="brand" to="/today" aria-label="My Daily Devotion home"><BrandMark className="brand-mark" /><span className="brand-copy"><strong>My Daily Devotion</strong><small>Scripture · Prayer · Memory</small></span></NavLink>
        <PrimaryNavigation />
        <div className="rail-note"><span className="rail-rule" aria-hidden="true" /><p>Read Scripture. Respond where it matters. Pray intentionally.</p></div>
      </aside>
      <div className="workspace">
        <header className="utility-bar"><div><span className="phase-label">Prayer Core</span><span className="phase-value">Phase 6</span></div><ThemeSwitcher /></header>
        <Routes>
          <Route path="/" element={<Navigate to="/today" replace />} />
          <Route path="/today" element={<TodayScreen />} />
          <Route path="/today/plan" element={<PlanScreen />} />
          <Route path="/today/reflection/:localDate" element={<ReflectionScreen />} />
          <Route path="/bible" element={<BibleScreen />} />
          <Route path="/bible/:bookId/:chapter" element={<BibleScreen />} />
          <Route path="/prayer" element={<PrayerScreen />} />
          <Route path="/prayer/new" element={<NewPrayerScreen />} />
          <Route path="/prayer/session" element={<PrayerSessionScreen />} />
          <Route path="/prayer/:prayerId" element={<PrayerDetailScreen />} />
          <Route path="/history" element={<HistoryVisual />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Routes>
      </div>
      <PrimaryNavigation mobile />
    </div>
  );
}
