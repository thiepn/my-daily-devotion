import { Link, Navigate, NavLink, Route, Routes } from "react-router-dom";
import { DataScreen } from "../data/DataScreen";
import { HistoryDayScreen, HistoryMomentsScreen, HistoryScreen } from "../history/HistoryScreens";
import { PlanScreen } from "../mcheyne/PlanScreen";
import { TodayScreen } from "../mcheyne/TodayScreen";
import { CategoriesScreen } from "../prayer/CategoriesScreen";
import { NewPrayerScreen } from "../prayer/NewPrayerScreen";
import { PeopleScreen } from "../prayer/PeopleScreen";
import { PrayerDetailScreen } from "../prayer/PrayerDetailScreen";
import { PrayerScreen } from "../prayer/PrayerScreen";
import { PrayerSessionScreen } from "../prayer/PrayerSessionScreen";
import { PrayerSettingsScreen } from "../prayer/PrayerSettingsScreen";
import { ReflectionScreen } from "../reflection/ReflectionScreen";
import { SearchScreen } from "../search/SearchScreen";
import { BibleScreen } from "../scripture/BibleScreen";
import { CollectionsScreen } from "../scripture/CollectionsScreen";
import { BrandMark } from "./visual/BrandMark";
import { Icon, type IconName } from "./visual/Icon";
import { ThemeSwitcher } from "./visual/ThemeSwitcher";

const sections: Array<{ label: string; to: string; icon: IconName }> = [
  { label: "Today", to: "/today", icon: "today" },
  { label: "Bible", to: "/bible", icon: "bible" },
  { label: "Prayer", to: "/prayer", icon: "prayer" },
  { label: "History", to: "/history", icon: "history" },
];

function PrimaryNavigation({ mobile = false }: { mobile?: boolean }) {
  return (
    <nav className={mobile ? "mobile-nav" : "side-nav"} aria-label="Primary">
      {sections.map(({ label, to, icon }) => (
        <NavLink key={to} to={to} className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
          <Icon name={icon} aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function App() {
  return (
    <div className="app-shell">
      <aside className="side-rail">
        <NavLink className="brand" to="/today" aria-label="My Daily Devotion home">
          <BrandMark className="brand-mark" />
          <span className="brand-copy"><strong>My Daily Devotion</strong><small>Scripture · Prayer · Memory</small></span>
        </NavLink>
        <PrimaryNavigation />
        <div className="rail-note"><span className="rail-rule" aria-hidden="true" /><p>Read Scripture. Respond where it matters. Pray intentionally.</p></div>
      </aside>
      <div className="workspace">
        <header className="utility-bar">
          <div className="utility-context" aria-label="Application context">
            <span className="utility-context-title">Devotional workspace</span>
            <span className="utility-context-note">Private on this device</span>
          </div>
          <div className="utility-actions"><Link to="/search">Search</Link><Link to="/data">Data</Link><ThemeSwitcher /></div>
        </header>
        <Routes>
          <Route path="/" element={<Navigate to="/today" replace />} />
          <Route path="/today" element={<TodayScreen />} />
          <Route path="/today/plan" element={<PlanScreen />} />
          <Route path="/today/reflection/:localDate" element={<ReflectionScreen />} />
          <Route path="/bible" element={<BibleScreen />} />
          <Route path="/bible/collections" element={<CollectionsScreen />} />
          <Route path="/bible/:bookId/:chapter" element={<BibleScreen />} />
          <Route path="/prayer" element={<PrayerScreen />} />
          <Route path="/prayer/new" element={<NewPrayerScreen />} />
          <Route path="/prayer/people" element={<PeopleScreen />} />
          <Route path="/prayer/categories" element={<CategoriesScreen />} />
          <Route path="/prayer/session" element={<PrayerSessionScreen />} />
          <Route path="/prayer/:prayerId/settings" element={<PrayerSettingsScreen />} />
          <Route path="/prayer/:prayerId" element={<PrayerDetailScreen />} />
          <Route path="/history" element={<HistoryScreen />} />
          <Route path="/history/moments" element={<HistoryMomentsScreen />} />
          <Route path="/history/day/:localDate" element={<HistoryDayScreen />} />
          <Route path="/search" element={<SearchScreen />} />
          <Route path="/data" element={<DataScreen />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Routes>
      </div>
      <PrimaryNavigation mobile />
    </div>
  );
}
