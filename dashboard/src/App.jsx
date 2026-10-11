import React, { useState } from "react";
import AppDashboard from "./App.dashboard.jsx";
import ChatTest from "./App.chat.jsx";
import MobilePeteLab from "./mobile/MobilePeteLab.jsx";

// Only the temporary synthetic test lab is available at /pete-test.
// Deployment MUST require a private authenticated ingress before exposing it.
export default function App() {
  const [view, setView] = useState("dashboard");

  if (window.location.pathname === "/pete-test" || window.location.pathname === "/pete-test/") {
    return <MobilePeteLab />;
  }

  if (view === "chat") {
    return (
      <div style={{ minHeight: "100vh", background: "#0b1020", color: "#f8fafc" }}>
        <header className="fp-test-header">
          <button type="button" onClick={() => setView("dashboard")}
            className="fp-test-back">← Zurück zum Arbeitsplatz</button>
          <span style={{ fontWeight: 750 }}>Pete testen</span>
          <span style={{ fontSize: 12, color: "#cbd5e1" }}>
            Testchat – keine Instagram- oder WhatsApp-Zustellung
          </span>
        </header>
        <ChatTest />
      </div>
    );
  }

  return <AppDashboard onOpenTestChat={() => setView("chat")} />;
}
