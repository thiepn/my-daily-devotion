import { NavLink, Navigate, Route, Routes } from "react-router-dom";

const sections = [
  ["Today", "/today"],
  ["Bible", "/bible"],
  ["Prayer", "/prayer"],
  ["History", "/history"],
] as const;

function FoundationScreen({ title }: { title: string }) {
  return (
    <main className="foundation-screen">
      <p className="eyebrow">Phase 1 foundation</p>
      <h1>{title}</h1>
      <p>
        The local-first data layer is active. Product UI is intentionally deferred
        to the dedicated design and feature phases.
      </p>
    </main>
  );
}

export function App() {
  return (
    <div className="app-shell">
      <header className="foundation-header">
        <strong>My Daily Devotion</strong>
        <span>Local-first foundation</span>
      </header>

      <nav className="foundation-nav" aria-label="Primary">
        {sections.map(([label, to]) => (
          <NavLink key={to} to={to}>
            {label}
          </NavLink>
        ))}
      </nav>

      <Routes>
        <Route path="/" element={<Navigate to="/today" replace />} />
        <Route path="/today" element={<FoundationScreen title="Today" />} />
        <Route path="/bible" element={<FoundationScreen title="Bible" />} />
        <Route path="/prayer" element={<FoundationScreen title="Prayer" />} />
        <Route path="/history" element={<FoundationScreen title="History" />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Routes>
    </div>
  );
}
