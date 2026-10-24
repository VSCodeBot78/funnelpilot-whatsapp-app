import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DAILY_NAV,
  ADMIN_NAV,
  getSectionLabel,
} from "../navigation/dashboardNavigation.js";
import { loadPreviewSnapshot, readPreviewResource } from "./previewApi.js";
import { joinLeads, filterLeads, summaryMetrics } from "./previewModel.js";
import { Icon, Badge } from "./PreviewUi.jsx";
import {
  CommandCenter,
  ContactsView,
  CampaignsPreview,
  FollowUpsPreview,
  OnboardingPreview,
  SettingsPreview,
  BookingsPreview,
} from "./PreviewViews.jsx";

const TITLES = { dashboard: "Kommandozentrale", onboarding: "Einrichtung" };
export default function DashboardPreview() {
  const [section, setSection] = useState("dashboard");
  const [theme, setTheme] = useState("light");
  const [mobileNav, setMobileNav] = useState(false);
  const [snapshot, setSnapshot] = useState({});
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    status: "all",
    source: "all",
    campaign: "all",
    sort: "priority",
  });
  const [selectedId, setSelectedId] = useState(null);
  const [mobilePane, setMobilePane] = useState("list");
  const [detail, setDetail] = useState({
    data: null,
    error: null,
    loading: false,
  });
  const [followUp, setFollowUp] = useState({
    data: null,
    error: null,
    loading: false,
  });
  const abortRef = useRef(null);
  const navRef = useRef(null);
  const menuRef = useRef(null);
  const mainRef = useRef(null);

  const reload = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    const next = await loadPreviewSnapshot({ signal: controller.signal });
    if (!controller.signal.aborted) {
      setSnapshot(next);
      setUpdatedAt(new Date());
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    reload();
    return () => abortRef.current?.abort();
  }, [reload]);

  const leadsData = snapshot.leads?.data;
  const conversationsData = snapshot.conversations?.data;
  const leads = useMemo(
    () => joinLeads(leadsData?.leads, conversationsData?.conversations),
    [leadsData, conversationsData],
  );
  const campaigns = snapshot.campaigns?.data?.campaigns || [];
  const visible = useMemo(
    () => filterLeads(leads, { ...filters, search }),
    [leads, filters, search],
  );
  const selected = visible.find((lead) => lead.id === selectedId) || null;
  const metrics = summaryMetrics(leads, {
    leadsAvailable: !!leadsData,
    conversationsAvailable: !!conversationsData,
  });

  useEffect(() => {
    if (!visible.some((lead) => lead.id === selectedId))
      setSelectedId(visible[0]?.id || null);
  }, [visible, selectedId]);

  // Fetch only the selected exact backend identity, cancel on selection/refresh.
  // Never ensure/create a missing conversation and never infer from name/phone.
  useEffect(() => {
    const controller = new AbortController();
    const identity = selected?.conversation;
    setDetail({ data: null, error: null, loading: false });
    setFollowUp({ data: null, error: null, loading: false });
    if (!identity || !["inbox", "leads", "ghosting"].includes(section)) return;
    const resource = section === "ghosting" ? "followUp" : "conversation";
    const setter = section === "ghosting" ? setFollowUp : setDetail;
    setter({ data: null, error: null, loading: true });
    readPreviewResource(resource, { identity, signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted)
          setter({ data, error: null, loading: false });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setter({ data: null, error: error.message, loading: false });
      });
    return () => controller.abort();
  }, [selected?.id, selected?.conversation, section]);

  const navigate = useCallback((key) => {
    setSection(key);
    setMobileNav(false);
    setMobilePane("list");
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    requestAnimationFrame(() => mainRef.current?.focus({ preventScroll: true }));
  }, []);
  function openLead(lead, destination = "inbox") {
    setSearch("");
    setFilters({
      status: "all",
      source: "all",
      campaign: "all",
      sort: "priority",
    });
    setSelectedId(lead.id);
    setSection(destination);
    setMobilePane(destination === "inbox" ? "chat" : "context");
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    requestAnimationFrame(() => mainRef.current?.focus({ preventScroll: true }));
  }

  useEffect(() => {
    if (!mobileNav) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    navRef.current?.querySelector("button")?.focus();
    function keyHandler(event) {
      if (event.key === "Escape") {
        setMobileNav(false);
        menuRef.current?.focus();
      }
      if (event.key === "Tab") {
        const buttons = [
          ...navRef.current.querySelectorAll("button:not(:disabled)"),
        ];
        const first = buttons[0],
          last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keyHandler);
    };
  }, [mobileNav]);

  const shared = {
    leads,
    visible,
    selected,
    campaigns,
    filters,
    setFilters,
    search,
    setSearch,
    detail,
    mobilePane,
    setMobilePane,
    onSelect: (id) => {
      setSelectedId(id);
      setMobilePane(section === "inbox" ? "chat" : "context");
    },
    loading,
    leadsError: snapshot.leads?.error,
    snapshot,
    reload,
  };
  const errors = Object.entries(snapshot).filter(([, value]) => value.error);
  const title = TITLES[section] || getSectionLabel(section);

  return (
    <div className="v2-app" data-theme={theme}>
      <a className="v2-skip" href="#v2-main">
        Zum Inhalt springen
      </a>
      {mobileNav && (
        <div
          className="v2-scrim"
          onClick={() => {
            setMobileNav(false);
            menuRef.current?.focus();
          }}
        />
      )}
      <aside
        ref={navRef}
        className={`v2-sidebar${mobileNav ? " is-open" : ""}`}
        aria-label="Hauptnavigation"
        {...(mobileNav ? { role: "dialog", "aria-modal": true } : {})}
      >
        <div className="v2-brand">
          <span className="v2-brand-mark">
            <Icon name="spark" size={24} />
          </span>
          <div>
            funnel<span>pilot</span>
            <small>Dein Workspace mit Pete</small>
          </div>
          <button
            type="button"
            className="v2-mobile-only v2-icon-button"
            aria-label="Navigation schließen"
            onClick={() => {
              setMobileNav(false);
              menuRef.current?.focus();
            }}
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="v2-workspace-label">
          <span className="v2-workspace-icon">P</span>
          <div>
            <strong>Pete Workspace</strong>
            <small>Dashboard 2.0 · Vorschau</small>
          </div>
          <Icon name="lock" size={14} />
        </div>
        <nav>
          <p className="v2-nav-label">ARBEITSPLATZ</p>
          {DAILY_NAV.map((item) => (
            <button
              type="button"
              key={item.key}
              aria-label={
                item.key === "dashboard" ? "Kommandozentrale" : item.label
              }
              className={`v2-nav-item${section === item.key ? " is-active" : ""}`}
              aria-current={section === item.key ? "page" : undefined}
              onClick={() => navigate(item.key)}
            >
              <Icon name={item.key} />
              <span>
                {item.key === "dashboard" ? "Kommandozentrale" : item.label}
              </span>
              {item.key === "inbox" &&
                metrics.human != null &&
                metrics.human > 0 && (
                  <span
                    className="v2-nav-count"
                    aria-label={`${metrics.human} Human Takeover`}
                    title={`${metrics.human} menschliche Übernahme${metrics.human === 1 ? "" : "n"}`}
                  >
                    {metrics.human} Übernahme${metrics.human === 1 ? "" : "n"}
                  </span>
                )}
            </button>
          ))}
          <p className="v2-nav-label">VERWALTUNG</p>
          {ADMIN_NAV.map((item) => (
            <button
              type="button"
              key={item.key}
              aria-label={
                item.key === "dashboard" ? "Kommandozentrale" : item.label
              }
              className={`v2-nav-item${section === item.key ? " is-active" : ""}`}
              aria-current={section === item.key ? "page" : undefined}
              onClick={() => navigate(item.key)}
            >
              <Icon name={item.key} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="v2-sidebar-bottom">
          <div className="v2-pete-card">
            <Icon name="spark" />
            <strong>Pete bleibt in deinem Labor.</strong>
            <p>KI-Schalter und Budget werden hier nicht verändert.</p>
            <Badge tone="orange">Nur lesende Vorschau</Badge>
          </div>
          <button
            type="button"
            className="v2-theme-button"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            aria-label={
              theme === "light"
                ? "Dunkelmodus einschalten"
                : "Hellmodus einschalten"
            }
          >
            <Icon name={theme === "light" ? "moon" : "sun"} />
            <span>{theme === "light" ? "Dunkelmodus" : "Hellmodus"}</span>
          </button>
          <div className="v2-profile">
            <span className="v2-profile-dot">FP</span>
            <div>
              <strong>Besitzer-Vorschau</strong>
              <small>Freigabe steht aus</small>
            </div>
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
              onClick={() => setMobileNav(true)}
              aria-expanded={mobileNav}
              aria-label="Navigation öffnen"
            >
              <Icon name="menu" />
            </button>
            <span className="v2-breadcrumb">
              Workspace <span>/</span> <strong>{title}</strong>
            </span>
          </div>
          <div className="v2-topbar-right">
            <Badge tone="orange">Vorschau 2.0</Badge>
            <span className="v2-connection">
              <span
                className={`v2-dot ${snapshot.health?.data ? "is-connected" : ""}`}
              />
              {loading
                ? "Wird geprüft"
                : snapshot.health?.data
                  ? "Backend erreichbar"
                  : "Backend ungeprüft"}
            </span>
          </div>
        </header>
        <div className="v2-preview-banner">
          <Icon name="lock" size={16} />
          <p>
            <strong>Prüfmodus.</strong> Lesen und navigieren. Speichern,
            KI-Aufrufe und Versand sind deaktiviert.
          </p>
        </div>
        <main
          id="v2-main"
          ref={mainRef}
          tabIndex={-1}
          className="v2-main"
          aria-busy={loading}
        >
          <div className="v2-page-heading">
            <div>
              <span className="v2-eyebrow">DEIN KI-SETTER WORKSPACE</span>
              <h1>{title}</h1>
              <p>
                {section === "dashboard"
                  ? "Die wichtigen Gespräche im Blick. Der nächste Schritt klar vor dir."
                  : section === "inbox"
                    ? "Gespräch, Verantwortung und Kontaktkontext an einem Ort."
                    : section === "leads"
                      ? "Kontakte finden, Prioritäten erkennen und den Kontext verstehen."
                      : "Bestehende Konfiguration übersichtlich prüfen."}
              </p>
            </div>
            <button
              type="button"
              className="v2-button"
              onClick={reload}
              disabled={loading}
            >
              <Icon name="refresh" size={16} />
              {loading ? "Lädt …" : "Aktualisieren"}
            </button>
          </div>
          {loading && (
            <div className="v2-notice" role="status">
              Gespeicherte Daten werden lesend geladen …
            </div>
          )}
          {!loading && errors.length > 0 && (
            <details className="v2-error-summary">
              <summary>
                {errors.length} Datenquelle{errors.length > 1 ? "n" : ""} nicht
                verfügbar. Fehlende Werte werden nicht geschätzt.
              </summary>
              <ul>
                {errors.map(([key, value]) => (
                  <li key={key}>
                    {key}: {value.error}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {section === "dashboard" && (
            <CommandCenter
              {...shared}
              metrics={metrics}
              onOpenLead={openLead}
              navigate={navigate}
            />
          )}
          {["inbox", "leads"].includes(section) && (
            <ContactsView {...shared} inbox={section === "inbox"} />
          )}
          {section === "campaigns" && (
            <CampaignsPreview
              snapshot={snapshot}
              campaigns={campaigns}
              loading={loading}
            />
          )}
          {section === "ghosting" && (
            <FollowUpsPreview {...shared} followUp={followUp} />
          )}
          {section === "onboarding" && (
            <OnboardingPreview snapshot={snapshot} />
          )}
          {section === "settings" && <SettingsPreview snapshot={snapshot} />}
          {["appointments", "booking-events"].includes(section) && (
            <BookingsPreview
              leads={leads}
              snapshot={snapshot}
              eventsOnly={section === "booking-events"}
            />
          )}
          <footer className="v2-footer">
            <span>Funnel Pilot · Pete Dashboard 2.0</span>
            <span>
              {updatedAt
                ? `Letzter Abruf ${updatedAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} · Nur gespeicherte Daten`
                : "Noch kein Datenabruf bestätigt"}
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
