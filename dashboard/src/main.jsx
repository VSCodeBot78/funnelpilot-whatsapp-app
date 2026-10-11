import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./workspace.css";
import App from "./App.jsx";

// Do not offer the full admin dashboard as an installable PWA.
// Only the isolated /pete-test experience has an Android home-screen manifest.
if (window.location.pathname === "/pete-test" || window.location.pathname === "/pete-test/") {
  const link = document.createElement("link");
  link.rel = "manifest";
  link.href = "/pete-lab.webmanifest";
  document.head.appendChild(link);
  const theme = document.createElement("meta");
  theme.name = "theme-color";
  theme.content = "#121820";
  document.head.appendChild(theme);
  document.documentElement.lang = "de";
}
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode><App /></React.StrictMode>,
);
