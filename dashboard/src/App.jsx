import React, { useState } from "react";
import AppDashboard from "./App.dashboard.jsx";
import ChatTest from "./App.chat.jsx";

export default function App() {
  const [view, setView] = useState("dashboard");

  const isDashboard = view === "dashboard";

  return (
    <div style={{ minHeight: "100vh", background: "#020617", width: "100%" }}>
      <div
        style={{
          width: "100%",
          margin: 0,
          padding: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            padding: 16,
            marginBottom: 0,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => setView("dashboard")}
            style={{
              border: "1px solid #334155",
              background: isDashboard ? "#f97316" : "#111827",
              color: isDashboard ? "#111827" : "#fff",
              borderRadius: 10,
              padding: "10px 14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Dashboard
          </button>

          <button
            type="button"
            onClick={() => setView("chat")}
            style={{
              border: "1px solid #334155",
              background: !isDashboard ? "#f97316" : "#111827",
              color: !isDashboard ? "#111827" : "#fff",
              borderRadius: 10,
              padding: "10px 14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Testchat
          </button>

          <div
            style={{
              alignSelf: "center",
              color: "#cbd5e1",
              fontWeight: 600,
              marginLeft: 6,
            }}
          >
            Aktive Ansicht: {isDashboard ? "Dashboard" : "Testchat"}
          </div>
        </div>

        {isDashboard ? <AppDashboard /> : <ChatTest />}
      </div>
    </div>
  );
}
