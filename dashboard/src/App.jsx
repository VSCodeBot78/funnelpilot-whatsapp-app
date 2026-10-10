import React, { useState } from "react";
import AppDashboard from "./App.dashboard.jsx";
import ChatTest from "./App.chat.jsx";

// No competing global tab bar: daily navigation lives inside the workspace,
// and the test chat is always one clearly labelled action away.
export default function App() {
  const [view, setView] = useState("dashboard");

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
