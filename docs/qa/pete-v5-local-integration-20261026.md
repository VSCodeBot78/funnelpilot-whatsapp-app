# Pete V5: geprüfter lokaler Kandidat, Remote-Gate offen

Stand: 26.10.2026, Europe/Berlin. Bestehender Branch `feat/pete-policy-v4-20261022`, Draft-PR #191.

**V5 ist lokal integriert und kostenlos geprüft. Kein Push, keine neue GitHub-CI und keine vollständige technische Abnahme behauptet.** Die externe No-Deploy-Kontrolle für einen Push ist noch nicht bestätigt. Cloudflare ist keine Voraussetzung für die lokale Entwicklung.

## Eindeutige Version

- Unveränderte GitHub-Basis: `81691850f2e8f322885c4cd798f186f5bde80abd`.
- Tatsächlicher lokaler Runtime-Commit: `828bf27645663afd08878d9bcbf7278b0b9a689b`.
- Runtime-Tree: `bc129de98200772b3f1e88cd4e7e89dfaacd553b`.
- Geprüftes ZIP: `PETE_YODA_V5_SAFETY_REVIEW_2026-10-26.zip`, 21.138 Bytes; selbst gemessener SHA256 `1f1fb9e558302f567a353eb85ca5dfa05d6585bc59957bd391762d2d6ead90a2`.
- Alle drei Original-Blob-SHAs und alle fünf Alt-Anker aus `SOURCE_REPLACEMENTS.json` gegen die tatsächliche Basis geprüft. Kein blindes Kopieren des synthetischen Classifiers.

Die Änderungen beschränken sich auf `pete-semantic-action-guard.ts`, `pete-conversation-quality.ts` und die bestehende `pete-v3-integration.test.ts`. Dieser Bericht ist eine separate Dokumentationsänderung.

Die parallele Forschung bleibt bytegleich zur Basis: `backend/src/core/pete-llm-conversation.ts` hat Blob `b55ce9fab83fbeb2d14b459a3c83e6a6a79b7edc`, `backend/src/config/pete-real-qa-turn-guidance.test.ts` hat Blob `ed432184727a5fd67cf630e1270c552927415c0c`. Keine Workflow-, Modell-, Budget-, Transport- oder Mobile-Quelländerungen.

## Geprüftes Verhalten

- Passive Kalender-/Buchungslinkfragen erhalten ausschließlich die konfigurierte allowlist-geprüfte HTTPS-URL. Keine neue Phase `booking_offered`, `wantsBooking=false`, kein `linkSentAt`, kein aktivierbarer Booking-Reminder bei 0/6/24/48/72 Stunden. Auch nach tatsächlichem Neustart des Store-Prozesses.
- Ausdrückliche Terminabsicht nutzt den bestehenden Bookingpfad. Der Status bleibt `awaiting_booking`; eine echte Bestätigung wird nicht erfunden. Ein früherer passiver Linkwunsch begründet keine spätere Terminabsicht durch eine bloße Verfügbarkeitsantwort.
- Verneinte/hypothetische Anfragen sowie eigene, Schul-, Kita-, Familien-, Arzt- und Friseurkalender aktivieren keine Buchung. Eine Absage/Änderung wird zur tatsächlichen Prüfung übergeben und erzeugt keine neue Buchung.
- Ein expliziter Terminwunsch mit Jochen bleibt auch bei beiläufigem Elternabend/eigenem vollen Kalender möglich. Die bloße Erwähnung Jochens autorisiert keinen Termin bei einem fremden Anbieter.
- Die vorhandene Engine erzeugt den Buchungsstatus ohne manuelle Test-Fallback-Aktivierung. Ein signierter synthetischer Calendly-Webhook bestätigt anschließend dieselbe Konversation. Falsche HMAC wird mit 401 abgewiesen, das doppelte Event dedupliziert, kein Versand als erfolgt markiert und der gebuchte Zustand nach neuem Prozessstart erhalten.
- Persistierte Reminder-Historie dedupliziert die 6h-Stufe und erhält 24h/48h-Stufen. Ein gebuchter Termin beendet Reminder; ein abgelaufenes tatsächliches 24h-Inbound-Fenster erlaubt keinen automatischen Versand.
- STOP, Human, AI-Pause, Handoff, Verkaufs-Opt-out, Privacy und medizinische Grenzen bleiben geschützt. Auch eine während des ausstehenden Modellaufrufs vollständig ersetzte Store-Aufzeichnung mit neuem Verkaufs-Opt-out kann keine Buchungsaktion erhalten. Die bestehende Engine prüft daneben weiterhin STOP/Human und überholte Nachrichten nach dem Await.
- Eine harmlose DIY-Chat-Supportfrage erhält bestätigte Fakten und ehrliche Unsicherheit, ohne dauerhafte Human-Übernahme. Chat-Support beim Selbststarter wird weder zugesagt noch ausgeschlossen. Persönliche 5-Wochen-Begleitung und DIY werden fachlich unterschieden. Echte Zahlungsprobleme und klare Übernahmeaufforderungen haben vor dieser Auskunft Vorrang.

## Tatsächlich kostenlose Prüfungen

Linux lokal, Node **22.23.4**, reale Repository-Engine und vorhandene Dienste; synthetische Leads, gemockte Modellantworten, nur lokale HTTP-Aufrufe. Jeder unten genannte finale Lauf hat Exit 0, keine fehlgeschlagenen oder übersprungenen Tests.

| Prüfung | Ergebnis | Lokaler Rohbeleg in `.qa-evidence/` neben dem Repository |
| --- | --- | --- |
| TypeScript-Build, `npm run check` | Build PASS | `pete-v5-backend-approved-node22.log` |
| Vollständige Backend-Suite | 741/741 PASS | derselbe Log |
| Desktop-Suite | 25/25 PASS | derselbe Log |
| Relay/Launcher/Preflight/QA-Vertragsregression | 36/36 PASS | derselbe Log |
| V3/V5 Engine-Integration separat | 132/132 PASS, bereits in 741 enthalten | `pete-v5-engine-verified-node22.tap` |
| Dashboard inklusive bestehendem Lab-Build | 103/103 PASS, beide Builds PASS | `pete-v5-dashboard-node22.log` |
| Tatsächlicher Vite-/Backend-Proxy | 9/9 PASS | `pete-v5-proxy-verified-node22.tap` |
| Tatsächlicher Chromium-/React-/Backend-Pfad | 9/9 PASS, Provider-Netz gesperrt | `pete-v5-browser-complete-node22.tap` |
| Restbudget-Schutz ohne Netzwerk | 10/10 PASS | `pete-v5-residual-node22.tap` |
| Backend- und Dashboard-Audit | jeweils 0 Befunde aller Schweregrade | `pete-v5-backend-audit.json`, `pete-v5-dashboard-audit.json` |
| Review-ZIP-Regeln separat | 75/75 PASS; isoliert, keine Engine-Prüfung | `pete-v5-package.tap` |
| Git-Diff/Umfang und Forschungsblobs | PASS | `git diff --check`, Commit/Blob-Vergleich |

Die zusätzlichen Engine-Tests liefen vor den Reparaturen tatsächlich rot: zunächst sieben vorbereitete Fehlerfälle auf der Originalbasis, dann sechs weitere Kandidatenfehler, später Absage/Fremdtermin sowie ein ersetzter Datensatz mit Opt-out. Diese wurden repariert; keine bestehenden Assertions gelockert oder Tests deaktiviert. Die Testannahme einer zwingenden ärztlichen Formulierung bei einem weichen medizinischen Hinweis wurde an die bestehende Schutzentscheidung angepasst; deren deterministische Abfangung, ausbleibende Provideranfrage und fehlende Buchungs-/Linkaktion werden ausdrücklich geprüft. Akute medizinische Fälle bleiben getrennt hart geprüft.

Umgebungsbefunde werden nicht versteckt: Ein Browseraufruf verwendete zunächst den nicht unterstützten Wert `chromium` als Channel, danach fehlte die Browserdatei. Die vorhandene offizielle Playwright-Installation wurde regulär ausgeführt und endete mit Exit 0. Ein späteres `npm exec` scheiterte beim erneuten Registry-Lookup für Node mit `E403 / GET https://registry.npmjs.org/node`; kein Mirror, keine geänderten Rechte und kein weiterer Registry-Zugriffsversuch. Die schon regulär installierte Node-22-Datei ermöglichte den anschließenden vollständig lokalen Browserlauf. Ein temporär getrenntes Exec-Transport sowie ein unvollständig protokollierter Proxy-Lauf wurden nicht als Nachweis gewertet; der abschließende vollständige Proxy-Lauf ist oben benannt. Ein durch zu breiten Patch-Kontext kurz falsch platzierter Cancellation-Return wurde vor dem finalen TypeScript-/Gesamtlauf korrigiert.

**Keine dieser Zahlen ist ein echter GPT-6.1-Sol-Gesprächsqualitätswert.** Die integrierten bekannten Fälle sind Regressionen. Keine neue blinde Qualitätsabnahme, kein 18/20- oder A−-Siegel. Null echte OpenAI-/Modell-Metadaten-/Calendly-/Meta-/WhatsApp-Provideraufrufe, keine QA-Ledger-Reservierung und keine zusätzlichen API-Kosten.

## Belegte Grenze und nächste Freigabe

Die aktualisierten PL-Kommentare `6425240587` und `6425963992` erlauben lokale Integration ohne Cloudflare-Login und untersagen den Push bis zum bestätigten No-Deploy-Nachweis. Der reguläre GitHub-App-Verwaltungsaufruf führte hier tatsächlich zu `https://github.com/login?return_to=https%3A%2F%2Fgithub.com%2Fsettings%2Finstallations`. Keine angemeldete Verwaltungssitzung; keine Installation/Repository-Auswahl eingesehen oder verändert. Ein aktives Cloudflare-Autodeploy ist damit weder bestätigt noch widerlegt. Das ist keine belegte GitHub-Codesperre.

Deshalb **kein Push**, keine alternative Contents-/Gitobjekt-Schreibroute, kein neuer Actions-Run und kein `workflow_dispatch`. Native Windows-PowerShell/CMD stehen in dieser Linux-Umgebung nicht bereit. Frühere grüne GitHub-Runs gelten nicht für den lokalen V5-Commit. Die bisherigen kostenlosen Linux-CI-Schritte wurden lokal ausgeführt; neue GitHub-Linux- und native Windows-CI bleiben offen. Die drei V5-Dateien liegen außerhalb des aktuellen Windows-Push-Pathfilters; nach zulässigem Push muss der **vorhandene** kostenlose Windows-Workflow gezielt per `workflow_dispatch` auf demselben Branch laufen. Kein neuer Workflow und keine Lockerung der Gates.

Nächster Schritt: Im bestehenden berechtigten GitHub-App-Zugang die Deploymentkopplung genau dieses Repositorys nachvollziehbar prüfen und gegebenenfalls gezielt entziehen/zurücklesen. Erst nach bestätigtem No-Deploy regulär auf PR191 pushen und vollständige kostenlose Linux-/Windows-CI auf dem tatsächlichen Remote-SHA auswerten. Danach PL-Qualitätsabnahme; echte Sol-QA nur mit separater Freigabe innerhalb bestätigter Ledger-Grenzen.

Phase0-Identitätsauslagerung und Mobile-Cleanup bleiben zurückgestellt, bis dieses Gesamtsystem-Gate erfüllt ist. Kein Merge, Deployment, Live-Send, echter Kundendatenzugriff oder neuer Agent.
