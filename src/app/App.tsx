import { lazy, Suspense, useEffect, useRef } from "react";
import { Link, Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { RouteErrorBoundary } from "./RouteErrorBoundary";
import { PlatformStatus } from "./PlatformStatus";
import { BrandMark } from "./visual/BrandMark";
import { Icon, type IconName } from "./visual/Icon";
import { ThemeSwitcher } from "./visual/ThemeSwitcher";

const TodayScreen = lazy(() => import("../mcheyne/TodayScreen").then((module) => ({ default: module.TodayScreen })));
const PlanScreen = lazy(() => import("../mcheyne/PlanScreen").then((module) => ({ default: module.PlanScreen })));
const ReflectionScreen = lazy(() => import("../reflection/ReflectionScreen").then((module) => ({ default: module.ReflectionScreen })));
const BibleScreen = lazy(() => import("../scripture/BibleScreen").then((module) => ({ default: module.BibleScreen })));
const CollectionsScreen = lazy(() => import("../scripture/CollectionsScreen").then((module) => ({ default: module.CollectionsScreen })));
const PrayerScreen = lazy(() => import("../prayer/PrayerScreen").then((module) => ({ default: module.PrayerScreen })));
const NewPrayerScreen = lazy(() => import("../prayer/NewPrayerScreen").then((module) => ({ default: module.NewPrayerScreen })));
const PeopleScreen = lazy(() => import("../prayer/PeopleScreen").then((module) => ({ default: module.PeopleScreen })));
const CategoriesScreen = lazy(() => import("../prayer/CategoriesScreen").then((module) => ({ default: module.CategoriesScreen })));
const PrayerSessionScreen = lazy(() => import("../prayer/PrayerSessionScreen").then((module) => ({ default: module.PrayerSessionScreen })));
const PrayerSettingsScreen = lazy(() => import("../prayer/PrayerSettingsScreen").then((module) => ({ default: module.PrayerSettingsScreen })));
const PrayerDetailScreen = lazy(() => import("../prayer/PrayerDetailScreen").then((module) => ({ default: module.PrayerDetailScreen })));
const HistoryScreen = lazy(() => import("../history/HistoryScreens").then((module) => ({ default: module.HistoryScreen })));
const HistoryMomentsScreen = lazy(() => import("../history/HistoryScreens").then((module) => ({ default: module.HistoryMomentsScreen })));
const HistoryDayScreen = lazy(() => import("../history/HistoryScreens").then((module) => ({ default: module.HistoryDayScreen })));
const SearchScreen = lazy(() => import("../search/SearchScreen").then((module) => ({ default: module.SearchScreen })));
const DataScreen = lazy(() => import("../data/DataScreen").then((module) => ({ default: module.DataScreen })));

const sections: Array<{ label: string; to: string; icon: IconName }> = [
  { label: "Today", to: "/today", icon: "today" },
  { label: "Bible", to: "/bible", icon: "bible" },
  { label: "Prayer", to: "/prayer", icon: "prayer" },
  { label: "History", to: "/history", icon: "history" },
];

function PrimaryNavigation({ mobile = false }: { mobile?: boolean }) {
  return <nav className={mobile ? "mobile-nav" : "side-nav"} aria-label="Primary">{sections.map(({ label, to, icon }) => <NavLink key={to} to={to} className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}><Icon name={icon} aria-hidden="true" /><span>{label}</span></NavLink>)}</nav>;
}

function routeDomain(pathname: string): "today" | "bible" | "reflection" | "prayer" | "history" | "utility" {
  if (pathname.startsWith("/today/reflection/")) return "reflection";
  if (pathname.startsWith("/today")) return "today";
  if (pathname.startsWith("/bible")) return "bible";
  if (pathname.startsWith("/prayer")) return "prayer";
  if (pathname.startsWith("/history")) return "history";
  return "utility";
}

function mobileBackTarget(pathname: string): string | null {
  if (pathname === "/today/plan" || pathname.startsWith("/today/reflection/")) return "/today";
  if (pathname === "/bible/collections") return "/bible";
  if (pathname === "/prayer/new" || pathname === "/prayer/people" || pathname === "/prayer/categories" || pathname === "/prayer/session") return "/prayer";
  const prayerSettings = pathname.match(/^\/prayer\/([^/]+)\/settings$/);
  if (prayerSettings) return `/prayer/${prayerSettings[1]}`;
  if (/^\/prayer\/[^/]+$/.test(pathname)) return "/prayer";
  if (pathname === "/history/moments" || pathname.startsWith("/history/day/")) return "/history";
  if (pathname === "/search" || pathname === "/data") return "/today";
  return null;
}

function routeLabel(pathname: string): string {
  if (pathname === "/today/plan") return "Reading plan";
  if (pathname.startsWith("/today/reflection/")) return "Reflection";
  if (pathname.startsWith("/today")) return "Today";
  if (pathname === "/bible/collections") return "Scripture collections";
  if (pathname.startsWith("/bible")) return "Bible";
  if (pathname === "/prayer/new") return "Add prayer";
  if (pathname === "/prayer/people") return "Prayer people";
  if (pathname === "/prayer/categories") return "Prayer categories";
  if (pathname === "/prayer/session") return "Focused prayer";
  if (pathname.startsWith("/prayer")) return "Prayer";
  if (pathname === "/history/moments") return "History moments";
  if (pathname.startsWith("/history/day/")) return "History day";
  if (pathname.startsWith("/history")) return "History";
  if (pathname.startsWith("/search")) return "Search";
  if (pathname.startsWith("/data")) return "Data and privacy";
  return "My Daily Devotion";
}

function RouteAnnouncer() {
  const location = useLocation();
  const label = routeLabel(location.pathname);
  const initialRoute = useRef(true);
  useEffect(() => {
    document.title = label === "My Daily Devotion" ? label : `${label} — My Daily Devotion`;
    if (initialRoute.current) { initialRoute.current = false; return; }
    requestAnimationFrame(() => document.getElementById("main-content")?.focus({ preventScroll: true }));
  }, [label, location.pathname]);
  return <p className="sr-only" aria-live="polite" aria-atomic="true">{label}</p>;
}

function RouteLoading() { return <div className="route-loading mg-route-loading" role="status"><BrandMark className="route-loading-mark" /><div><strong>Opening…</strong><span>Your local devotional data stays on this device.</span></div></div>; }

export function App() {
  const location = useLocation();
  const currentLabel = routeLabel(location.pathname);
  const mobileBack = mobileBackTarget(location.pathname);
  return <div className="app-shell morning-grace-shell"><a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); document.getElementById("main-content")?.focus(); }}>Skip to main content</a><aside className="side-rail"><NavLink className="brand" to="/today" aria-label="My Daily Devotion home"><BrandMark className="brand-mark" /><span className="brand-copy"><strong>My Daily Devotion</strong><small>Scripture · Prayer · Reflection</small></span></NavLink><PrimaryNavigation /><div className="rail-note"><span className="rail-rule" aria-hidden="true" /><p>A quieter life. A stronger faith.</p></div></aside><div className="workspace" data-domain={routeDomain(location.pathname)}><header className="utility-bar"><div className="utility-context" aria-label="Application context">{mobileBack ? <Link className="mobile-appbar-back" to={mobileBack} aria-label="Back">←</Link> : null}<span className="utility-context-title">{currentLabel}</span><span className="utility-mobile-title">{currentLabel}</span><span className="utility-context-note">Private on this device</span></div><div className="utility-actions"><Link className="utility-link" to="/search" aria-label="Search"><Icon name="search" aria-hidden="true" /><span>Search</span></Link><Link className="utility-link" to="/data" aria-label="Data"><Icon name="settings" aria-hidden="true" /><span>Data</span></Link><ThemeSwitcher /></div></header><PlatformStatus /><div className="workspace-content" id="main-content" tabIndex={-1}><RouteAnnouncer /><RouteErrorBoundary key={location.pathname}><Suspense fallback={<RouteLoading />}><Routes><Route path="/" element={<Navigate to="/today" replace />} /><Route path="/today" element={<TodayScreen />} /><Route path="/today/plan" element={<PlanScreen />} /><Route path="/today/reflection/:localDate" element={<ReflectionScreen />} /><Route path="/bible" element={<BibleScreen />} /><Route path="/bible/collections" element={<CollectionsScreen />} /><Route path="/bible/:bookId/:chapter" element={<BibleScreen />} /><Route path="/prayer" element={<PrayerScreen />} /><Route path="/prayer/new" element={<NewPrayerScreen />} /><Route path="/prayer/people" element={<PeopleScreen />} /><Route path="/prayer/categories" element={<CategoriesScreen />} /><Route path="/prayer/session" element={<PrayerSessionScreen />} /><Route path="/prayer/:prayerId/settings" element={<PrayerSettingsScreen />} /><Route path="/prayer/:prayerId" element={<PrayerDetailScreen />} /><Route path="/history" element={<HistoryScreen />} /><Route path="/history/moments" element={<HistoryMomentsScreen />} /><Route path="/history/day/:localDate" element={<HistoryDayScreen />} /><Route path="/search" element={<SearchScreen />} /><Route path="/data" element={<DataScreen />} /><Route path="*" element={<Navigate to="/today" replace />} /></Routes></Suspense></RouteErrorBoundary></div></div><PrimaryNavigation mobile /></div>;
}
