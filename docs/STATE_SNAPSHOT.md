# Funnel Pilot – STATE SNAPSHOT

Stand: 2026-10-10 (Pre-Live-Basis inkl. lokalem Sicherheitsrelay)

## Quelle der Wahrheit

- Integrationsbranch: `funnel-pilot-current`
- alter `phase6-prelive-hardening`-Branch ist überholt und darf NICHT blind gemergt werden
- Phase 6–12 technisch integriert, PR #34 (Link-Routing-Guard) gemergt
- Phase 14: gesicherter Laptop-Test und lokales Webhook-Relay über PR #35
- CI-Nachweis PR #35: Backend-Build und Dashboard-Build grün; 82 Backend-Tests + 2 Relay-Tests bestanden, 0 fehlgeschlagen

## Vorhandene Funktionen

- Instagram- und WhatsApp-Webhook-Parser, HMAC, Duplicate-Schutz
- gemeinsame Conversation Engine und Pete-Testmatrix
- Human Takeover (`owner=human`, `aiPaused=true`) und erneute Ownership-Prüfung vor Send
- externe manuelle Dashboard-Nachricht über kanalabhängigen Meta-Transport (sendet nur bei explizit aktivierten Sends)
- externe Echo-Nachrichten von Jochen erkennen und Automation pausieren
- Ghosting-/Booking-Follow-ups nur nach Versandbestätigung als gesendet markieren
- ManyChat-Koexistenz: neue IG-Leads standardmäßig `botEnabled=false`; expliziter Handoff im Dashboard
- Instagram erlaubte Sender mit Allowlist, globaler Send standardmäßig aus
- vier editierbare Dashboard-Runtime-Links; Elterncheck/Checkout-Verwechslung verhindert
- Produktwahrheit: Selbststarter 14,95 €, Coaching 5 Wochen 499 €, Begleitung 6 Monate 2.499 € (499 € anrechenbar)
- WhatsApp-Regression durch den gemeinsamen Backend-Testlauf

## Sicherer Laptop-Test vor Hetzner

Anleitung: [LOCAL_TEST_WINDOWS.md](LOCAL_TEST_WINDOWS.md).

- lokales Backend nur `127.0.0.1:3001` im Entwicklungsmodus
- lokales Dashboard über Vite `127.0.0.1:5173` mit API-Proxy
- neuer dedizierter Relay nur `127.0.0.1:3002`: erlaubt ausschließlich GET/POST der Instagram-/WhatsApp-Webhooks
- Cloudflare Quick Tunnel **nur** zu Port 3002, niemals 3001 oder 5173
- manuelle Tests beginnen mit `INSTAGRAM_ENGINE_ENABLED=false`, `INSTAGRAM_SEND_ENABLED=false`, `WHATSAPP_SEND_ENABLED=false`
- lokale Fenster und Cloudflare-Tunnel müssen aktiv bleiben, damit Meta-Callbacks den Laptop erreichen

## Noch NICHT nachgewiesen / noch NICHT live

1. Realer Instagram-Webhook-Eingang aus einem neuen DM im aktuellen Meta-App-Status (Development Mode kann verhindern).
2. Echte Instagram-/WhatsApp-Sends an genau einen freigegebenen Testaccount / eine Testnummer.
3. Vollständige operative Koexistenz mit aktivem ManyChat am echten Account; der Code erzwingt Handoff, aber ManyChat selbst bleibt unverändert.
4. Stabilität nach echtem Neustart mit realen Credentials; lokale Offline-Tests reichen dafür nicht.
5. Meta Review, App-Veröffentlichung und 24/7-Produktivdeployment auf Hetzner.
6. Produktionsschutz aller Admin-APIs auf Hetzner (Authentisierung, TLS, Firewall, Backups, Monitoring).

## Nächster exakter Schritt

- Prüfen: `git switch funnel-pilot-current`, `git pull --ff-only`, lokale Tests gemäß Runbook ausführen.
- Dashboard/Testchat zuerst intern durchspielen.
- Nur zum Meta-Webhook-Empfang Cloudflare Quick Tunnel an lokalen Relay-Port 3002.
- Meta-App-Review weiterhin zurückgestellt, bis interne Abnahme erfolgreich.
- Danach isolierter Testlead mit Allowlist und bewusstem explizitem Live-Send.
- Hetzner erst nach bestandener lokaler Abnahme. Keine neue Grundsatzplanung erforderlich.

## Phase 16 – Kunden-Setup-Modal und OAuth-Basis (PR #37)

- Ersteinrichtung ist jetzt ein **zentriertes modales Fenster über dem Dashboard** statt einer eigenen Inhaltsseite.
- Öffnet beim ersten Start (neuer Browser-Marker v2), danach jederzeit per Sidebar „Einrichtung“.
- Ablauf: Willkommen / optionales eigenes Setup-Video → Marke & Pete → Angebote/Links → Anbieter-Verbindungen → Gesamttest → Fertig.
- Zusätzlicher gespeicherter Firmenkontext: Name, Website, Nische, Zielgruppe, Angebote; Setup-Video-URL optional.
- Google Calendar, Calendly, HubSpot: serverseitiger OAuth Authorization Code + PKCE + State und verschlüsselte Token-Ablage in `DATA_DIR`, erst nach OAuth-App-Registrierung aktivierbar.
- **Wichtig:** `authorized_not_synced` ist nur erfolgreiche Autorisierung, **nicht** nachgewiesene Kalender-/CRM-Synchronisierung.
- Instagram/Facebook/WhatsApp: echte vereinfachte Meta-Anbindung/Embedded Signup weiterhin offen; keine irreführenden „verbunden“-Buttons.
- Noch kein Multi-Tenant-SaaS, keine serverseitige Benutzer-Authentifizierung oder anbieterspezifischer Refresh-/Sync-Dienst. Vor Verkauf an mehrere Unternehmen ergänzen.
- Im lokalen Pre-Live-Test bleiben beide Sende-Flags deaktiviert; Cloudflare Quick Tunnel weiterhin nur Webhooks auf Port 3002.
- PR #37 CI: 88 Backend-Tests + 2 Relay-Tests + 5 Dashboard-Tests = **95** bestanden, Builds grün, 0 Fehler. Aktueller CI-Stand nach letztem UX-Commit separat prüfen.
- Der finale Laptop-Browser- und OAuth-Echtanbieter-Abnahmetest ist **noch offen**; kein Meta Review, kein Hetzner.

## Phase 17 – Buchungsprüfung (10.10.2026)

- Kalenderbuchung im ursprünglichen Testchat funktionierte als **Calendly-Buchungslink + signiertes Buchungsereignis + Google-Kalender-Vorlagenlink**. Das Google-Element ist ein vom Kunden klickbarer Kalenderlink, keine direkte `events.insert`-Google-API.
- Testchat-Conversation-State kann nun selbst ohne separaten Dashboard-Lead ein **signiertes** Calendly-Event empfangen: `booked` mit Start/Ende; Buchungs- und Ghosting-Followups stoppen; im Testchat erscheint eine nur vorbereitete Bestätigung mit Google-Kalender-Vorlagenlink. `invitee.canceled` aktualisiert `cancelled`. Kein externes Senden.
- Textnachricht `Hab gebucht` allein bestätigt nicht mehr fälschlich einen Termin. Eine tatsächliche Provider-Bestätigung ist erforderlich.
- Der offizielle Calendly-Signaturheader `t=…,v1=…` wird gegen `timestamp.originalRawBody` mit 180 Sekunden Toleranz geprüft. Production erzwingt `strict`.
- Lokaler Cloudflare-Relay erlaubt Calendly `POST /booking-events/calendly` ausschließlich per **explizitem Opt-in** und bei aktiviertem Signaturmodus `strict`. Kein Zugriff auf Admin-Routen. Runbook: `docs/LOCAL_TEST_WINDOWS.md`.
- CI-Prüfung PR #39: 89 Backend-Tests + 3 Relay-Tests + 5 Dashboard-Tests = **97 bestanden, 0 Fehler**, Backend-/Dashboard-Build grün.
- Weiterhin offen: echter Calendly-Anbieter-Webhook von einem Testkonto an die aktuell konfigurierte Callback-URL; Nachweis einer wirklichen E-Mail-/Google-Kalender-Eintragung beim Testkunden; OAuth-Abschluss und synchronisierte Kalender-/CRM-Daten. Ohne diesen externen Nachweis keine Live-Freigabe und kein Hetzner.


## Phase 18 – Read-only Provider-Verbindungsprüfung (10.10.2026)

- In der modalen Kunden-Ersteinrichtung: nach Google Calendar, Calendly oder HubSpot OAuth-Login zeigt der Button **API-Zugriff prüfen** einen echten, ausschließlich lesenden Verbindungstest.
- Feste Provider-URLs: Google Calendar List, Calendly /users/me, HubSpot Contacts limit 1.
- Ein bestätigter API-Zugriff wird nur als `api_verified_no_sync` gemeldet; **kein** Kundendaten-/Kalenderabgleich, keine API-Schreibaktion und kein Nachrichtenversand.
- Die UI zeigt unterschiedliche Fehler für fehlende Autorisierung, abgelaufene/ungültige Tokens und nicht erreichbaren Anbieter. Der Prüf-Endpunkt benötigt den Dashboard-Origin; der Token bleibt verschlüsselt im Backend.
- Automatischer Token-Refresh und vollständiger Kalender/CRM-Sync bleiben ausdrücklich offen. Zur Durchführung mit echten Konten müssen Entwickler-Apps/OAuth-Redirects eingerichtet sein.
- PR #40, CI: Backend + Dashboard erfolgreich (synthetische OAuth-Tokens und gemockter Google-API-Response, keine echten Anbieterzugriffe).


## Phase 20 – Sicherer Windows-Schnellstart (10.10.2026)

- Neuer `scripts/start-local.ps1`: Ein-Befehl-Start für den geplanten Laptop-Abnahmetest. Vor dem Start: Branch-/Node-Check, fehlende `backend/.env` nur aus Vorlage anlegen (keine vorhandenen Secrets überschreiben), fehlende Dependencies installieren, sämtliche Backend-/Dashboard-Tests und Builds ausführen.
- Startet drei lokale PowerShell-Fenster: Backend 127.0.0.1:3001, Dashboard 127.0.0.1:5173, Relay 127.0.0.1:3002. Öffnet Browser erst nach Gesundheitsprüfung.
- Erzwungen: Instagram Engine/Sends AUS, WhatsApp Sends AUS, keine Autoaktivierung neuer Leads, globale Senderfreigabe AUS, generische Webhooks AUS und destruktive Routes gesperrt.
- Belegte Ports führen zum Abbruch, damit nicht versehentlich eine fremde/alte Instanz wiederverwendet wird. Cloudflare/Hetzner oder echte Nachrichten werden nicht automatisch gestartet.
- `-CheckOnly` prüft die lokale Installation vollständig, ohne Server zu starten.
- Statische Sicherheits- und Reihenfolge-Tests als Teil von `backend npm test`; echter PowerShell-Lauf **nur auf Windows** noch nicht abgenommen.
