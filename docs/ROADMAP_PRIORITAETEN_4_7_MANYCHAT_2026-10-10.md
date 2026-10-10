# Funnel Pilot – Arbeitsprioritäten 4–7 und spätere ManyChat-Ablösung

**Strategieentscheidung am 10.10.2026 – vorgemerkt, keine Freigabe für Live-Betrieb.**

## Kanal- und Kostenstrategie

1. Der **externe DM-Closer** ist nur noch ungefähr eine Woche als Benchmark im Test. **Keine Verlängerung geplant**. Die Kündigung/Abschaltung ist eine **noch auszuführende Nutzeraktion**, kein hier ausgeführter Kündigungsnachweis.
2. **ManyChat bleibt vorerst aktiv**, insbesondere für vorhandene kurze Instagram-Strecken wie Keyword KETO/Guide, Check, Story-Reaktion, Linkversand und einfache Antwortauswahl. Diese laufenden Flows werden **nicht ungeprüft abgeschaltet**.
3. **Funnel Pilot soll ManyChat perspektivisch ersetzen** und dabei **wesentlich einfacher** sein: keine aufgeblähten Flowbuilder und keine mehrfachen Werkzeuge. Ein Klick auf eine kurze Antwort-/Link-Schaltfläche soll unmittelbar zum passenden nächsten Schritt führen, während Pete den freien Dialog übernehmen kann.
4. Geschäftsziel: **ManyChat-Abokosten künftig einsparen** und Budget eher für einen eigenen **Hetzner-Server** einsetzen. Drittanbieter-/Meta-Messaging, KI-API, Betrieb, Hosting, Datenschutz und Support sind dadurch nicht automatisch kostenlos. Kosten-/Nutzenrechnung erst vor späterem Wechsel.
5. Bei parallelem Betrieb darf **immer nur ein Bot denselben Lead-/Kanal-Abschnitt bedienen**. Viele bestehende Facebook-/Instagram-/WhatsApp-Buttons unterscheiden sich technisch: Die tatsächlich unterstützten Quick-Reply-, Postback- und URL-CTA-Typen sind vor Implementation **je Kanal an den dann gültigen offiziellen Meta-APIs zu prüfen**. Keine Zusage, dass jede ManyChat-Buttonart identisch unterstützt wird.

## Aktuelle Reihenfolge: Vier **ohne Laptop** sinnvolle Prioritäten

| Reihenfolge | Thema | Umfang / messbares Ergebnis | Einschränkung |
| --- | --- | --- | --- |
| **4 – Dashboard vereinfachen** | Aufgeräumte tägliche Oberfläche für Inbox, Leads, Pete, Handover, Kanäle; Quick-Start/Status sichtbar, seltene Funktionen separat. Einfachheit bewusst gegen überladenen externen DM-Closer abgrenzen. | Minimaler UI-Ablauf, klare Beschriftungen, mobile Lesbarkeit, Frontend-Tests; keine neue komplexe Flowbuilder-Oberfläche. | Keine echten Benutzertests auf Windows möglich. |
| **5 – Startdiagnose verbessern** | Bestehenden Phase-32-Preflight und Setup-Diagnosen verständlicher machen, Fehler „was tun?“ und sichere Zustände sichtbar halten; keine technischen Rätsel. | Fail-Closed, klare Diagnose für Dashboard/Backend/Relay/Meta-Flags und lokales Schnelltest-Feedback. | Kein ungetesteter Auto-Fix und keine Live-Freischaltung. |
| **6 – Datenschutz und Betrieb vorbereiten** | Bestandsaufnahme Auth, Zugriff, gespeicherte Daten, Geheimnisse, Lösch-/Export-/Backup-Konzept, Protokollierung, Produktions-/Hetzner-Risiken. | Durchgängige Betriebs- und Sicherheitsspezifikation mit konkreten offenen Blockern/Abnahmetests. | Konzept oder sichere Regressionen ≠ gehärtetes SaaS/Produktivhosting. |
| **7 – Coach-Onboarding vorbereiten** | Spätere Coaches sollen Zielgruppe, Marke, Stimme, Angebote, erlaubte Preise, Kontaktwege, FAQs und Eskalationsregeln einfach eintragen können. | Schlankes v1-Onboarding mit plausiblen Pflichtfeldern, Vorschau/Testchat und Konfigurations-Persistenztests. | Aktuell Single-Workspace; echte Multi-Tenant-Freigabe erst nach Isolation/Authentifizierung. |

**Arbeitsmodus:** Prioritäten 4 → 5 → 6 → 7 unabhängig voneinander bearbeiten, jeweils GitHub-PR/CI prüfen und in **funnel-pilot-current** integrieren; nur synthetische Tests; null externe Sends. Diese Roadmap-Notiz startet keine Implementierung dieser vier Punkte.

## Produkt-Backlog M-01: Native kurze Button-/Link-Automationen (später, bewusst NICHT Priorität 4–7)

**Minimum statt ManyChat-Klon:**

- Eingangsregeln mit wenigen Triggern: Keyword (z. B. KETO, CHECK, GUIDE), Story-/Kommentar-Einstieg soweit offizielle APIs dies zulassen, optional Willkommen/Erstkontakt.
- Einfache **„Auswahl → Aktion“**-Bausteine: kurze Antwortauswahl, Link zu Guide/Check/Video/Checkout, gezielte Nachricht oder **Pete übernehmen**. Die UI zeigt nur **Trigger → 1–3 Optionen → Zielaktion**, kein komplexes Drag-and-drop als Voraussetzung.
- Aktionen werden an die bestehenden geprüften Angebots-/URL-Daten, Kampagnenkonfiguration und Sprachen gebunden. Keine erfundenen Konditionen, keine freien Zahlungszusagen.
- Ein Kontakt erhält eine eindeutige Zuständigkeit für jeden Schritt: **ManyChat ODER Funnel Pilot**, niemals bewusst beide. Idempotenz und Trigger-Deduplizierung, STOP/Opt-out, Human-Handover, Rate Limits, Messaging-Fenster, Sicherheitsprotokoll.
- Klein starten: zunächst **KETO → Guide**, **CHECK → Elternfitness-Check**, **VIDEO → Mini-Webinar**; Einzelflow testen, dann auf weitere Trigger und echte Kanalinteraktionen erweitern.
- Aufbaureihenfolge für spätere Umsetzung: (a) offizielle Plattformfähigkeiten & Berechtigungen je Kanal prüfen; (b) interne Flow-Datenstruktur und synthetische Ablauf-/Deduplizierungstests; (c) kompakte UI-Editorform und Vorschau; (d) jeweils EINEN echten Testlead auf offizieller Schnittstelle ohne parallel antwortenden ManyChat-Flow; (e) Trigger einzeln migrieren und abnehmen; (f) ManyChat erst kündigen, **wenn alle tatsächlich genutzten Strecken gleichwertig getestet funktionieren**.

**Keine unbelegten Plattformversprechen:** Chat-„Buttons“, IG-Quick-Replies, WhatsApp-Interaktivnachrichten und klickbare externe URLs haben je nach Kanal unterschiedliche Vorgaben. Ebenso können Metas Berechtigungen, Versandfenster, genehmigte Nachrichtentemplates und APIs Kosten/Restriktionen verursachen. Erst verifizieren, dann anbieten.

**Konkrete Abnahmekriterien für ManyChat-Abschaltung später:** Alle relevanten aktuellen Keyword-, Story-, Link- und CTA-Strecken durch echte Kanalevents nachgewiesen; keine Doppelantworten; zugestellte Buttons/Links von Testleads bestätigt; sauberes Opt-out und Human-Handover; aussagefähige Betriebsdiagnose; bewusst freigegebener Abschalt-/Rollbackplan. 

## Produkt-Backlog M-02: Mobile Web-App für Jochen und spätere Coaches (später)

**Neue Produktentscheidung vom 10.10.2026:** Funnel Pilot soll **unterwegs auf Mobiltelefonen und Tablets als webbasierte App** nutzbar sein. Keine separate native Android- oder iOS-App als MVP voraussetzen. Die gleiche mobile Oberfläche soll später für **alle angeschlossenen Coaches** nutzbar sein, nicht nur für Eltern fit & vital.

**Aktueller Stand:** Seit Priorität 4 existiert bereits eine **responsive Dashboard- und Inbox-Anordnung** (kleinere Displays, Chat/Kontakte/Kontext untereinander). Das ist **noch keine installierbare Progressive Web App (PWA)**, kein Beweis für stabile Mobil-Bedienung auf echten Geräten und keine produktive mobile Freigabe.

**Zielbild einer späteren installierbaren PWA:**

- Über HTTPS im Handy-Browser öffnen und – soweit vom jeweiligen Gerät/Browser unterstützt – **zum Startbildschirm hinzufügen**; App-ähnlicher Start ohne verpflichtenden App-Store-Download.
- Schneller **Mobiler Arbeitsplatz**: priorisierte Leads, Inbox, Gesprächsverlauf, Jochen-/Coach-Übernahme, „Pete pausieren/an KI zurückgeben“, Termine, wesentliche Lead-Notizen und sichere Statusanzeige. Normale Administrationsfunktionen bleiben optional erreichbar statt den kleinen Bildschirm zu überfrachten.
- **Coach-fähig statt hardcoded:** Konten, Branding, Angebote und Zugriffsrechte stammen später aus der jeweils autorisierten Coach-/Workspace-Konfiguration; keine Daten eines anderen Coaches sichtbar. Zunächst weiterhin Single-Workspace, bis Login, Rollen und Mandanten-Trennung nachgewiesen sind.
- **Sicherheitsvoraussetzung vor Live-SaaS:** HTTPS, belastbare Anmeldung mit Sitzungsschutz, Abmelden/Entzug, Zugriffskontrolle **serverseitig pro Workspace**, sichere Speicherung/Übertragung, Datenschutz- und Protokollkonzept, Tests für unzulässigen Zugriff. **Keine** Admin-API ohne Authentifizierung ins Internet stellen.
- **Offline-Verhalten:** Bei fehlender Verbindung Zustand klar anzeigen; **keinen** erfolgreichen Versand, Handover oder Termin vortäuschen. Offline-Antworten und Service-Worker-Caching sensibler Chatdaten werden **nicht** als MVP zugesagt.
- **Optionale spätere Extras:** Opt-in-Push für relevante Lead-/Handover-Ereignisse, gerätegerechte Bedienung, Benachrichtigungsregeln und Barrierefreiheit. Push-Berechtigungen, sensible Inhalte auf Sperrbildschirm und Plattformunterstützung je Browser müssen vor Freigabe gesondert geprüft werden.
- **Abnahme erst später auf echten Geräten:** Android/iOS soweit vorhanden und Tablet; Installation/Startbildschirm, Login, Suche/Inbox, langer Chat, Statuswechsel, Human-Takeover, Abmelden, schlechtes Netz sowie strenge Trennung zweier Coach-Accounts.

**Reihenfolge:** Als fester SaaS-Produktbaustein **nach** den Grundlagen aus Priorität 6 (Betrieb/Auth/Datenschutz) und 7 (Coach-Onboarding) bearbeiten. Vorher bleibt die bestehende responsive Browser-Ansicht die praktische Vorarbeit. **Keine Verschiebung der laufenden Priorität 5** und keine zusätzliche Servermiete allein für diesen Backlogpunkt.

## Einschätzung zum Projektfortschritt (keine objektiven Fertigstellungs-Messwerte)

Die Prozentangaben sind grobe **Arbeits-/Reifegrade**, nicht der Anteil von „Produktiv-Reife ohne Restrisiko“. Die Bereiche sind unterschiedlich groß, daher **kein arithmetischer Durchschnitt** als Gesamtstand.

- **Lokale Codebasis und Testvorbereitung:** ca. **95 %** (230 CI-Tests bestanden, 0 echter Windows-Laptop-Abnahmelauf).
- **Eigene produktive IG-/WhatsApp-Nutzung:** ca. **60 %** (Transport-/Engine-/Sicherheitswege simuliert, echte Meta-/ManyChat-Koexistenz und Zustellung nicht freigegeben).
- **Coaches als eigenständige SaaS-Kunden:** ca. **40 %** (Onboarding-Basis vorhanden, Tenant-Isolation, Login, Betrieb, Freigaben und echte Integrationen fehlen).
- **Gesamtziel einschließlich späterer SaaS-Bereitstellung:** ca. **40 %** (Gewichtung durch fehlende Live- und Betriebsnachweise, kein rechnerischer Mittelwert).
- **Native ManyChat-Ablösung:** nur **vorgemerkt; fachliche Konzeption begonnen**, noch **keine** validierte native Button-/Link-Engine. Eine exakte Fertigstellungszahl wäre irreführend.

**Wichtig:** Phase 30 (Pete synthetisch), Phase 31 (Funnelketten synthetisch) und Phase 32 (lokaler Teststart vorbereitet) sind abgeschlossen; echte Windows-, Meta-, Calendly-/Payment- und Multi-Tenant-Abnahmen **sind weiterhin offen**.

## Umsetzung nach Roadmap-Freigabe – 10.10.2026

- **Priorität 4 (Dashboard vereinfachen): im GitHub-Code umgesetzt.** Fokussierte tägliche Navigation und Startseite, zugänglicher Pete-Testchat, mobile Inbox und kein irreführender Dummy-Lead-Fallback. Technischer Bericht: `docs/PHASE34_DASHBOARD_FOKUS_2026-10-10.md`. Echte Geräteabnahme steht aus.
- **Als Nächstes offen:** Priorität 5 Startdiagnose, Priorität 6 Datenschutz/Betrieb, Priorität 7 Coach-Onboarding.
- ManyChat-Ersatz M-01 bleibt später; in dieser Phase weder Buttons noch API-Trigger neu aktiviert.

## Umsetzung Priorität 5 – 10.10.2026

- **Startdiagnose im GitHub-Code umgesetzt:** Read-only Systemcheck auf der Übersicht, manuell wiederholbar, Sicherheits-STOP mit konkreten Handlungsschritten, kein falsches GRÜN bei fehlenden Flags; Backend-Offlinemeldung mit Retry.
- **Wizard und Alt-Einrichtung** verwenden strengere Prüfungen; OAuth-Statusausfälle werden von Backend-Status getrennt behandelt. Relay und echte Meta-/Calendly-/Payment-Zustellung bleiben **immer separat offen**.
- Technischer Ablauf und lokale Abnahme: `docs/PHASE35_STARTDIAGNOSE_2026-10-10.md`.
- **Als Nächstes:** Priorität 6 Datenschutz/Betrieb, dann Priorität 7 Coach-Onboarding. M-01 ManyChat-Miniflows und M-02 mobile Coach-PWA bleiben spätere Produktbausteine; keine Zusatzkosten und kein Live-Schalten durch Priorität 5.

## Umsetzung Priorität 6 – 10.10.2026

- **Produktions-Sicherheitsbasis im Code umgesetzt:** Der Backend-Server hört ausschließlich auf Loopback; eine eigene, vor allen Routern aktive Sperre schützt im Produktionsmodus Admin-, Lead-, Inbox- und Settings-Zugriffe. Ein serverseitiges Gateway-Secret ohne authentisierten Proxy ist **keine** Login-Lösung.
- **Dateisicherheit verbessert:** Die fünf wichtigsten lokalen JSON-Datenquellen (Gespräche, Leads, Einstellungen, Nachrichten- und Buchungsereignisse) werden atomar mit restriktiven neuen Dateirechten geschrieben; beschädigte Dateien führen in Produktion zum Abbruch statt stiller Neuerzeugung. Keine automatisch eingefügten Demo-Leads bei leerem Produktionsbestand.
- **Geplantes Hetzner-Betriebshandbuch** einschließlich Zugriffsschutz, TLS, Server-/Gateway-Geheimnissen, Backups, Restore, Löschfristen, Transparenz, Rollen und Multi-Tenant-Go-/No-Go: `docs/PHASE36_HETZNER_DATENSCHUTZ_BETRIEB_2026-10-10.md`.
- **Als Nächstes:** Priorität 7 Coach-Onboarding vorbereiten. Echte Benutzeranmeldung, verschlüsselte Backups, Tenant-Isolation, DSGVO-Vertragsprüfung, Sicherheitsabnahme und Hetzner-Deployment bleiben **separat offen**.
- Die späteren Produktmodule M-01 (ManyChat-Miniflows) und M-02 (mobile Coach-PWA) bleiben nachgelagert. Keine bezahlten Dienste eingerichtet und kein echter Sendebetrieb aktiviert.

## Umsetzung Priorität 7 – 10.10.2026

- **Coach-Onboarding-Vorlage im Code umgesetzt:** Eigene Verwaltungsansicht mit vier geführten Schritten (Marke/Zielgruppe; Assistent/Stimme, Handover und Grenzen; maximal drei Angebote/Preis-Schreibweisen/HTTPS-Links; statische Vorschau), manuelles Speichern und Laden.
- **Nur sichere Single-Workspace-Vorarbeit:** Profile bleiben im separaten `coach-onboarding-draft.json` als `draft` ohne Runtime- oder KI-Aktivierung. Die aktuellen Eltern-fit-&-vital-Preise, Live-Links, Pete-Regeln und Meta-Schalter werden beim Speichern **nicht verändert**. Serverseitige Feld-/Typ-/URL-Validierung und Fail-Closed gegen bestehende beschädigte Datei.
- **Nachweis:** `docs/PHASE37_COACH_ONBOARDING_VORLAGE_2026-10-10.md`. Echte Benutzerkonten, unterschiedliche Coach-Workspaces, rollenbasierte Authentisierung, serverseitige Mandantentrennung, rechtskonformer Betrieb und mobile/PWA-Abnahme **weiterhin nicht fertig**.
- **Reihenfolge nach Abschluss der sieben Vorbereitungsprioritäten:** Sicherer Windows-Laptop-Test aus Phase 32; getrennt davon echte Meta-Provider-Kanaltests erst nach expliziter Freigabe; als eigene Produktarbeit Auth/Workspaces/Backups/Hetzner/Coach-Beta sowie später M-01 ManyChat-Ersatz und M-02 mobile Coach-PWA. Kein unbelegtes „SaaS fertig“.
