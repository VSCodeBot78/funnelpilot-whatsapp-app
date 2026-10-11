# Temporäres privates Pete-Testlabor – Vorbereitung für kostenlose Testmonate

**Noch kein Deployment.** Diese Unterlagen sind ein Bereitstellungsbausatz; sie erteilen weder eine Provider-, Kosten-, KI-API- noch Meta-Live-Freigabe.

## Was bereitsteht

- Eigene minimale Android-PWA unter `/pete-test` statt des umfangreichen Funnel-Pilot-Dashboards; nur fiktive Testchats und das interne Pete-Kostenledger.
- Ein eigenständiger Server `mobile-lab/gateway.mjs`, der nach Anmeldung ausschließlich die statischen Test-App-Dateien und **drei** Labor-API-Routen freigibt: `GET /test-chat/lab/budget`, `GET /test-chat/lab/state/:syntheticId`, `POST /test-chat/lab/message`.
- Der bestehende Express-Backend-Prozess läuft auf **127.0.0.1:3011** und ist kein öffentlicher Port. Der Gateway übermittelt den internen Admin-Ingress-Secret ausschließlich **serverseitig**.
- Passwort-Anmeldung mit HttpOnly/Strict/Secure-Sitzungscookie (eine Woche gültig), fünf Fehlversuche/15 Minuten/verbundene IP, gleiche Origin für POSTs, Größenlimits und Sperre aller regulären Admin-/Meta-/Settings-/Leads-Routen.
- `mobile-lab/launcher.mjs` erzwingt ausgehende Instagram-/WhatsApp-Sende- und Engine-Flags **false**, löscht deren Zugangsdaten aus dem Backend-Prozess und verlangt einen eigenen, bestehenden Datenträger. Keine echten Kunden-Daten importieren. Der Kontrollpfad benötigt ein Login und ist trotzdem **kein** unabhängiges vollständiges Sicherheits-Audit.
- Docker-Build `Dockerfile.pete-lab` aus Root des Repositorys mit einer `.dockerignore`, die Zugangsdaten, Node-Module und Entwicklungsdaten ausschließt.

## Technisch vorbereiten, erst nach Provider-Verbindung und expliziter Freigabe ausführen

`npm ci --prefix backend`, `npm run build --prefix backend`, `npm ci --prefix dashboard`, `npm run build:lab --prefix dashboard`, `node --test mobile-lab/gateway.test.mjs`. Oder isoliertes Docker-Image über `Dockerfile.pete-lab` bauen.

**Geheime Werte ausschließlich im Secret-Store des Hosting-Anbieters** hinterlegen, nicht in GitHub, ChatGPT, einer Screenshotausgabe oder beim Nutzer im Browser:

| Variable | Bedeutung |
| --- | --- |
| `NODE_ENV=production` | Erzwingt Backend-Ingress-Schutz |
| `LAB_PUBLIC_ORIGIN` | Exakte HTTPS-Origin der späteren privaten App ohne abschließenden Schrägstrich |
| `LAB_ACCESS_PASSWORD` | Eigenes starkes Testlabor-Passwort, mind. 16 Zeichen; nicht OpenAI-Key |
| `LAB_SESSION_SECRET` | Zufälliges Geheimnis mit mindestens 32 Zeichen zur Signatur des Cookies |
| `FUNNELPILOT_ADMIN_INGRESS_SECRET` | **Separates** zufälliges Geheimnis mit mindestens 32 Zeichen zwischen Gateway und lokalem Backend |
| `LAB_DATA_DIR` | Absoluter Mountpfad eines **frischen separaten persistenten Volumes** außerhalb des Git-Repos, z. B. `/data/pete-lab`; muss existieren |
| `PETE_PROJECT_PRIOR_SPEND_MICRO_USD` | Vor Start neu überprüfter historischer Projekt-Gesamtausgabenbetrag in Mikro-US-Dollar (Stand 11.10.2026: `4323801`); damit werden alte API-Testkosten vom neuen 8-USD-Limit abgezogen |
| `PORT` | Öffentliches Port-Binding der Hostingplattform, Standard `8080` |
| `PETE_LLM_CONVERSATION_ENABLED` / `PETE_LLM_API_CALLS_APPROVED` | Standardmäßig nicht freigeben; echte KI-API-Aufrufe nur nach gesonderter Budgetfreigabe |
| `OPENAI_API_KEY` | Nur nach Budgetfreigabe im Provider-Secret-Store, **niemals** öffentlich oder im Build |

Keine Meta-, WhatsApp-, HubSpot-, Kalender- oder WooCommerce-Secrets verwenden. Der Container führt **keine** Instagram/WhatsApp-Outbound-Sends aus.

## Free/Trial-Einschätzung am 11.10.2026

Railway nennt für neue Accounts **30 Tage mit einmaligen 5 USD Guthaben**, im Trial bis **1 GB RAM** und bis **0,5 GB Volume-Speicher** (je nach Trial-Status Netzwerkbeschränkungen). Nach Trial nur **1 USD Gratisnutzung/Monat** und bis zu 0,5 GB RAM pro Service. Das ist **nicht** automatisch ein Monat 24/7-Verfügbarkeit. Quellen: https://docs.railway.com/pricing/free-trial, https://docs.railway.com/volumes/reference, https://docs.railway.com/pricing/plans.

**Abbruchkriterien vor Deployment:**
- Account nicht verbunden bzw. aktuelle Kosten-/Kontostatus nicht bestätigt; kein automatischer kostenpflichtiger Tarifwechsel.
- Persistentes Volume im gewählten Free-/Trial-Konto nicht verfügbar oder Volume-Mount nicht überprüfbar.
- `LAB_PUBLIC_ORIGIN`-/Secret-/Sitzungs-/TLS- und Private-Routen-Prüfung fehlen.
- Kein geltender autorisierter API-Kostenrahmen; Modellaufrufe bleiben aus.
- Unklarheit über echt verfügbare externe OpenAI-Netzverbindung (Railway Limited Trial kann sie einschränken).

**Anleitung für den späteren Android-Abschluss (erst nach Remote-Abnahme):** Chrome → authentisierte `https://...`-Testadresse öffnen → anmelden → Chrome-Menü „Zum Startbildschirm hinzufügen“/„App installieren“. Bei neuer Anmeldung ist GitHub nicht erforderlich. Nach dem Test das Icon/die App entfernen und Trial-/Hosting-Deployment und API-Secrets beim Anbieter deaktivieren/löschen. Kein echter Android-Test wurde bislang durchgeführt.

**Status:** isolierter Bereitstellungsbausatz, **keine installierbare Cloud-URL**, keine Anbieter-Verbindung, keine Kosten oder neue Live-Nachrichten.
