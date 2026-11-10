# PL20 | 10.11.2026 | Laptop-Instagram-Beta: signierter Webhook-End-to-End

## Ziel und Grenzen

Owner-Ziel: erster kontrollierter Instagram-Test auf eigenem Windows-Laptop am Wochenende 14./15.11.2026, ausschließlich Instagram `@eltern_fitundvital`; keine Cloud-/Serverbereitstellung und kein zusätzliches Hosting. Dies ist eine Arbeitshypothese für den Termin, keine Live-Zusage. Weiterhin verboten ohne gesondertes Owner-GO: öffentlicher Tunnel, Meta-App-/Callback-/Publish-Änderung, echte Meta-Nachrichten, OpenAI-Providerkosten, Aktivierung von Send/Engine, Push, Merge und Deployment.

## Nachweis: neuer lokaler signierter E2E-Test

Vorhandenes Backend (Express) und vorhandenes `scripts/local-webhook-relay.mjs` werden vom neuen `scripts/owner-laptop-instagram-relay-e2e.test.mjs` in einem *isolierten Kind-Testprozess* auf zufälligen Loopback-Ports hochgefahren; `DATA_DIR` ist ein temporäres Verzeichnis. Alle Verifizierungstokens, App-Secrets, Konten, Sender und Nachrichten sind ausdrücklich künstlich. Der Test fängt alle `fetch`-Aufrufe ab, die nicht an `127.0.0.1` gehen. Die produktive laufende Instanz auf 3001 und das Dashboard auf 5173 werden nicht verändert.

Verifiziert:
- `GET /health/readiness` meldet künstliche Test-Secrets konfiguriert, aber `instagramSendEnabled=false`, `instagramEngineEnabled=false`, `peteLlmCostGateApproved=false`, `localLaptopSafeMode=true`.
- Nur `/webhooks/meta/instagram` wird über den lokalen Relay weitergeleitet. `/health/readiness`, `/leads`, `/test-chat`, `/api/settings` erhalten `404`.
- `GET` mit passendem künstlichem `hub.verify_token` und `hub.challenge` erhält `200` mit exakt dem Challenge-Text, falsches Verify-Token erhält `403`.
- `POST` mit gefälschtem HMAC erhält `401`, exakt HMAC-SHA256-signiertes künstliches Instagram-Nachrichtenereignis erhält `200`, `sent=false`.
- Synthetische `DATA_DIR`-Dateien werden entfernt. Keine externe API, keine Kundendaten und keine reale Nachricht.

**Testnachweis:** `cd backend; node --import tsx --test ../scripts/owner-laptop-instagram-relay-e2e.test.mjs` -> **1/1 PASS**. Test dauerhaft in `backend/package.json` in reguläre `npm test:relay` und dadurch auch `npm test`-Kette aufgenommen. `npm run build` -> Exit 0; `npm test` -> Exit 0, einschließlich 669/669 Haupttests, 7/7 Lern- und 34/34 Relay-Untertests sowie des zusätzlichen neuen 1/1 Tests; alle übrigen Teilblöcke 0 FAIL. Logs am Besitzer-Desktop: `PL20_OWNER_LAPTOP_RELAY_E2E_2026-11-10.log`, `PL20_WEEKEND_PREP_BUILD_2026-11-10.log`, `PL20_WEEKEND_PREP_FULLTEST_2026-11-10.log`.

## Was für echten Test am 14./15.11. noch erforderlich ist

1. **Technische Testidentität und Geheimnisse:** Die tatsächlich laufende, unberührte Owner-Instanz meldet `instagramVerifyTokenConfigured=false` und `instagramAppSecretConfigured=false`, obwohl der synthetische Test PASS ist. Die existierenden Meta-Owner-Secrets müssen sicher **auf dem Laptop**, nicht in Chat/GitHub, hinterlegt und nach einem kontrollierten Neustart durch lokale GET-/HMAC-Prüfung bestätigt werden. Zugangsdaten nicht protokollieren.
2. **Meta/Test- und Datenschutz-Gates:** App `FunnelPilot WA` ist noch unveröffentlicht, `instagram_business_basic` und `instagram_business_manage_messages` nur „Bereit zum Testen“. Meta-Privacy/Userdatenlösch-URLs, reale KI-DM-DSAR-/Aufbewahrungs-/Provider-Regelung und zulässiger Own-Business-Teststatus müssen verifiziert werden. Keine erfundene Review-/Live-PASS.
3. **HTTPS kurzzeitig und testweise:** Der vorhandene lokale Relay lauscht auf 127.0.0.1:3002, nicht öffentlich. Für einen begrenzten Test kann erst nach ausdrücklichem Owner-GO ein `cloudflared` Quick Tunnel ausschließlich auf **Port 3002** geöffnet und temporäre Callback-URL in Meta eingetragen werden. Der Tunnelname ändert sich bei Neustart; nicht für dauerhafte Produktion. Cloudflare Docs: https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/ . Niemals Ports 3001/5173 öffentlich machen.
4. **Getrennte Teststufen:** Erst echte von einem autorisierten Instagram-Tester ausgehende DM **nur empfangen**, Engine/Send AUS; das beweist Meta-Delivery. Danach nur mit zweiter ausdrücklicher Live-Send-/API-Budget-Freigabe testen, dass Pete genau an diesen freigegebenen IGSID antwortet. Vorher fail-closed Owner-Beta-Sicherheitsprofil mit genau einer erlaubten IGSID, nachgewiesenem HMAC, STOP/Human-Kill-Switch und Cost-Cap. Der derzeitige NoSend-Relay sperrt absichtlich `instagramEngineEnabled=true`, `instagramSendEnabled=true` und eine positive Allowlist; diese Sperre **nicht einfach deaktivieren**.
5. **Owner-Wizard- und echte Gesprächsabnahme:** Dashboard 6-Schritt-Wizard bereits 19/19 Unit und 26/26 Browser PASS (lokaler Commit 05e332e); für Meta-Live sind authentifizierte Provider- und Webhook-Nachweise gesondert nötig. Human-Test/STOP und Pete-Dialogqualität im Echtgeldmodell noch offen.

**Belegt:** Vollständiger synthetischer GET/HMAC-Eingangsweg und sichere Trennung öffentlicher Webhook-Pfade; Testcode dauerhaft registriert und Gesamtregression grün. **Offen:** reale Secrets/Callback, Meta/Legal/Own-Business-Gates, separate echte Receive-/Send-Abnahme und Kostenfreigabe. **Nächster Schritt:** reale lokale Meta-Verifizierung sicher vorbereiten und *zunächst NoSend* abnehmen; Code für Owner-Beta-Send nur isoliert und mit eigenem Gate testen, keine vorzeitige Live-Aktivierung.
