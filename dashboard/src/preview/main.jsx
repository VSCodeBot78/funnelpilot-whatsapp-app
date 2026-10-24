import React, { Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import "./preview.css";

const enabled =
  typeof __DASHBOARD_V2_PREVIEW__ !== "undefined" &&
  __DASHBOARD_V2_PREVIEW__ === true;
const DashboardPreview = enabled
  ? lazy(() => import("./DashboardPreview.jsx"))
  : null;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {enabled ? (
      <Suspense
        fallback={
          <div className="v2-gate" role="status">
            Vorschau wird geladen …
          </div>
        }
      >
        <DashboardPreview />
      </Suspense>
    ) : (
      <main className="v2-gate">
        <span className="v2-eyebrow">FUNNEL PILOT</span>
        <h1>Dashboard 2.0 ist deaktiviert.</h1>
        <p>
          Die Vorschau benötigt einen ausdrücklich gestarteten
          Entwicklungsmodus. Es werden keine Backend-Daten geladen.
        </p>
        <p>
          Dein bestehendes Dashboard und das lokale Pete-Labor bleiben
          unverändert.
        </p>
      </main>
    )}
  </React.StrictMode>,
);
