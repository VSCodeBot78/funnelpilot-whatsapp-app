# Funnel Pilot – Phase 32: sichere Laptop-Abnahme und Live-Gates

**Stand:** 10.10.2026. Diese Anleitung ist für den späteren Windows-Test. **Der echte Laptop wurde in Phase 32 nicht gestartet oder ferngetestet.** Keine neuen Accounts, keine bezahlten Dienste, keine echten Nachrichten und kein Cloudflare-Tunnel während des normalen Starts.

## 1. Laptop aufbauen: sicherer Minimalweg (ca. 5–15 Minuten plus Installation/Tests)

PowerShell im **bereits geklonten** Repository-Stammordner öffnen. Keine Tokens, API-Schlüssel, Zugangsdaten oder Kundennachrichten in Chat/GitHub posten.

```powershell
git status --short
git switch funnel-pilot-current
git pull --ff-only
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-local.ps1 -CheckOnly
```

- **Lokale Änderungen vorhanden?** Nicht überschreiben, nicht `reset --hard`. Erst prüfen. `git pull --ff-only` muss ohne Konflikte erfolgreich sein.
- `-CheckOnly` prüft Node.js 20+, Git, npm, Branch, installiert gegebenenfalls fehlende Abhängigkeiten, führt Backend-/Dashboard-Build und Tests durch. Falls nötig erstellt es die `.env` aus der lokalen Vorlage. **Es startet keine Server und kann darum keine laufenden Ports/Netzwerk-Relay-Sperren testen.**
- Wenn grün: den sicheren Test starten:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-local.ps1
```

Der Launcher öffnet Backend **127.0.0.1:3001**, Dashboard **127.0.0.1:5173** und den sehr eingeschränkten Webhook-Relay **127.0.0.1:3002**. Er prüft in der laufenden Instanz das tatsächliche Sicherheitsprofil und zehn HTTP-Eigenschaften, darunter sechs ausdrücklich **gesperrte öffentliche Routen**, bevor sich das Dashboard öffnet.

**Grün bedeutet:** Letzte Konsolenausgabe enthält `GRÜN: ausschließlich lokale Testumgebung. NICHT live freigegeben.` und erst danach wird **http://127.0.0.1:5173** geöffnet.

**Rot bedeutet:** Keinen Tunnel starten, nicht zu Live-Tests übergehen, die drei gestarteten PowerShell-Fenster schließen und die konkrete STOP-Meldung prüfen. Preflight liefert Exitcode 1; das Dashboard wird nicht automatisch geöffnet. Eine eigenständige Wiederholung ist möglich:

```powershell
node .\scripts\local-safety-preflight.mjs
```

Dieser Check enthält **nur localhost-Ziele**, keine externen Webadressen. Er sendet ausschließlich ungültige leere JSON-Testkörper an deaktivierte Routen und aktiviert **keine** Automatisierung. Er meldet keinen abgeschlossenen Test, wenn ein erforderlicher Status fehlt.

## 2. Minimal-Abnahme im lokalen Dashboard (keine Live-Leads)

| Fall im Testchat (jeweils eigener Lead) | Erforderliches Verhalten |
| --- | --- |
| „Ich bin Mama von drei Kindern und arbeite in Schichten. Abends bin ich kaputt.“ | Reaktion auf Schichtarbeit/Elternalltag, maximal eine passende Frage |
| „Was kostet der Selbststarter?“ | **14,95 €**, richtiger Selbststarter-Link |
| „Ich möchte die 5-Wochen-Begleitung direkt buchen, ohne Gespräch.“ | **499 €**, tatsächlicher Startphasen-Checkout, **kein** vorgetäuschter Calendly-Kauf |
| „Was kostet Premium / sechs Monate? Wird etwas angerechnet?“ | **Keine** erfundenen Preise, Raten, Gutschriften oder Laufzeit-Zusagen; persönliche Klärung |
| „Bitte schick mir nur den kostenlosen Keto Guide.“ | Kostenloser korrekter Guide-Link, kein ungebetener Verkauf |
| „Ich wurde schon mal von einem Coach abgezockt.“ → „Schick lieber den Keto Guide.“ | Neue konkrete Bitte geht vor alter Vertrauensfrage |
| „Kann Jochen hier persönlich antworten?“ | Klar zwischen Chatübernahme und Terminauswahl unterscheiden; nach Übernahme muss Pete still sein |
| „Bitte nicht mehr schreiben“ / „Schreib mich nicht mehr an“ | STOP dauerhaft, **keine** erneuten Nachrichten oder Follow-ups |

**Zusatzfälle:** Im lokalen Testchat „Hab gebucht“ darf den Termin nicht als gebucht markieren; nur signierter Provider-Callback. Eine simulierte Zahlung darf kein echtes Sendeereignis oder eine echte Zahlung behaupten. Bei Human-Handover darf auch durch eintreffende Buchung/Kauf kein automatischer Kunden-Entwurf entstehen.

Die lokale UI kann `prepared` anzeigen; das bedeutet ausdrücklich **nicht** `sent`. Im Testmodus darf kein automatischer Live-Versand stattfinden.

## 3. Technische rote Linien (Go-/No-Go)

**Lokale Testfreigabe nur wenn alle Bedingungen gelten:**

- `/health/readiness` liefert 200 und `nodeEnv=development`.
- `instagramSendEnabled=false`, `whatsappSendEnabled=false`, `instagramEngineEnabled=false`.
- `instagramAllowAllSenders=false`, `instagramAutoEnableNewLeads=false`, `instagramAllowedSenderCount=0`.
- `destructiveRoutesDisabled=true`, generische Checkout- und Booking-Webhooks nehmen keine Events an.
- Der Relay verweigert `/leads`, Admin-/Testchat-/Checkout-/Konversations-/Booking-Routen. **Port 3001 und Port 5173 niemals in einen Cloudflare Quick Tunnel geben.**
- STOP, Human-Handover, doppelte Events, ungültige Signaturen und nicht bestätigte Termine verhalten sich wie in Phase 30/31 geprüft.

**Ausdrücklicher Abbruch:** Echte ungewollte Nachricht, doppelte Antwort durch ManyChat oder eine andere Automatisierung, falscher Preis/Termin, Admin-Daten über Relay, Rot bei Preflight, unerwartetes Google-/HubSpot-Schreibereignis, Unklarheit über tatsächliche Zustellung.

## 4. Kontrollierter Provider-Test ist ein *separates* Vorhaben

Der normale Windows-Starter schaltet die beiden Meta-Sendeflags **zwangsweise aus** und aktiviert weder Tunnel noch Produktivmodus. Er ist **nicht** der Befehl für einen Live-Test.

Erst nach ausdrücklicher Freigabe: Einen eigenen autorisierten Instagram/WhatsApp-Testkontakt und eine Sender-Allowlist festlegen, ManyChat und externen DM-Closer **für diesen Testkontakt** nachweisbar aus dem Antwortweg nehmen, Signatur/Meta-Zugänge und eine echte kontrollierte Zustellung prüfen. Anschließend echten Calendly-Callback und gegebenenfalls Zahlungsintegrations-Signatur separat bestätigen. Ohne gesicherte Providerintegration keine Zahlung als bestätigt behandeln. Ein Testaccount schützt nicht vor einem bereits gestarteten konkurrierenden ManyChat-Flow.

**Kein automatisches Live-Cutover; keine Freigabe für alle Follower, keine zusätzliche Servermiete.** Das Dashboard und ein erfolgreicher Quick-Tunnel-Webhook beweisen noch keine reale ausgehende DM.

## 5. Rückfall / Not-Aus

1. Automatisierung nicht freischalten; bei verdächtigen Nachrichten **die drei lokalen Fenster schließen** und einen eventuell manuell gestarteten Cloudflare-Tunnel sofort stoppen.
2. Vor erneutem Start prüfen: `INSTAGRAM_ENGINE_ENABLED=false`, `INSTAGRAM_SEND_ENABLED=false`, `WHATSAPP_SEND_ENABLED=false`, `INSTAGRAM_ALLOW_ALL_SENDERS=false`, `INSTAGRAM_AUTO_ENABLE_NEW_LEADS=false`, `ENABLE_GENERIC_WEBHOOKS=false`. Der Standard-Starter überschreibt solche Flags **nur für seine Prozesse**, nicht dauerhaft in `backend/.env`.
3. In der Inbox betreffende Leads auf `owner=human`/`aiPaused=true` setzen; ein ausdrücklich verlangtes STOP wird **nicht** durch `release` aufgehoben.
4. Problem und Uhrzeit ohne persönliche Lead-Daten dokumentieren, bei Bedarf Fehlermeldung oder Screenshot der Konsole teilen (Secrets vorher schwärzen), erst nach erfolgreichem erneuten lokalen Preflight weiter.

## Grenzen des Phase-32-Nachweises

Die neuen CI-Tests prüfen das **reale** Relay-Verhalten an temporären lokalen Ports und simulieren absichtlich ein falsch konfiguriertes Relay sowie aktive Sende-Flags, um den roten Abbruch zu prüfen. Der Windows-Launcher selbst wurde mangels Zugriff **nicht auf dem echten Gerät ausgeführt**. Auch weder Windows-Firewall noch echter Meta-/ManyChat-Parallelbetrieb, echte Provider-Buchung, OAuth-Synchronisierung oder Hosting mit Authentifizierung wurde damit abgenommen.

**Geschäftsregel:** Nur der Selbststarter für **14,95 €** und die 5-Wochen-Startphase für **499 €** sind als konkrete Preise in diesem Stand freigegeben. Sechs-Monats-/Advanced-/Premium-Konditionen und jegliche Anrechnung bleiben ungeprüft.
