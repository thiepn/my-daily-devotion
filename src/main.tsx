import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "./app/App";
import { inspectStorage, registerMddServiceWorker } from "./app/platform";
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
import "./styles/phase9.css";
import "./styles/phase10.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("MDD root element is missing.");
const root = createRoot(rootElement);

async function start(): Promise<void> {
  try {
    await prepareDatabase();
    root.render(<StrictMode><HashRouter><App /></HashRouter></StrictMode>);
    void inspectStorage(true).catch(() => undefined);
    void registerMddServiceWorker().catch((error: unknown) => {
      console.warn("MDD service worker registration failed; the app remains usable online.", error);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown startup error";
    root.render(
      <main className="startup-error" role="alert">
        <p className="eyebrow">Local data error</p>
        <h1>My Daily Devotion could not open its local data.</h1>
        <p>{message}</p>
        <p>Your existing browser data has not been intentionally cleared. Reloading or restoring a validated backup remains safer than deleting browser storage.</p>
        <button type="button" onClick={() => window.location.reload()}>Try opening MDD again</button>
      </main>,
    );
  }
}

void start();
