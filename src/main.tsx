import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";
import { App } from "./app/App";
import { ConfirmationProvider } from "./app/ConfirmationProvider";
import { BrandMark } from "./app/visual/BrandMark";
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
import "./styles/phase11.css";
import "./styles/corrective.css";
import "./styles/morning-grace.css";
import "./styles/morning-grace-brand.css";
import "./styles/morning-grace-screens.css";
import "./styles/morning-grace-secondary.css";
import "./styles/morning-grace-polish.css";
import "./styles/morning-grace-mobile.css";
import "./styles/morning-grace-mobile-stacked.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("MDD root element is missing.");
const root = createRoot(rootElement);

async function start(): Promise<void> {
  try {
    await prepareDatabase();
    const router = createHashRouter([{ path: "*", element: <App /> }]);
    root.render(<StrictMode><ConfirmationProvider><RouterProvider router={router} /></ConfirmationProvider></StrictMode>);
    void inspectStorage(true).catch(() => undefined);
    void registerMddServiceWorker().catch((error: unknown) => {
      console.warn("MDD service worker registration failed; the app remains usable online.", error);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown startup error";
    root.render(
      <main className="startup-error mg-state-screen" role="alert">
        <BrandMark className="mg-state-mark" />
        <p className="eyebrow">Unable to open</p>
        <h1>My Daily Devotion could not open its local data.</h1>
        <p>Try opening the app again. If this continues, check that your browser allows this site to store data and that you are using the latest version of MDD.</p>
        <p>MDD has not cleared your saved data. Avoid clearing browser storage; it can remove data that has not been backed up.</p>
        <button className="quiet-button" type="button" onClick={() => window.location.reload()}>Try opening MDD again</button>
        <details><summary>Technical details</summary><p>{message}</p></details>
      </main>,
    );
  }
}

void start();
