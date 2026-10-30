import React, { useEffect, useRef, useState } from "react";
import {
  DAILY_NAV,
  ADMIN_NAV,
  getSectionLabel,
} from "../navigation/dashboardNavigation.js";
import { Icon, Badge } from "./PreviewUi.jsx";
import "./preview.css";
import "./operational.css";

// Functional navigation chrome for the EXISTING AppDashboard controllers.
// No second campaign store, Pete engine, API client or message dispatcher.
const SECTION_TITLES = {
  dashboard: "Kommandozentrale",
  "pete-lab": "Pete testen",
};
const SECTION_DESCRIPTIONS = {
  dashboard: "Kontakte, Gespräche und nächste Schritte an einem Ort.",
  campaigns: "Kampagnen und Keywords anlegen, bearbeiten und speichern.",
  "pete-lab": "Synthetische Gespräche im bestehenden lokalen Desktop-Labor.",
};

export default function OperationalV2Shell({
  section,
  onSectionChange,
  onOpenPete,
  darkMode,
  onToggleTheme,
  backendHealthy,
  backendHealthMessage,
  settings,
  children,
}) {
  const [mobileNav, setMobileNav] = useState(false);
  const navRef = useRef(null);
  const menuRef = useRef(null);
  const mainRef = useRef(null);
  const title = SECTION_TITLES[section] || getSectionLabel(section);

  function navigate(key) {
    setMobileNav(false);
    if (key === "pete-lab") onOpenPete();
    else onSectionChange(key);
    mainRef.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    if (!mobileNav) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    navRef.current?.querySelector("button")?.focus();
    function handleKey(event) {
      if (event.key === "Escape") {
        setMobileNav(false);
        menuRef.current?.focus();
      }
      if (event.key !== "Tab") return;
      const buttons = [...(navRef.current?.querySelectorAll("button:not(:disabled)") || [])];
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
    };
  }, [mobileNav]);

  function navigationButton(item) {
    return (
      <button
        type="button"
        key={item.key}
        className={`v2-nav-item${section === item.key ? " is-active" : ""}`}
        aria-current={section === item.key ? "page" : undefined}
        onClick={() => navigate(item.key)}
      >
        <Icon name={item.key} />
        <span>{item.key === "dashboard" ? "Kommandozentrale" : item.label}</span>
      </button>
    );
  }

  return (
    <div className="v2-app v2-operational" data-theme={darkMode ? "dark" : "light"}>
      <a href="#v2-operational-main" className="v2-skip">Zum Inhalt springen</a>
      {mobileNav && (
        <button
          type="button"
          className="v2-scrim"
          aria-label="Navigation schließen"
          onClick={() => { setMobileNav(false); menuRef.current?.focus(); }}
        />
      )}
      <aside
        ref={navRef}
        className={`v2-sidebar${mobileNav ? " is-open" : ""}`}
        aria-label="Hauptnavigation"
        {...(mobileNav ? { role: "dialog", "aria-modal": true } : {})}
      >
        <div className="v2-brand">
          <span className="v2-brand-mark"><Icon name="spark" size={24} /></span>
          <div>funnel<span>pilot</span><small>Dein Workspace mit Pete</small></div>
          <button
            type="button"
            className="v2-mobile-only v2-icon-button"
            aria-label="Navigation schließen"
            onClick={() => { setMobileNav(false); menuRef.current?.focus(); }}
          ><Icon name="close" /></button>
        </div>
        <div className="v2-workspace-label">
          <span className="v2-workspace-icon">P</span>
          <div><strong>Pete Workspace</strong><small>Dashboard 2.0 · Lokaler Betrieb</small></div>
          <Icon name="check" size={14} />
        </div>
        <nav aria-label="Dashboard-Bereiche">
          <p className="v2-nav-label">ARBEITSPLATZ</p>
          {DAILY_NAV.map(navigationButton)}
          <button
            type="button"
            className={`v2-nav-item${section === "pete-lab" ? " is-active" : ""}`}
            aria-current={section === "pete-lab" ? "page" : undefined}
            onClick={() => navigate("pete-lab")}
          ><Icon name="spark" /><span>Pete testen</span></button>
          <p className="v2-nav-label">VERWALTUNG</p>
          {ADMIN_NAV.map(navigationButton)}
        </nav>
        <div className="v2-sidebar-bottom">
          <div className="v2-pete-card">
            <Icon name="spark" />
            <strong>Pete direkt im Dashboard</strong>
            <p>Das bestehende Desktop-Labor bleibt zuständig. Ein Budget für echte KI wird dort nur durch deinen eigenen Klick freigegeben.</p>
            <button type="button" className="v2-button v2-button-primary" onClick={() => navigate("pete-lab")}>
              Pete-Labor öffnen
            </button>
          </div>
          <button
            type="button"
            className="v2-theme-button"
            aria-label={darkMode ? "Hellmodus einschalten" : "Dunkelmodus einschalten"}
            onClick={onToggleTheme}
          >
            <Icon name={darkMode ? "sun" : "moon"} />
            <span>{darkMode ? "Hellmodus" : "Dunkelmodus"}</span>
          </button>
          <div className="v2-profile">
            <span className="v2-profile-dot">FP</span>
            <div><strong>{settings?.adminName || "Coach Workspace"}</strong><small>Lokale Beta, kein Live-Sendnachweis</small></div>
          </div>
        </div>
      </aside>
      <div className="v2-workspace">
        <header className="v2-topbar">
          <div className="v2-topbar-left">
            <button
              ref={menuRef}
              type="button"
              className="v2-icon-button v2-mobile-only"
              aria-label="Navigation öffnen"
              aria-expanded={mobileNav}
              onClick={() => setMobileNav(true)}
            ><Icon name="menu" /></button>
            <span className="v2-breadcrumb">Workspace <span>/</span> <strong>{title}</strong></span>
          </div>
          <div className="v2-topbar-right">
            <Badge tone="orange">Lokale Beta</Badge>
            <span className="v2-connection">
              <span className={`v2-dot ${backendHealthy === true ? "is-connected" : ""}`} />
              {backendHealthy === true ? "Backend erreichbar" : backendHealthy === false ? "Backend nicht erreichbar" : "Backend wird geprüft"}
            </span>
          </div>
        </header>
        <div className="v2-operational-safety">
          <Icon name="info" size={16} />
          <span>
            Lokaler Testbetrieb. Instagram-/WhatsApp-Versand und bezahlte Modellaufrufe richten sich ausschließlich nach den Backend-Sperren und deiner separaten Laborfreigabe.
          </span>
        </div>
        <main
          id="v2-operational-main"
          className="v2-main v2-operational-main"
          tabIndex={-1}
          ref={mainRef}
        >
          <div className="v2-page-heading">
            <div>
              <span className="v2-eyebrow">DEIN KI-SETTER WORKSPACE</span>
              <h1>{title}</h1>
              <p>{SECTION_DESCRIPTIONS[section] || "Deine vorhandenen Funktionen, direkt im Dashboard 2.0."}</p>
            </div>
          </div>
          {backendHealthy === false && backendHealthMessage && (
            <p className="v2-operational-health" role="status">{backendHealthMessage}</p>
          )}
          <div className="v2-operational-content">{children}</div>
          <footer className="v2-footer"><span>Funnel Pilot · Dashboard 2.0</span><span>Funktionaler lokaler Workspace · Beta ungeprüft</span></footer>
        </main>
      </div>
    </div>
  );
}
