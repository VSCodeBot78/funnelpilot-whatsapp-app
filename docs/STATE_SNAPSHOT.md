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
- Angebotsfreigabe (aktueller Stand): Selbststarter 14,95 €, Coaching 5 Wochen 499 €. 6-Monats-/Langzeitkonditionen weiterhin ungeklärt; historischer Betrag 2.499 € und Anrechnung **nicht** für Lead-Antworten freigegeben (Phase 28 behebt aktive Code-Rückfälle).
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


## Phase 21 – Sichere Onboarding-Speicherung (10.10.2026)

- Wiederholte oder teilweise Onboarding-Änderungen bewahren andere gespeicherte Einstellungen (Marke, Pete, Buchungslinks).
- Unbekannte Felder, Readiness-Pseudofelder und ungültige Datentypen werden nicht persistiert.
- HTTP-Regression für Speichern, Teiländerung, erneutes Laden. PR #43 bereits integriert.

## Phase 22 – Ehrliche Setup-Diagnose im Onboarding (10.10.2026)

- Im letzten Schritt des Onboarding-Pop-ups erscheint eine Checkliste: lokales Backend, sichere Kanal-Flags, Marke, Pete, Buchungslink, Kalender-API, HubSpot und Meta-Livebetrieb.
- Lokale Testbereitschaft ist nicht gleich produktive Freigabe; echte Sends werden nicht aktiviert.
- Lesender Google-/Calendly-/HubSpot-API-Zugriff bedeutet ausdrücklich keine automatische Synchronisierung.
- Instagram und WhatsApp bleiben offen, bis echte Anbieter-End-to-End-Tests vorliegen.
- Drei neue Dashboard-Tests gegen Fehlklassifikation bei OAuth, Meta- und Sendestatus.
- Echter Windows- und Browser-Test bleibt offen.


## Phase 23 – Master-Prompt, echte DM-Review und expliziter KI-Schalter (10.10.2026)

- Im bestehenden lokalen Eltern-fit-&-vital-Workspace ist ein ausführlicher **editierbarer Master-Prompt** als DEFAULT_SETTINGS hinterlegt, mit Zielgruppe 35–55, alltagsnaher Sprache, Coachinghaltung, Keto ohne Dogma, Ernährungsplan-/Sicherheitsgrenzen und transparentem Pete-KI-Namen.
- Das Onboarding-Pop-up und Pete-Einstellungen bieten einen mehrzeiligen Master-Prompt-Editor; Änderungen werden im Backend gespeichert.
- Die OpenAI-basierte KI-Brücke für strukturierte Einwände bzw. freie Zwischenantworten erhält nun Firmenkontext, Zielgruppe, Markenstimme, Angebote und den gespeicherten Master-Prompt. Preise/Links, Sicherheitsregeln und Buchungswahrheit dürfen dadurch nicht überschrieben werden.
- **Wichtige Grenze:** Viele normale Funnel- und Sicherheitsantworten bleiben noch feste Entscheidungs-/Antwortbausteine. Diese werden nicht rückwirkend in freie LLM-Antworten verwandelt. Der spätere SaaS braucht eigene pro-Tenant-Prompts, separates Daten-/Account-Modell und nicht Eltern-fixierte Flows.
- Verbindlicher Opt-in: OpenAI wird erst angerufen, wenn serverseitiger API-Key vorhanden UND im Pete-Einstellungsbereich `aiEnabled=true` gesetzt ist. Standard AUS. Dies gilt sowohl für KI-Zwischenantworten als auch die freie Wahlinterpretation.
- Automatischer API-Mock-Test bestätigt, dass der Kundentext wirklich in der OpenAI-Anfrage ankommt; Abschalttest bestätigt, dass kein kostenpflichtiger Aufruf ohne Opt-in ausgelöst wird. Kein realer OpenAI-Account-Test.
- Reale Ausgabe von zehn Einzel-DM-Szenarien plus 8-stufigem Eltern-Gespräch in CI protokolliert. Qualitätsbericht mit echten Beispieltexten, offenen Tonalitäts-/Fachfragen und Bewertungsbogen: `docs/PETE_DM_QA_2026-10-10.md`.
- Entdeckter Fehler `Ich bin Papa von zwei Kindern ...` als angeblich mehrere Chatteilnehmer beseitigt. Nun fragt Pete nach Vornamen und merkt sich vorhandenen Elternkontext. Regressionstest bestätigt.
- Vor echtem Liveversand: 6-Monats-Angebot/Preis aus Repository (2.499 €) gegen den aktuell freigegebenen Geschäftsstand prüfen; Sprache der starren Mehrfachauswahl mit Betreiber abstimmen.
- Letzter GitHub-CI-Lauf: Backend- und Dashboard-Build grün; 94 Backend-Tests + 5 Relay/Launcher-Tests + 8 Dashboard-Tests = 107 Prüfungen grün.


## Phase 24 – Natürliche Pete-DMs und individuelle Top-3-Einwände (10.10.2026)

- Testchat und Instagram bekommen einen konfigurierbaren natürlichen Gesprächsmodus: Aussage aufgreifen, eine passende Frage, 3–4 Schritte; klassischer A-B-C-D-Flow bleibt als wählbarer Altmodus. Der WhatsApp-Pfad bleibt zunächst unverändert.
- Grundregeln und founder-spezifischer Master-Prompt: Ethik und fundierte Verkaufspsychologie, Keto als optionale individuell angepasste 5-Wochen-Begleitung (499 €), 6-Monats-Preis vor Freigabe nicht ausspielen, Zeit/Preis/Vorerfahrung fokussieren.
- Human Takeover im Chat ist von ausdrücklicher Strategiegesprächsbuchung getrennt; medizinische, Stop- und Datenschutzfälle werden vor Verkauf behandelt. Kein echter Versand aktiviert.
- Neues optionales Feld `customerTopObjections` für maximal drei häufige Kundeneinwände, ein Einwand pro Zeile, für den aktuellen Gründer-Testworkspace mit Zeit/Budget/Vorerfahrung belegt; später jederzeit im Pete-Panel änderbar oder leerbar.
- Die drei individuellen Einwände werden im derzeitigen KI-Brückenprompt als Kontext behandelt, **nicht als Aussagen über einzelne Leads**. Vollständig individuelle regelbasierte Antwortpfade sind noch nicht generisch/multi-tenant; entsprechende SaaS-Entwicklung offen.
- Neue Tests decken u.a. spontane Preisfragen, Budgetklärung, kurze Elternchats, Keto-Begleitung, verzweigten Chat-Handover und kritische medizinische Stichworte ab. Zusätzlich werden 15 vollständige deterministische Beispieldialoge protokolliert; kein echter OpenAI-Live-Test.

## Phase 26 – 15 Mama-/Papa-Härtetests und Sprachabnahme (10.10.2026)

- Neue vollständige Persona-Testmatrix `backend/src/config/pete-adversarial-personas.test.ts`: 15 bewusst realistisch formulierte, mehrstufige Eltern-DM-Szenarien (Schichtdienst, Elternmüdigkeit, Keto-Familienessen, Kosten, fehlende Zeit, Misstrauen, Einwände, Nein/STOP, sichere Handover, Kauf ohne Termin und unbestätigte Buchung). Alles simuliert, keine echten Lead-Nachrichten.
- Der erste Lauf fand drei neue Regressionen: explizit kein Sales wurde ignoriert, wiederholte Frage nicht anerkannt, Fitness-Anfängerin als bereits gescheitert eingeordnet. Weitere Sichtung zeigte falschen Kalenderlink trotz Direktkauf, 499-€-Antwort auf Kita-Kosten, Rückfall in Qualifizierung nach bloßer PDF-Anforderung, schlecht verstandene Termin-Zusammensetzungen, unerkannte Formulierung 'abgezockt'.
- Korrekturen: ausdrückliche Vertriebsablehnung respektieren, Wiederholungsbeschwerde eingestehen, Anfänger von wiederholten Versuchen unterscheiden, Budgetklärung vor generischer Preislogik, direkte Checkout- statt Call-Weiterleitung, Provider-Bestätigung nicht erfinden, Zero-Capacity nicht weiter pitchen, Keto-Familienessen spiegeln und Misstrauen differenzieren.
- Alle 15 vollständigen aktuellen echten **deterministischen Engine-Transkripte** mit einem gekennzeichneten Vorschlag in Jochens gewünschter Sprache sowie simulierter Perspektive des Leads: `docs/PETE_ADVERSARIAL_PARENT_QA_2026-10-10.md`. Ein Style-Vorschlag ist nicht automatisch ein wörtliches Original von Jochen.
- Letzter grüner CI-Lauf der Testmatrix: 121 Backend-Tests + 5 Relay-/Launcher-Tests + 8 Dashboard-Tests = **134 grün, 0 Fehler**. Finale CI nach Report-Commit gesondert bestätigen.
- **Wichtig:** Die technische Abnahme betrifft nur isolierte Code-/Engine-Simulationen. Echtes OpenAI/Meta/Calendly/Checkout, reale Leads, menschliche Inbox und finale Stimme bleiben aus. Instagram-/WhatsApp-Sends bleiben deaktiviert. Unbewertete Formulierungen dürfen nicht als freigegeben live gelten.

## Phase 27 – Konkreter Elternkontext, KI-Transparenz und Booking-Nachfrage (10.10.2026)

- PR #49 `phase27-pete-context-and-booking-qa`: gezielte Nacharbeit anhand der offenen Phase-26-Sprachbefunde; kein neues Funnel-Konzept und keine Änderung an zentralen STOP-, Handover- oder Meta-Sendegates.
- Im **deterministischen Natural-Modus** spiegelt Pete bei ausdrücklich genannten zwei/drei Kindern plus Schichtarbeit beides direkt in einer kurzen Antwort. Andere Elternantworten bleiben erhalten.
- Auf `Ist das hier wieder so ein Verkaufsbot?` antwortet Pete offen als `Jochens KI-Assistent`, ohne eine ungenannte frühere schlechte Kauf-/Coaching-Erfahrung zu unterstellen.
- Bei mehrfacher Frage zur angeblich erfolgten Calendly-Buchung formuliert Pete ohne bestätigenden Provider-Webhook nicht zweimal den identischen Satz, sondern benennt weiterhin den ausstehenden Nachweis und die Möglichkeit einer persönlichen Klärung.
- Neue Regressionen in `backend/src/config/natural-pete-dm.test.ts` für Schichtdienst, fehlende erfundene Vorgeschichte und wiederholte, nicht bestätigte Terminfrage. CI-Nachweis auf Commit `074d61e3`: **124 Backend-Tests + 5 Relay-/Launcher-Tests + 8 Dashboard-Tests = 137 bestanden, 0 fehlgeschlagen**, Backend-/Dashboard-Build grün (GitHub Actions 38053473713 und 38053471402).
- Weiter offen: Jochens finale Sprachabnahme, unabhängige OpenAI-Modellgespräche, echte Meta-/Calendly-End-to-End-Tests und Windows-Laptop-Abnahme. Kein produktiver Auto-Send.

## Phase 28 – Unfreigegebene Preisangaben gesperrt (10.10.2026)

- Aktive `OFFER_TRUTH.longTerm`-Konfiguration enthält **keine** numerischen 6-Monats-Preise, Anrechnungen oder Upgrades mehr. Der Datensatz ist ausdrücklich `pending_founder_approval`; historische Zahlwerte bleiben nur in alten Berichten/Tests als Warnbeispiele.
- Die alte Funktion `getLongTermReply` gibt statt des früheren Angebots-/Rabatttextes eine einheitliche Antwort zurück, dass Jochen Preis und Umfang persönlich klärt. Legacy-Keywörter erkennen jetzt auch die direkte `6-Monats`-, `Premium`- und `Advanced`-Nachfrage.
- Sowohl im natürlichen Pete-Modus als auch in den älteren Runtime-Safety-/Response-Composer-Preiswegen wird ein konkret verlangter Langzeitpreis nicht aus anderen Produktpreisen abgeleitet. Der direkte generische Preisweg nennt nur noch bestätigte Kurzangebote.
- Frei bearbeitete Kampagnen-Antworttexte mit veralteten oder anderen unbestätigten Euro-Beträgen werden im Preisantwortweg verworfen. Strukturierte OpenAI-Zwischenantworten dürfen keine selbst erzeugten Euro-Beträge liefern; sonst verwendet der bestehende Ablauf die sichere Alternative. Eine direkte Langzeitpreisfrage wird nicht an den kostenauslösenden Modellpfad gegeben.
- Neue Tests erfassen Angebots-Felder, alte Beträge und erfundene Euro-Angaben, Natural/Legacy-Routing, direkte und nicht-direkte Composer-Preiswege sowie ein vollständiges Legacy-Engine-Gespräch.
- **CI-Stand nach Code- und Teständerung:** GitHub Actions #38055847690, **131 Backend + 5 Relay/Launcher + 8 Dashboard = 144 Tests bestanden, 0 Fehler**, beide Builds erfolgreich. Dies beweist Code-/Testverhalten, **nicht** live gesendete Meta-/WhatsApp- oder echte OpenAI-Modellantworten.
- **Geschäftliche Entscheidung bleibt offen:** Konditionen einer längeren Begleitung müssen von Jochen ausdrücklich freigegeben werden, bevor irgendein Kundentext einen konkreten Betrag, eine Rate oder Anrechnung nennen darf. Preise/Links der beiden Kurzangebote ebenfalls vor echtem Live-Test gegen Checkout prüfen.
