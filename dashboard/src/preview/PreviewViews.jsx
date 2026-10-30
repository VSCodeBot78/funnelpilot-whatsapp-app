import React, { useState } from "react";
import { getLeadDisplayName } from "../utils/dashboardHelpers.js";
import { getOnboardingReadiness } from "../onboarding/onboardingReadiness.js";
import { getCoachOnboardingPreview } from "../onboarding/coachOnboardingPreview.js";
import { getFlowDraftWarnings } from "../campaigns/flowDraftReadiness.js";
import {
  filterLeads,
  leadStatus,
  ownership,
  priorityReason,
  formatDate,
  hasBookingMark,
  matchesSelectedConversation,
  STATUS_FILTERS,
} from "./previewModel.js";
import {
  Avatar,
  Badge,
  DefinitionList,
  EmptyState,
  Icon,
  LockedAction,
  Panel,
} from "./PreviewUi.jsx";

const sourceLabel = (value) =>
  ({
    instagram_dm: "Instagram DM",
    instagram_reel_comment: "Reel-Kommentar",
    instagram_story_reply: "Story-Antwort",
    whatsapp_dm: "WhatsApp",
    whatsapp_ctwa: "WhatsApp-Anzeige",
    instagram_new_follower: "Neuer Follower (manuell)",
  })[value] ||
  value ||
  "Nicht hinterlegt";
const campaignName = (lead, campaigns) =>
  campaigns.find((campaign) => String(campaign.id) === String(lead.campaignId))
    ?.name ||
  lead.campaignId ||
  "Nicht hinterlegt";
const statusBadge = (lead) => {
  const status = leadStatus(lead);
  return <Badge tone={status.tone}>{status.label}</Badge>;
};

export function CommandCenter({
  operational = false,
  leads,
  metrics,
  snapshot,
  onOpenLead,
  navigate,
  loading,
}) {
  const priorities = filterLeads(
    leads.filter((lead) => !lead.excluded && !lead.isDraft),
  ).slice(0, 5);
  const readiness = getOnboardingReadiness(snapshot.readiness?.data);
  const metricsConfig = [
    [
      "total",
      "Leads im Workspace",
      "Ohne ausgeschlossene Kontakte",
      "leads",
      "neutral",
    ],
    ["hot", "Heiß markiert", "Gespeicherte Lead-Markierung", "spark", "orange"],
    [
      "human",
      "Human Takeover",
      "Übernahme oder Pause bestätigt",
      "human",
      "purple",
    ],
    [
      "running",
      "Im Gespräch markiert",
      "Gespeicherter Gesprächsstatus",
      "inbox",
      "blue",
    ],
  ];
  return (
    <div className="v2-stack">
      <section className="v2-hero">
        <div>
          <span className="v2-eyebrow">KLARER FOKUS. GUTE GESPRÄCHE.</span>
          <h2>
            Dein nächster Schritt
            <br />
            beginnt im Gespräch.
          </h2>
          <p>
            Pete unterstützt. Du behältst den Überblick über Kontakte,
            Verantwortung und nächste Aktionen.
          </p>
          <div className="v2-row">
            <button
              type="button"
              className="v2-button v2-button-primary"
              onClick={() => navigate("inbox")}
            >
              Inbox öffnen <Icon name="arrow" size={17} />
            </button>
            <button
              type="button"
              className="v2-text-button"
              onClick={() => navigate("leads")}
            >
              Alle Leads ansehen <Icon name="chevron" size={16} />
            </button>
          </div>
        </div>
        <div className="v2-hero-note">
          <span className="v2-pete-symbol">
            <Icon name="spark" size={30} />
          </span>
          <strong>Pete, dein KI-Setter</strong>
          <p>Gespeicherte Zustände statt geschätzter Kennzahlen.</p>
          <span className="v2-hero-rule" />
          <small>
            Die KI bleibt unter der Kontrolle
            <br />
            deines lokalen Pete-Labors.
          </small>
        </div>
      </section>
      <div className="v2-metrics">
        {metricsConfig.map(([key, label, hint, icon, tone]) => (
          <div className="v2-metric" key={key}>
            <div className="v2-metric-top">
              <span>{label}</span>
              <span className={`v2-metric-icon tone-${tone}`}>
                <Icon name={icon} size={19} />
              </span>
            </div>
            <strong>{loading ? "…" : (metrics[key] ?? "—")}</strong>
            <small>
              {metrics[key] === null && !loading
                ? "Datenquelle nicht verfügbar"
                : hint}
            </small>
          </div>
        ))}
      </div>
      <div className="v2-command-grid">
        <Panel
          title="Deine Lead-Prioritäten"
          caption="Human Takeover zuerst, danach gespeicherte Lead-Signale."
          action={
            <button
              type="button"
              className="v2-text-button"
              onClick={() => navigate("leads")}
            >
              Alle ansehen <Icon name="arrow" size={15} />
            </button>
          }
        >
          {!priorities.length ? (
            <EmptyState
              title={
                snapshot.leads?.error
                  ? "Lead-Daten fehlen"
                  : loading
                    ? "Leads werden geladen"
                    : "Noch keine Leads vorhanden"
              }
            >
              {snapshot.leads?.error ||
                "Sobald Kontakte im bestehenden Backend gespeichert sind, erscheinen sie hier."}
            </EmptyState>
          ) : (
            <div className="v2-priority-list">
              {priorities.map((lead) => (
                <button
                  type="button"
                  className="v2-priority-row"
                  key={lead.id}
                  onClick={() => onOpenLead(lead)}
                >
                  <Avatar name={lead.name} />
                  <span className="v2-priority-identity">
                    <strong>{getLeadDisplayName(lead)}</strong>
                    <small>{priorityReason(lead)}</small>
                  </span>
                  {statusBadge(lead)}
                  <Icon name="chevron" size={17} />
                </button>
              ))}
            </div>
          )}
          <div className="v2-panel-footnote">
            <Icon name="info" size={14} />
            Priorität ist keine Aussage über ungelesene Nachrichten oder
            Kaufwahrscheinlichkeit.
          </div>
        </Panel>
        <div className="v2-stack">
          <Panel
            title="Workspace-Status"
            caption="Konfiguration und Nachweise getrennt prüfen."
          >
            <div className="v2-system-row">
              <span className="v2-system-icon">
                <Icon name="check" size={17} />
              </span>
              <div>
                <strong>{operational ? "Funktionaler Coach-Workspace" : "Lesende Vorschau"}</strong>
                <small>{operational ? "Gespeicherte Kampagnen und Einstellungen bearbeitbar. Versand bleibt gesperrt." : "Keine Schreib- oder Versandfunktion eingebunden"}</small>
              </div>
              <Badge tone="green">Aktiv</Badge>
            </div>
            <div className="v2-system-row">
              <span className="v2-system-icon">
                <Icon name="lock" size={17} />
              </span>
              <div>
                <strong>Lokale Sendesperren</strong>
                <small>
                  {readiness.backendReachable
                    ? readiness.sendLocked === true
                      ? "Backend meldet sicheren lokalen Modus"
                      : "Sicherer lokaler Modus nicht bestätigt"
                    : "Readiness-Nachweis fehlt"}
                </small>
              </div>
              <Badge tone={readiness.sendLocked === true ? "green" : "orange"}>
                {readiness.sendLocked === true ? "Bestätigt" : "Prüfen"}
              </Badge>
            </div>
            <div className="v2-system-row">
              <span className="v2-system-icon">
                <Icon name="spark" size={17} />
              </span>
              <div>
                <strong>KI-Test und Budget</strong>
                <small>{operational ? "Direkt über Pete testen im Dashboard" : "Nur im bestehenden Pete-Desktop-Labor"}</small>
              </div>
              <Badge>{operational ? "Im Dashboard" : "Separat"}</Badge>
            </div>
          </Panel>
          <div className="v2-next-card">
            <span className="v2-eyebrow">GUT VORBEREITET</span>
            <h3>Alles bereit für die Prüfung?</h3>
            <p>
              Marke, Angebote und Verbindungen Schritt für Schritt
              kontrollieren.
            </p>
            <button
              type="button"
              className="v2-text-button"
              onClick={() => navigate("onboarding")}
            >
              Einrichtung ansehen <Icon name="arrow" size={17} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContactFilters({
  leads,
  campaigns,
  filters,
  setFilters,
  search,
  setSearch,
  count,
}) {
  const sources = [
    ...new Set(leads.map((lead) => lead.source).filter(Boolean)),
  ].sort();
  const set = (key, value) =>
    setFilters((previous) => ({ ...previous, [key]: value }));
  const active =
    search ||
    filters.status !== "all" ||
    filters.source !== "all" ||
    filters.campaign !== "all" ||
    filters.sort !== "priority";
  return (
    <div className="v2-filter-bar">
      <div className="v2-filter-main">
        <label className="v2-search">
          <Icon name="search" size={18} />
          <span className="v2-sr-only">Leads durchsuchen</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, Nummer oder Tag suchen …"
          />
        </label>
        <label className="v2-filter">
          <span>Status</span>
          <select
            aria-label="Status filtern"
            value={filters.status}
            onChange={(event) => set("status", event.target.value)}
          >
            {STATUS_FILTERS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="v2-filter">
          <span>Quelle</span>
          <select
            aria-label="Quelle filtern"
            value={filters.source}
            onChange={(event) => set("source", event.target.value)}
          >
            <option value="all">Alle Quellen</option>
            {sources.map((source) => (
              <option key={source}>{source}</option>
            ))}
          </select>
        </label>
        <label className="v2-filter">
          <span>Kampagne</span>
          <select
            aria-label="Kampagne filtern"
            value={filters.campaign}
            onChange={(event) => set("campaign", event.target.value)}
          >
            <option value="all">Alle Kampagnen</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={String(campaign.id)}>
                {campaign.name || campaign.id}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="v2-filter-bottom">
        <span role="status" aria-live="polite">
          <strong>{count}</strong> Treffer
        </span>
        <div className="v2-row">
          <label className="v2-sort">
            Sortierung{" "}
            <select
              aria-label="Leads sortieren"
              value={filters.sort}
              onChange={(event) => set("sort", event.target.value)}
            >
              <option value="priority">Priorität</option>
              <option value="recent">Letzte Aktivität</option>
              <option value="name">Name A–Z</option>
            </select>
          </label>
          {active && (
            <button
              type="button"
              className="v2-text-button"
              onClick={() => {
                setSearch("");
                setFilters({
                  status: "all",
                  source: "all",
                  campaign: "all",
                  sort: "priority",
                });
              }}
            >
              Filter zurücksetzen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ContactContext({ selected, campaigns, onInbox }) {
  if (!selected)
    return (
      <EmptyState icon="leads" title="Kontakt auswählen">
        Wähle einen Lead aus, um den gespeicherten Kontext zu sehen.
      </EmptyState>
    );
  return (
    <div className="v2-contact-context">
      <div className="v2-contact-profile">
        <Avatar name={selected.name} large />
        <h2>{getLeadDisplayName(selected)}</h2>
        <p>{selected.phone || "Keine Telefonnummer hinterlegt"}</p>
        {statusBadge(selected)}
      </div>
      <div className="v2-context-section">
        <h3>Verantwortung</h3>
        <div className="v2-owner">
          <Icon name="human" size={17} />
          <span>{ownership(selected)}</span>
        </div>
        <p className="v2-muted">
          Eine Zuordnung an Pete bestätigt weder einen KI-Aufruf noch einen
          aktiven Versand.
        </p>
        <div className="v2-row">
          <LockedAction>Übernehmen</LockedAction>
          <LockedAction>An Pete</LockedAction>
        </div>
      </div>
      <div className="v2-context-section">
        <h3>Kontaktinformationen</h3>
        <DefinitionList
          rows={[
            ["Quelle", selected.source],
            ["Kampagne", campaignName(selected, campaigns)],
            ["Phase", selected.stage || selected.conversation?.stage],
            ["Interesse", selected.intent],
            [
              "Letzte Aktivität",
              formatDate(
                selected.conversation?.updatedAt || selected.lastActivityAt,
              ),
            ],
          ]}
        />
      </div>
      <div className="v2-context-section">
        <h3>Tags</h3>
        <div className="v2-tags">
          {selected.tags.length ? (
            selected.tags.map((tag, index) => (
              <span className="v2-tag" key={`${tag}-${index}`}>
                {String(tag)}
              </span>
            ))
          ) : (
            <p className="v2-muted">Keine Tags hinterlegt.</p>
          )}
        </div>
      </div>
      <div className="v2-context-section">
        <h3>Notizen</h3>
        <p className="v2-note-text">
          {selected.note || "Keine Notizen hinterlegt."}
        </p>
      </div>
      <div className="v2-context-section">
        <h3>Termin</h3>
        <DefinitionList
          rows={[
            [
              "Markierung",
              hasBookingMark(selected)
                ? "Als gebucht markiert"
                : selected.bookingData?.status || "Nicht hinterlegt",
            ],
            ["Zeitfenster", selected.bookingData?.selectedSlot],
            ["Anbieter", selected.bookingData?.bookingProvider],
          ]}
        />
        <p className="v2-muted">
          Eine Markierung ersetzt keinen bestätigten Anbieter-Nachweis.
        </p>
      </div>
      {onInbox && (
        <div className="v2-context-section">
          <button
            type="button"
            className="v2-button v2-button-primary"
            onClick={onInbox}
          >
            Gespräch ansehen <Icon name="arrow" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function Conversation({ selected, detail }) {
  if (!selected)
    return (
      <EmptyState title="Deine Inbox ist bereit">
        Wähle einen Kontakt aus. Hier erscheint der vorhandene Gesprächsverlauf.
      </EmptyState>
    );
  const messages = matchesSelectedConversation(selected, detail.data?.state)
    ? detail.data.state.messages
    : null;
  return (
    <div className="v2-conversation">
      <header className="v2-conversation-heading">
        <Avatar name={selected.name} />
        <div>
          <h2>{getLeadDisplayName(selected)}</h2>
          <small>{ownership(selected)}</small>
        </div>
        <span className="v2-conversation-badge">{statusBadge(selected)}</span>
      </header>
      <div className="v2-conversation-meta">
        <Icon name="info" size={14} />
        Gespeicherter Verlauf · kein Live-Chat und kein neuer KI-Test
      </div>
      <div
        className="v2-message-area"
        role="region"
        aria-label="Gespeicherter Gesprächsverlauf"
        tabIndex={0}
      >
        {detail.loading ? (
          <EmptyState title="Gespräch wird geladen">
            Nur der ausgewählte Datensatz wird abgerufen.
          </EmptyState>
        ) : detail.error ? (
          <EmptyState title="Gespräch nicht verfügbar">
            {detail.error}
          </EmptyState>
        ) : !Array.isArray(messages) || !messages.length ? (
          <EmptyState
            title={
              selected.backendStateConnected
                ? "Noch keine Nachrichten"
                : "Kein Gespräch zugeordnet"
            }
          >
            {selected.backendStateConnected
              ? "Für diesen Datensatz liegt kein gespeicherter Verlauf vor."
              : "Ein Gespräch wird in dieser Vorschau nicht automatisch angelegt."}
          </EmptyState>
        ) : (
          messages.map((message, index) => {
            const incoming =
              message.role === "user" || message.actor === "lead";
            const actor = incoming
              ? getLeadDisplayName(selected)
              : message.actor === "human"
                ? "Mensch"
                : "Pete / System";
            const delivery = incoming
              ? null
              : message.dryRun === true
                ? "Trockenlauf"
                : message.sent === true
                  ? "Als gesendet protokolliert"
                  : message.sent === false
                    ? "Nicht gesendet"
                    : "Versand nicht belegt";
            return (
              <div
                className={`v2-message${incoming ? " is-incoming" : " is-outgoing"}`}
                key={message.id || index}
              >
                <div className="v2-message-author">
                  {actor}
                  <time>{formatDate(message.createdAt)}</time>
                </div>
                <div className="v2-message-bubble">
                  {String(message.text || "")}
                </div>
                {delivery && (
                  <div className="v2-message-delivery">{delivery}</div>
                )}
              </div>
            );
          })
        )}
      </div>
      <div className="v2-composer">
        <label>
          <span className="v2-sr-only">Nachricht in der Vorschau gesperrt</span>
          <textarea
            disabled
            placeholder="Nachrichtenversand ist in der Vorschau deaktiviert."
            rows={2}
          />
        </label>
        <div className="v2-composer-footer">
          <span>
            <Icon name="lock" size={14} />
            Nur lesender Prüfmodus
          </span>
          <LockedAction primary>Senden</LockedAction>
        </div>
      </div>
    </div>
  );
}

export function ContactsView({
  leads,
  visible,
  selected,
  campaigns,
  filters,
  setFilters,
  search,
  setSearch,
  onSelect,
  detail,
  mobilePane,
  setMobilePane,
  inbox,
  loading,
  leadsError,
}) {
  return (
    <div className="v2-stack">
      <ContactFilters
        {...{ leads, campaigns, filters, setFilters, search, setSearch }}
        count={visible.length}
      />
      <div className="v2-mobile-panes" aria-label="Kontaktansicht">
        <button
          type="button"
          aria-pressed={mobilePane === "list"}
          onClick={() => setMobilePane("list")}
        >
          Liste
        </button>
        {inbox && (
          <button
            type="button"
            disabled={!selected}
            aria-pressed={mobilePane === "chat"}
            onClick={() => setMobilePane("chat")}
          >
            Gespräch
          </button>
        )}
        <button
          type="button"
          disabled={!selected}
          aria-pressed={mobilePane === "context"}
          onClick={() => setMobilePane("context")}
        >
          Kontakt
        </button>
      </div>
      <div
        className={`v2-contacts-layout${inbox ? " is-inbox" : ""}`}
        data-mobile-pane={mobilePane}
      >
        <section className="v2-contact-list v2-panel" aria-label="Lead-Liste">
          <div className="v2-list-heading">
            <h2>{inbox ? "Gespräche" : "Deine Leads"}</h2>
            <span>{visible.length}</span>
          </div>
          {!visible.length ? (
            <EmptyState
              title={
                loading
                  ? "Kontakte werden geladen"
                  : leadsError
                    ? "Lead-Daten nicht verfügbar"
                    : leads.length
                      ? "Keine passenden Leads"
                      : "Noch keine Kontakte"
              }
            >
              {leadsError ||
                (leads.length
                  ? "Ändere deine Suche oder setze die Filter zurück."
                  : "Es werden ausschließlich gespeicherte Kontakte aus dem bestehenden Backend angezeigt.")}
            </EmptyState>
          ) : (
            visible.map((lead) => (
              <button
                type="button"
                key={lead.id}
                className={`v2-contact-row${selected?.id === lead.id ? " is-selected" : ""}`}
                aria-pressed={selected?.id === lead.id}
                onClick={() => onSelect(lead.id)}
              >
                <Avatar name={lead.name} />
                <span className="v2-contact-row-content">
                  <span className="v2-contact-row-top">
                    <strong>{getLeadDisplayName(lead)}</strong>
                    <small>{lead.source || "Quelle fehlt"}</small>
                  </span>
                  <span className="v2-contact-row-sub">
                    {lead.phone || "Keine Nummer hinterlegt"}
                  </span>
                  <span className="v2-contact-row-status">
                    {statusBadge(lead)}
                    <span>
                      {lead.conversation?.updatedAt || lead.lastActivityAt
                        ? formatDate(
                            lead.conversation?.updatedAt || lead.lastActivityAt,
                          )
                        : "Aktivität fehlt"}
                    </span>
                  </span>
                </span>
              </button>
            ))
          )}
        </section>
        {inbox && (
          <section className="v2-panel v2-chat-column">
            <Conversation selected={selected} detail={detail} />
          </section>
        )}
        <aside
          className="v2-panel v2-context-column"
          aria-label="Kontaktkontext"
        >
          <ContactContext selected={selected} campaigns={campaigns} />
        </aside>
      </div>
      <p className="v2-subtle-note">
        „Human Takeover“ benötigt einen passenden Backend-Zustand. Fehlender
        Status bedeutet keine automatische Pete-Freigabe.
      </p>
    </div>
  );
}

export function CampaignsPreview({ campaigns, snapshot, loading }) {
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const visible = campaigns.filter((campaign) =>
    [
      campaign.name,
      campaign.trigger,
      ...(campaign.peteCampaign?.keywords || []),
    ]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const selected =
    visible.find((campaign) => campaign.id === selectedId) || visible[0];
  const config = selected?.peteCampaign;
  const warnings = getFlowDraftWarnings(config);
  return (
    <div className="v2-stack">
      <div className="v2-section-toolbar">
        <label className="v2-search">
          <Icon name="search" size={18} />
          <span className="v2-sr-only">Kampagnen durchsuchen</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Kampagne oder Keyword suchen …"
          />
        </label>
        <LockedAction primary>Kampagne anlegen</LockedAction>
      </div>
      <div className="v2-campaign-layout">
        <Panel
          title="Kampagnen"
          caption={`${visible.length} gespeicherte Konfigurationen`}
        >
          {!visible.length ? (
            <EmptyState
              title={
                loading ? "Kampagnen werden geladen" : "Keine Kampagne gefunden"
              }
            >
              {snapshot.campaigns?.error ||
                "Es werden keine Beispielkampagnen als gespeicherte Daten eingeblendet."}
            </EmptyState>
          ) : (
            visible.map((campaign) => (
              <button
                type="button"
                className={`v2-campaign-row${selected?.id === campaign.id ? " is-selected" : ""}`}
                aria-pressed={selected?.id === campaign.id}
                onClick={() => setSelectedId(campaign.id)}
                key={campaign.id}
              >
                <span className="v2-campaign-symbol">
                  <Icon name="campaigns" />
                </span>
                <span>
                  <strong>{campaign.name || campaign.id}</strong>
                  <small>
                    {(campaign.peteCampaign?.sources || [])
                      .map(sourceLabel)
                      .join(" · ") || "Keine Quellen hinterlegt"}
                  </small>
                  <Badge tone="orange">
                    Gespeichert · Ausführung ungeprüft
                  </Badge>
                </span>
                <Icon name="chevron" size={16} />
              </button>
            ))
          )}
        </Panel>
        {selected ? (
          <div className="v2-stack">
            <Panel
              title={selected.name || selected.id}
              caption="Eingang, Antwort und Übergabe in einer klaren Reihenfolge."
              action={<LockedAction>Speichern</LockedAction>}
            >
              <ol className="v2-flow-steps">
                <li>
                  <span>1</span>
                  <div>
                    <h3>Eingang & Keyword</h3>
                    <p>
                      {config?.sources?.length
                        ? config.sources.map(sourceLabel).join(", ")
                        : "Keine Quellen hinterlegt"}
                    </p>
                    <div className="v2-tags">
                      {config?.keywords?.map((keyword) => (
                        <span key={keyword} className="v2-tag">
                          {keyword}
                        </span>
                      ))}
                    </div>
                    <p className="v2-muted">
                      {selected.trigger
                        ? `Gespeicherter Auslöser: ${selected.trigger}`
                        : "Kein zusätzlicher Auslöser hinterlegt."}
                    </p>
                  </div>
                </li>
                <li>
                  <span>2</span>
                  <div>
                    <h3>Erste Antwort</h3>
                    <div className="v2-saved-copy">
                      {config?.openingText ||
                        selected.welcome ||
                        "Kein Antworttext hinterlegt."}
                    </div>
                    <p className="v2-muted">
                      Feste Antwort konfiguriert:{" "}
                      {config
                        ? config.autoReplyEnabled === true
                          ? "ja"
                          : "nein"
                        : "unbekannt"}
                    </p>
                  </div>
                </li>
                <li>
                  <span>3</span>
                  <div>
                    <h3>Übergabe an Pete</h3>
                    <p>
                      {config
                        ? config.peteHandoffEnabled === true
                          ? "In der Konfiguration vorgesehen."
                          : "In dieser Konfiguration nicht eingeschaltet."
                        : "Keine Pete-Konfiguration vorhanden."}
                    </p>
                    <p className="v2-muted">
                      Eine gespeicherte Einstellung aktiviert in der Vorschau
                      keine Automatik.
                    </p>
                  </div>
                </li>
                <li>
                  <span>4</span>
                  <div>
                    <h3>Nachfassen & Termin</h3>
                    <DefinitionList
                      rows={[
                        [
                          "Nachfassen konfiguriert",
                          config
                            ? config.followUpEnabled === true
                              ? "Ja"
                              : "Nein"
                            : "Unbekannt",
                        ],
                        ["Buchungsanbieter", selected.booking?.provider],
                      ]}
                    />
                  </div>
                </li>
              </ol>
            </Panel>
            <Panel
              title="Prüfpunkte"
              caption="Konfigurationsprüfung, keine Live-Freigabe."
            >
              {warnings.length ? (
                <ul className="v2-checklist">
                  {warnings.map((warning) => (
                    <li key={warning}>
                      <Icon name="info" size={17} />
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="v2-card-copy">
                  Keine Lücken in dieser Entwurfsprüfung erkannt. Versand und
                  Integrationen bleiben separat zu prüfen.
                </p>
              )}
            </Panel>
          </div>
        ) : (
          <Panel>
            <EmptyState icon="campaigns" title="Kampagne auswählen">
              Die gespeicherte Konfiguration erscheint hier als übersichtlicher
              Ablauf.
            </EmptyState>
          </Panel>
        )}
      </div>
    </div>
  );
}

export function FollowUpsPreview({
  leads,
  visible,
  selected,
  filters,
  setFilters,
  search,
  setSearch,
  campaigns,
  onSelect,
  followUp,
  snapshot,
}) {
  const record = matchesSelectedConversation(selected, followUp.data)
    ? followUp.data
    : null;
  const evaluation = record?.evaluation;
  const schedules = snapshot.schedules?.data?.schedules;
  return (
    <div className="v2-stack">
      <div className="v2-notice">
        <Icon name="info" size={17} />
        Fälligkeit wird ausschließlich aus der vorhandenen Backend-Auswertung
        übernommen. Hier wird keine Nachricht versendet.
      </div>
      <ContactFilters
        {...{ leads, campaigns, filters, setFilters, search, setSearch }}
        count={visible.length}
      />
      <div className="v2-command-grid">
        <Panel title="Kontakt prüfen">
          <div className="v2-followup-list">
            {visible.length ? (
              visible.map((lead) => (
                <button
                  type="button"
                  className={`v2-priority-row${selected?.id === lead.id ? " is-selected" : ""}`}
                  onClick={() => onSelect(lead.id)}
                  key={lead.id}
                  aria-pressed={selected?.id === lead.id}
                >
                  <Avatar name={lead.name} />
                  <span className="v2-priority-identity">
                    <strong>{getLeadDisplayName(lead)}</strong>
                    <small>{ownership(lead)}</small>
                  </span>
                  <Icon name="chevron" size={16} />
                </button>
              ))
            ) : (
              <EmptyState title="Keine passenden Kontakte">
                Ohne gespeicherte Kontakte gibt es keine individuelle
                Fälligkeitsprüfung.
              </EmptyState>
            )}
          </div>
        </Panel>
        <Panel
          title="Nächste Nachfassaktion"
          caption={
            selected ? getLeadDisplayName(selected) : "Kontakt auswählen"
          }
        >
          {followUp.loading ? (
            <p className="v2-card-copy" role="status">
              Backend-Auswertung wird geladen …
            </p>
          ) : !evaluation ? (
            <EmptyState title="Fälligkeit nicht bestätigt">
              {followUp.error ||
                "Kein passender Gesprächszustand mit Backend-Auswertung vorhanden."}
            </EmptyState>
          ) : (
            <div className="v2-card-copy">
              <Badge tone={evaluation.dueNow === true ? "orange" : "neutral"}>
                {evaluation.dueNow === true
                  ? "Laut Backend fällig"
                  : "Laut Backend nicht fällig"}
              </Badge>
              <DefinitionList
                rows={[
                  ["Status", evaluation.reason],
                  ["Nächster Zeitpunkt", formatDate(evaluation.nextDueAt)],
                  ["Stufe", evaluation.stage],
                  ["Letzter Eingang", formatDate(record.lastUserMessageAt)],
                ]}
              />
              <div className="v2-saved-copy">
                {record.messagePreview ||
                  "Aktuell kein Nachrichtentext zur Vorschau freigegeben."}
              </div>
              <p className="v2-muted">
                Fälligkeit ersetzt keine Versandberechtigung. Das
                24-Stunden-Fenster und alle Backend-Sperren bleiben maßgeblich.
              </p>
              <LockedAction primary>Nachfassaktion ausführen</LockedAction>
            </div>
          )}
        </Panel>
      </div>
      <Panel
        title="Gespeicherter Zeitplan"
        caption="Bestehende Konfiguration; keine neue Automatik."
      >
        {schedules ? (
          <div className="v2-card-copy">
            {schedules.length ? (
              schedules.map((schedule, index) => (
                <details className="v2-disclosure" key={index}>
                  <summary>
                    Zyklus {schedule.cycle ?? index + 1} ·{" "}
                    {schedule.slots?.length ?? 0} Zeitfenster
                  </summary>
                  <DefinitionList
                    rows={(schedule.slots || []).map((slot, i) => [
                      `Zeitfenster ${i + 1}`,
                      `${slot.label || slot.stage || "Stufe fehlt"} · ${slot.dayOffsetHours ?? "?"} Stunden Versatz`,
                    ])}
                  />
                </details>
              ))
            ) : (
              <p>Kein Zeitplan hinterlegt.</p>
            )}
          </div>
        ) : (
          <p className="v2-card-copy">
            {snapshot.schedules?.error || "Zeitplan nicht verfügbar."}
          </p>
        )}
      </Panel>
    </div>
  );
}

const SETUP_STEPS = [
  "Überblick",
  "Marke & Pete",
  "Angebote",
  "Verbindungen",
  "Testvorbereitung",
  "Prüfabschluss",
];
export function OnboardingPreview({ snapshot }) {
  const [step, setStep] = useState(0);
  const settings = snapshot.settings?.data?.settings;
  const profile = settings ? getCoachOnboardingPreview(settings) : null;
  const ready = getOnboardingReadiness(snapshot.readiness?.data);
  const headingRef = React.useRef(null);
  function go(index) {
    setStep(index);
    requestAnimationFrame(() => headingRef.current?.focus());
  }
  return (
    <div className="v2-onboarding">
      <Panel
        title="Ein klarer Weg zu deinem Workspace"
        caption="Gespeicherte Informationen prüfen. Kein Fortschritt wird als erledigt gespeichert."
      >
        <ol className="v2-setup-steps">
          {SETUP_STEPS.map((label, index) => (
            <li key={label}>
              <button
                type="button"
                aria-current={step === index ? "step" : undefined}
                onClick={() => go(index)}
              >
                <span>{index + 1}</span>
                <strong>{label}</strong>
              </button>
            </li>
          ))}
        </ol>
      </Panel>
      <Panel className="v2-setup-content">
        <div className="v2-setup-body">
          <span className="v2-eyebrow">
            SCHRITT {step + 1} VON {SETUP_STEPS.length}
          </span>
          <h2 ref={headingRef} tabIndex={-1}>
            {
              [
                "Dein Workspace. Dein Pete.",
                "Eine klare Identität für gute Gespräche.",
                "Deine Angebote, verständlich hinterlegt.",
                "Verbindungen mit nachvollziehbarem Status.",
                "Gut vorbereitet in den Laptop-Test.",
                "Bereit für die separate Besitzerprüfung.",
              ][step]
            }
          </h2>
          <p className="v2-setup-intro">
            {
              [
                "Wir führen dich durch Marke, Angebote und Verbindungen. Alle Texte sind in Hell- und Dunkelmodus lesbar. Dieser Ablauf aktiviert keine Funktion.",
                "Die Vorschau zeigt genau die vorhandene Profilquelle. Fehlende Angaben werden nicht aus anderen Marken ergänzt.",
                "Nur gespeicherte Entwürfe erscheinen hier. Preise, Leistungen und FAQ werden nicht erfunden.",
                "Konfigurierte Zugangsdaten sind noch kein erfolgreicher Versand- oder Synchronisationstest.",
                "Der echte KI-Schalter und das Budget gehören zum bestehenden Pete-Desktop-Labor. Diese Dashboard-Vorschau führt keinen KI-Aufruf aus.",
                "Der Schrittwechsel ist eine Navigation zur Prüfung. Er bestätigt keinen bestandenen Test und speichert keine Freigabe.",
              ][step]
            }
          </p>
          {!settings && (
            <div className="v2-notice">
              Profilinformationen fehlen:{" "}
              {snapshot.settings?.error || "noch nicht geladen"}.
            </div>
          )}
          {step === 0 && (
            <div className="v2-setup-benefits">
              {[
                [
                  "leads",
                  "Kontakte im Mittelpunkt",
                  "Prioritäten und Gesprächsverantwortung aus vorhandenen Daten.",
                ],
                [
                  "inbox",
                  "Kontext statt Suchen",
                  "Gespräch und Kontaktinformationen direkt nebeneinander.",
                ],
                [
                  "lock",
                  "Kontrolliert vorbereiten",
                  "KI, Budget und Versand werden durch die Vorschau nicht verändert.",
                ],
              ].map(([icon, title, copy]) => (
                <div key={title}>
                  <span>
                    <Icon name={icon} />
                  </span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </div>
              ))}
            </div>
          )}
          {step === 1 && (
            <>
              <Badge>
                {profile?.identitySource === "coach_draft"
                  ? "Coach-Entwurf"
                  : profile
                    ? "Aktiver Workspace · Legacy-Quelle"
                    : "Quelle fehlt"}
              </Badge>
              <DefinitionList
                rows={[
                  ["Marke", profile?.brand],
                  ["Betreiber", profile?.operator],
                  ["Assistent", profile?.assistant],
                  ["Zielgruppe", profile?.audience],
                  ["Tonalität", profile?.tone],
                ]}
              />
            </>
          )}
          {step === 2 && (
            <>
              {profile?.offers.length ? (
                profile.offers.map((offer, index) => (
                  <div key={index} className="v2-offer-card">
                    <h3>{String(offer.name)}</h3>
                    <p>
                      {String(
                        offer.description ||
                          offer.summary ||
                          "Keine Beschreibung hinterlegt.",
                      )}
                    </p>
                    <Badge>Gespeicherter Entwurf</Badge>
                  </div>
                ))
              ) : (
                <EmptyState icon="campaigns" title="Noch kein Angebotsentwurf">
                  Im vorhandenen Coach-Profil ist kein Angebot gespeichert.
                </EmptyState>
              )}
              <p className="v2-muted">
                {profile ? profile.faqs.length : "Keine bestätigte Anzahl an"}{" "}
                vollständige FAQ im gespeicherten Profil.
              </p>
            </>
          )}
          {step === 3 && (
            <div className="v2-provider-grid">
              {[
                ["Instagram", ready.instagramConfigured],
                ["WhatsApp", ready.whatsappConfigured],
                ["OpenAI-Schlüssel", ready.aiKeyConfigured],
              ].map(([label, configured]) => (
                <div className="v2-provider" key={label}>
                  <h3>{label}</h3>
                  <Badge tone={configured ? "green" : "neutral"}>
                    {configured ? "Konfiguration gemeldet" : "Nicht bestätigt"}
                  </Badge>
                  <p>
                    {label === "OpenAI-Schlüssel"
                      ? "Kein Schlüssel wird angezeigt oder geprüft. Budgetfreigabe separat."
                      : "Live-Funktion nicht nachgewiesen. In der Vorschau keine Konto-Verbindung."}
                  </p>
                  <LockedAction>Verbinden / prüfen</LockedAction>
                </div>
              ))}
            </div>
          )}
          {step === 4 && (
            <ul className="v2-checklist">
              <li>
                <Icon name="info" />
                <span>
                  Den bereits vorhandenen Pete-Laptop-Test abschließen.
                </span>
              </li>
              <li>
                <Icon name="lock" />
                <span>
                  KI-Freigabe, Kostenverbrauch und Restbudget direkt im
                  bestehenden Pete-Desktop-Labor prüfen. Diese Vorschau
                  aktiviert oder sperrt keine KI.
                </span>
              </li>
              <li>
                <Icon name="leads" />
                <span>
                  Danach Dashboard 2.0 auf dem eigenen Datenbestand separat
                  prüfen.
                </span>
              </li>
            </ul>
          )}
          {step === 5 && (
            <>
              <div className="v2-notice">
                <Icon name="lock" />
                Keine Freigabe gespeichert. Dashboard 2.0 bleibt eine separate
                Vorschau.
              </div>
              <DefinitionList
                rows={[
                  ["Aktivierung", "Ausstehend"],
                  ["KI-Test", "In dieser Vorschau nicht ausgeführt"],
                  ["Datenänderungen", "Gesperrt"],
                  ["Live-Versand", "Nicht verfügbar"],
                ]}
              />
              <LockedAction primary>Freigabe nach Besitzerprüfung</LockedAction>
            </>
          )}
          {step > 0 && step < 3 && profile?.warnings.length > 0 && (
            <details className="v2-disclosure">
              <summary>
                Hinweise zum gespeicherten Profil ({profile.warnings.length})
              </summary>
              <ul>
                {profile.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="v2-setup-footer">
            <button
              type="button"
              className="v2-button"
              disabled={step === 0}
              onClick={() => go(step - 1)}
            >
              Zurück
            </button>
            <span>Nur Ansicht · keine Speicherung</span>
            {step < SETUP_STEPS.length - 1 ? (
              <button
                type="button"
                className="v2-button v2-button-primary"
                onClick={() => go(step + 1)}
              >
                Weiter <Icon name="arrow" size={16} />
              </button>
            ) : (
              <button type="button" className="v2-button" onClick={() => go(0)}>
                Zum Überblick
              </button>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}

export function SettingsPreview({ snapshot }) {
  const settings = snapshot.settings?.data?.settings;
  const readiness = getOnboardingReadiness(snapshot.readiness?.data);
  return (
    <div className="v2-stack">
      <div className="v2-notice">
        <Icon name="lock" />
        Einstellungen sind in dieser Vorschau schreibgeschützt. Der KI-Schalter
        wird ausschließlich im bestehenden lokalen Labor bedient.
      </div>
      <div className="v2-settings-grid">
        <Panel
          title="Workspace & Darstellung"
          caption="Vorhandene Identität und Einstellungen."
        >
          <div className="v2-card-copy">
            {settings ? (
              <DefinitionList
                rows={[
                  ["Produkt", settings.productName],
                  ["Betreiber", settings.adminName],
                  ["Marke", settings.companyName],
                  ["Assistent", settings.assistantName],
                  ["Gespeichertes Standarddesign", settings.defaultTheme],
                ]}
              />
            ) : (
              <p>{snapshot.settings?.error || "Einstellungen fehlen."}</p>
            )}
            <p className="v2-muted">
              Der Hell-/Dunkelwechsel in der Vorschau gilt nur bis zum Neuladen.
            </p>
          </div>
        </Panel>
        <Panel
          title="Pete & Sicherheit"
          caption="Konfigurationswerte sind keine Ausführungsnachweise."
        >
          <div className="v2-card-copy">
            <DefinitionList
              rows={[
                [
                  "Backend erreichbar",
                  readiness.backendReachable
                    ? "Readiness bestätigt"
                    : "Nicht bestätigt",
                ],
                [
                  "Sicherer lokaler Modus",
                  readiness.sendLocked === true
                    ? "Bestätigt"
                    : "Nicht bestätigt",
                ],
                [
                  "KI in Einstellungen",
                  settings
                    ? settings.aiEnabled === true
                      ? "Als eingeschaltet gespeichert"
                      : settings.aiEnabled === false
                        ? "Als ausgeschaltet gespeichert"
                        : "Unbekannt"
                    : "Unbekannt",
                ],
                ["Modell in Einstellungen", settings?.aiModel],
                [
                  "Budget / historische Kosten",
                  "Im bestehenden Desktop-Labor abzugleichen",
                ],
              ]}
            />
            <LockedAction>KI-Einstellung ändern</LockedAction>
          </div>
        </Panel>
      </div>
      <Panel title="Weitere Einstellungen">
        <div className="v2-card-copy">
          {[
            [
              "Buchung & Kalender",
              [
                ["Standardanbieter", settings?.defaultBookingProvider],
                ["Meetingtyp", settings?.defaultMeetingType],
              ],
            ],
            [
              "Rechtliche Angaben",
              [
                [
                  "Impressum",
                  settings?.imprintUrl
                    ? "URL hinterlegt · nicht extern geprüft"
                    : "Nicht hinterlegt",
                ],
                [
                  "Datenschutz",
                  settings?.privacyPolicyUrl
                    ? "URL hinterlegt · nicht extern geprüft"
                    : "Nicht hinterlegt",
                ],
              ],
            ],
          ].map(([title, rows]) => (
            <details className="v2-disclosure" key={title}>
              <summary>{title}</summary>
              <DefinitionList rows={rows} />
            </details>
          ))}
          <LockedAction primary>Einstellungen speichern</LockedAction>
        </div>
      </Panel>
    </div>
  );
}

export function BookingsPreview({ leads, snapshot, eventsOnly }) {
  const booked = leads.filter((lead) => !lead.excluded && hasBookingMark(lead));
  const events = snapshot.events?.data?.events;
  return (
    <div className="v2-stack">
      {!eventsOnly && (
        <Panel
          title="Im Lead markierte Termine"
          caption="Gespeicherte Markierungen, keine synchronisierte Kalenderansicht."
        >
          {booked.length ? (
            <div className="v2-table-scroll">
              <table className="v2-table">
                <thead>
                  <tr>
                    <th>Kontakt</th>
                    <th>Zeitfenster</th>
                    <th>Anbieter</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {booked.map((lead) => (
                    <tr key={lead.id}>
                      <td>{getLeadDisplayName(lead)}</td>
                      <td>
                        {lead.bookingData?.selectedSlot || "Nicht hinterlegt"}
                      </td>
                      <td>
                        {lead.bookingData?.bookingProvider ||
                          "Nicht hinterlegt"}
                      </td>
                      <td>
                        <Badge tone="green">Termin markiert</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon="appointments"
              title={
                snapshot.leads?.error
                  ? "Termindaten fehlen"
                  : "Keine Terminmarkierung vorhanden"
              }
            >
              {snapshot.leads?.error ||
                "Vorhandene Lead-Markierungen erscheinen hier ohne geschätzte Buchungsquoten."}
            </EmptyState>
          )}
        </Panel>
      )}
      <Panel
        title="Buchungsprotokoll"
        caption="Die letzten 20 gespeicherten Ereignisse. Kein neuer Kalenderzugriff."
      >
        {!events?.length ? (
          <EmptyState
            icon="booking-events"
            title={
              snapshot.events?.error
                ? "Buchungsprotokoll fehlt"
                : "Keine Ereignisse vorhanden"
            }
          >
            {snapshot.events?.error ||
              "Es werden ausschließlich bereits gespeicherte Backend-Ereignisse angezeigt."}
          </EmptyState>
        ) : (
          <div className="v2-table-scroll">
            <table className="v2-table">
              <thead>
                <tr>
                  <th>Ereignis</th>
                  <th>Kontakt-ID</th>
                  <th>Anbieter</th>
                  <th>Zeitpunkt</th>
                  <th>Verarbeitung</th>
                </tr>
              </thead>
              <tbody>
                {events
                  .slice(-20)
                  .reverse()
                  .map((event, index) => (
                    <tr key={event.id || index}>
                      <td>
                        {String(
                          event.eventType || event.type || "Nicht hinterlegt",
                        )}
                      </td>
                      <td>{String(event.leadId || "Nicht hinterlegt")}</td>
                      <td>{String(event.provider || "Nicht hinterlegt")}</td>
                      <td>{formatDate(event.createdAt || event.receivedAt)}</td>
                      <td>{String(event.status || "Nicht hinterlegt")}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
