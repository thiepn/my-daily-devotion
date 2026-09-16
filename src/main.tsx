import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "./app/App";
import { prepareDatabase } from "./data/database";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/shell.css";
import "./styles/screens.css";
import "./styles/scripture.css";
import "./styles/phase4.css";
import "./styles/phase5.css";
import "./styles/phase6.css";
import "./styles/phase7.css";
import "./styles/phase8.css";
const rootElement = document.getElementById("root"); if (!rootElement) throw new Error("MDD root element is missing."); const root = createRoot(rootElement);
async function start(): Promise<void> { try { await prepareDatabase(); root.render(<StrictMode><HashRouter><App /></HashRouter></StrictMode>); } catch (error) { const message = error instanceof Error ? error.message : "Unknown startup error"; root.render(<main className="startup-error" role="alert"><p className="eyebrow">Local data error</p><h1>My Daily Devotion could not open its local data.</h1><p>{message}</p><p>Your existing browser data has not been intentionally cleared.</p></main>); } }
void start();
