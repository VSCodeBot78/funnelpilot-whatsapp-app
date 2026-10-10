# Funnel Pilot – Laptop-Abnahme vor Hetzner (Windows)

**Stand:** 10.10.2026. Erst interne Tests, dann kontrollierter Meta-Testaccount, dann erst Hetzner. Keine Meta-App-Review in dieser Phase.

## 1. Voraussetzungen

- Windows mit PowerShell, Git, Node.js 20+ und npm.
- Repository lokal geklont, aktueller Branch `funnel-pilot-current`.
- Bei bestehenden Meta-Testdaten: `backend/.env` mit lokal gespeicherten Secrets; **niemals Secrets nach GitHub committen**.
- `cloudflared` nur für den späteren optionalen Meta-Webhooks-Empfang (bereits früher eingerichtet).

**Sicherheit:** Niemals `cloudflared tunnel --url http://localhost:3001` verwenden. Dort liegen nicht authentifizierte Admin-APIs. Stattdessen den neuen lokalen Relay-Port **3002** verwenden. Der Relay erlaubt nur GET/POST an `/webhooks/meta/instagram` und `/webhooks/meta/whatsapp`. Dashboard und Backend bleiben lokal.

## 2. Lokal aktualisieren und automatische Tests ausführen

PowerShell im Stammverzeichnis des Repositorys:

```powershell
git switch funnel-pilot-current
git pull --ff-only
if (!(Test-Path .\backend\.env)) { Copy-Item .\backend\.env.example .\backend\.env }
npm --prefix .\backend ci
npm --prefix .\dashboard ci
npm --prefix .\backend run check
npm --prefix .\dashboard run build
```

Nur bei erfolgreichem Backend-Build, **allen** Backend-Tests (einschließlich Relay-Sicherheit) und Dashboard-Build weitergehen. Keine Produktion einschalten.

## 3. Drei lokale Fenster öffnen

**Fenster A – Backend** (PowerShell im Repository-Stammverzeichnis):

```powershell
cd .\backend
$env:NODE_ENV="development"
$env:PORT="3001"
$env:INSTAGRAM_ENGINE_ENABLED="false"
$env:INSTAGRAM_SEND_ENABLED="false"
$env:INSTAGRAM_ALLOWED_SENDER_IDS=""
$env:INSTAGRAM_ALLOW_ALL_SENDERS="false"
$env:INSTAGRAM_AUTO_ENABLE_NEW_LEADS="false"
$env:WHATSAPP_SEND_ENABLED="false"
$env:ENABLE_GENERIC_WEBHOOKS="false"
$env:DISABLE_DESTRUCTIVE_ROUTES="true"
npm run dev
```

Diese **Prozess-Umgebungsvariablen übersteuern auch eine ältere lokale `.env` mit aktiven Sende-Flags**. Das Backend bindet im Development-Modus nur an `127.0.0.1:3001`.

**Fenster B – Dashboard** (PowerShell im Repository-Stammverzeichnis):

```powershell
cd .\dashboard
npm run dev -- --host 127.0.0.1
```

Im Browser **http://127.0.0.1:5173** öffnen, dort Dashboard und Testchat verwenden. Der Vite-Proxy leitet lokale API-Aufrufe an Port 3001.

**Fenster C – sicherer Meta-Webhook-Relay** (PowerShell im Repository-Stammverzeichnis):

```powershell
node .\scripts\local-webhook-relay.mjs
```

In einem vierten PowerShell-Fenster kann das Routing geprüft werden:

```powershell
Invoke-WebRequest http://127.0.0.1:3001/health
try { Invoke-WebRequest http://127.0.0.1:3002/health } catch { $_.Exception.Response.StatusCode }
```

Erwartung: Backend `/health` lokal 200; Relay `/health` **404**. Eine fehlende Meta-Signatur muss vom Backend abgelehnt werden. Bei gültigen Meta-Testevents im aktuellen Testmodus werden keine produktiven Antworten gesendet.

## 4. Optional: Meta Quick Tunnel NUR für Webhooks

**Erst** wenn lokale Tests grün sind:

```powershell
cloudflared tunnel --url http://127.0.0.1:3002
```

Die neu ausgegebene `https://…trycloudflare.com`-Adresse in Meta verwenden als:

- Instagram Callback: `https://…trycloudflare.com/webhooks/meta/instagram`
- WhatsApp Callback: `https://…trycloudflare.com/webhooks/meta/whatsapp`

Die Challenge/Signatur nutzt weiterhin die vorhandenen echten Secrets in `backend/.env`. **Keine Secrets hier in Chat oder GitHub einfügen.** Kein Meta Review in dieser Phase. Meta kann im Development Mode echte DMs weiterhin einschränken.

## 5. Abnahmematrix und Kriterien

| Bereich | Lokal prüfbar | Erforderlicher Nachweis |
| --- | --- | --- |
| Dashboard & Testchat | Ja | Startet, beantwortet Testfragen; Backend `/health` 200 |
| Produktwahrheit | Ja | 14,95 € / 499 € / 2.499 €; keine erfundenen Preise |
| Link-Routing | Ja | 4 konfigurierbare Links, eigene Overrides, kein Checkout/Elterncheck-Mix |
| Human Takeover | Ja | Human Ownership blockiert Pete und Follow-ups |
| Instagram Parser/HMAC/Dedupe | Ja | Signierte Testevents durch Relay, keine Doppelverarbeitung |
| WhatsApp Parser/HMAC/Dry-Run | Ja | Signierte Testevents durch Relay, 0 echte Sends |
| ManyChat-Koexistenz | Lokal teilweise | Neue Instagram-Leads ohne explizites Handoff KI-still |
| Echte Meta-DMs & Send | Noch nicht vollständig | Später nur Test-Sender mit eigener Allowlist und expliziter Freigabe |
| 24/7, Neustart und persistente Bereitstellung | Nein | Später auf Hetzner gesondert testen |

**Abbruchkriterien:** Irgendein nicht geplanter echter Send, Relay liefert Admin-Daten, ein Human Takeover wird überschrieben, ein Link/Preis ist erfunden, oder Build/Tests sind rot.

## 6. Danach, nicht vorher

1. Kontrollierter Testaccount mit expliziter `INSTAGRAM_ALLOWED_SENDER_IDS`-Allowlist, bewusster Handoff-Zustimmung und isoliertem Send-Test. ManyChat darf dort nicht ebenfalls antworten.
2. Echter Instagram-/WhatsApp-Nachweis; zunächst nur ein Testlead.
3. Meta App Review erst nach interner Freigabe.
4. Hetzner inklusive TLS, Reverse Proxy, Authentifizierung aller Admin-APIs, persistenter Speicherung, Backups und Monitoring.

**Kosten:** Laptop-Test mit den bestehenden Tools erfordert keinen Hetzner-Server. Falls ein echter OpenAI-Aufruf erfolgt, können API-Gebühren anfallen. Das lokale Testprogramm legt keine kostenpflichtigen Cloud-Ressourcen an.

## 7. Geführtes App-Onboarding ab Phase 15

Beim ersten Öffnen des Dashboards wird die Seite **Einrichtung** angezeigt. Sie bleibt jederzeit links in der Navigation erreichbar. Die vier Abschnitte sind:

1. **Workspace:** Produkt- und Betreibername sowie Branding, Speichern im Backend.
2. **Pete:** Assistent, Markenstimme, Sprache und Eskalationsregel, ebenfalls im Backend gespeichert.
3. **Kanäle & Sicherheit:** API-/Token-Konfiguration wird am lokalen `/health/readiness` geprüft. **Konfiguriert bedeutet nicht live verbunden.** Kein OAuth-/Meta-One-Click-Connect.
4. **Gesamtablauf:** Kampagnen, Testleads, Inbox, Human Takeover, Follow-ups, Termine, Testchat. Zusätzlich ist ein **simulierter 499-€-Kauf** mit vorbereiteter Onboarding-Termineinladung möglich.

Der simulierte Checkout ist nur über die lokale Dashboard-Backend-Verbindung aufrufbar und erzeugt einen eigenen synthetischen Testlead. Er führt **keine Zahlung und keinen Nachrichtenversand** aus. Die Invite-Markierung heißt jetzt `onboardingPromptPreparedAt`; sie darf nicht mit einer tatsächlich gesendeten Nachricht verwechselt werden.

Die Einführung lässt sich verlassen und über **Einrichtung** jederzeit erneut öffnen. Der Browser speichert dabei nur den Hinweis, dass die Einführung bereits angezeigt wurde. Das ist **kein serverseitiger Kunden-Onboarding-Abschlussstatus**. Die One-Click-Verbindung echter Meta-Konten und ein Live-Test des Kauf-/Onboarding-Versands sind weiterhin offen.

**Wichtige Begriffe:** Betreiber-Onboarding = Ersteinrichtung der Software. Kunden-Onboarding = Termin-/Einladungsprozess nach Kauf des Coachings. Beide können jetzt lokal in ihren vorhandenen Teilen getestet werden; der vollständige produktive Versand bleibt gesondert abzunehmen.
