# Funnel Pilot – Phase 35 / Priorität 5: Klartext-Startdiagnose

**Stand:** 10.10.2026. Code in GitHub integriert nach grünem PR-Test; echte Windows-/Mobile-Browser-Abnahme steht noch aus.

## Was neu ist

Im täglichen Dashboard erscheint nun ein kompakter, automatisch einmal ausgeführter **Systemcheck** mit der Aktion **„Erneut prüfen“**. Die Ansicht fragt ausschließlich per GET den bekannten Backend-Endpunkt /health/readiness ab, aktiviert **keine** Automatik und versendet **keine** Nachricht. Beim Verbindungsfehler, ungültiger Statusantwort oder Timeout wird kein grüner Test vorgetäuscht.

Der Check kennt drei verschiedene Stände:

- **Lokale Sicherheits-Flags geprüft:** Das Backend ist der erwartete Dienst im Entwicklungsmodus, WhatsApp/Instagram-Versand und Instagram-Engine sind aus, neue/allgemeine Instagram-Lead-Freigabe ist aus, Allowlist leer, destruktive Routen sind aus und generische Webhooks sind deaktiviert. **Nur Konfiguration.** Relay-Schutz und echte Meta-/Calendly-/Payment-Zustellung bleiben unabhängig offen.
- **Sicherheits-STOP:** Eine konkrete Abweichung ist nachweisbar. Kein Live-Versand, kein Tunnel, keine automatische Korrektur. Betroffene Schalter und nächste sichere Handlung werden benannt.
- **Sicherheitsstatus unvollständig / Backend nicht bestätigt:** Mindestens ein erforderlicher Status fehlt, der Server antwortet nicht oder der Dienst ist nicht das erwartete Funnel-Pilot-Backend. Fehlender Wert bedeutet **nicht** automatisch sicher.

Der Bildschirm erklärt die jeweils nächste Handlung in Alltagssprache (z. B. Backend-Fenster prüfen, sicherer Windows-Neustart, keine pauschale Senderfreigabe, generische Checkout-Routen aus). Die Statusdetails enthalten **keine API-Keys, Tokens oder persönlichen Lead-Daten**.

### Prüfumfang genau benannt

Die reale Backend-Readiness enthält neu das Bool-Feld genericWebhooksEnabled. Die Dashboard-Prüfung erfordert, dass es false ist. Weitere erwartete Werte: nodeEnv=development, instagramSendEnabled=false, whatsappSendEnabled=false, instagramEngineEnabled=false, instagramAllowAllSenders=false, instagramAutoEnableNewLeads=false, instagramAllowedSenderCount=0, destructiveRoutesDisabled=true. Unbekannte oder fehlende Felder bleiben **nicht grün**.

Der Browser kann aus Sicherheitsgründen den auf 127.0.0.1:3002 gebundenen eingeschränkten Relay **nicht als geprüft behaupten**: Der weiter geltende lokale HTTP-Preflight muss nach Serverstart separat im Repository mit

```powershell
node .\scripts\local-safety-preflight.mjs
```

ausgeführt werden. Ebenso ist kein tatsächlicher Meta-Send, Signatur-Webhook, echte Terminbuchung, echte Zahlung oder SaaS-Zugriffskontrolle durch die UI-Diagnose nachgewiesen.

## Vereinfachungen für den Alltag

- **Startseite:** Statusanzeige mit eindeutigem „Erneut prüfen“ und Einstieg in bestehende Verbindungs-Einrichtung.
- **Fehlermeldung Backend offline:** Ein Klick auf „Erneut prüfen“ im roten/gelben Hinweis fragt /health erneut ab, ohne kompletten Dashboard-Neustart.
- **Einrichtungs-Wizard:** Teilt die strengere lokale Sicherheitsbewertung; bei offenen Punkten erscheinen nächste Schritte. Eine fehlgeschlagene **optionale** OAuth-Statusabfrage für Kalender/CRM lässt einen separat erfolgreich gelesenen Backend-Status bestehen. Umgekehrt führt eine fehlende Backend-Statusantwort nicht zu einer grünen Anzeige.
- **Ältere Einrichtungsansicht:** Ihr Versand-Sicherheitsindikator nutzt denselben vollständigen Sicherheitscheck statt nur der beiden Sendekanal-Flags.

## Technische Umsetzung

- Backend: backend/src/app.ts ergänzt nur den lesenden Bool genericWebhooksEnabled auf /health/readiness.
- Pure Diagnose: dashboard/src/diagnostics/systemDiagnostics.js mit drei Zuständen, Einzelchecks und Handlungsempfehlungen; extern geprüfte Systeme sind bewusst separat offen.
- Oberfläche: dashboard/src/diagnostics/SystemStatusPanel.jsx, DashboardHome.jsx, workspace.css; keine API-Schreibaufrufe, kein Provider-Kontakt, keine Live-Freischaltung.
- Einrichtungsdiagnose: dashboard/src/onboarding/onboardingReadiness.js und SetupWizardModal.jsx; Fallback-Status und Hilfetexte konsistent.
- Gesundheitsanzeige: dashboard/src/hooks/useBackendHealth.js und App.dashboard.jsx um manuelle Wiederholung erweitert.
- Tests: dashboard/src/diagnostics/systemDiagnostics.test.js prüft alle unsicheren/fehlenden Schalter, falschen Backend-Dienst, unverifizierte externe Systeme, ausschließlich lesende UI-Anbindung sowie Retry und unabhängige OAuth-Prüfungen. onboardingReadiness.test.js schützt die bestehende Einrichtungslogik.

## Spätere Windows-Abnahme

1. Aktuellen Branch funnel-pilot-current starten mit den sicheren Phase-32-Befehlen. Kein Live-Send.
2. Dashboard → **Systemcheck**: vollständige Flags grün; Details sagen ausdrücklich „Relay separat offen“.
3. Mit absichtlich blockiertem/ausgeschaltetem Testbackend: Status unbestätigt/offline; erneute Prüfung nach Backendstart geht wieder grün. Keine Demo-Leads, keine falsche Erfolgsbestätigung.
4. Backend außerhalb des sicheren Startprofils mit absichtlich abweichendem Flag **nur in isolierter Testumgebung** simulieren: Der Systemcheck muss STOP zeigen, ohne ein Flag selbst zu ändern.
5. Separaten Node-Preflight auf dem Laptop ausführen; in Systemcheck und Wizard darf dessen Ergebnis **nicht** ohne Nachweis als erledigt erscheinen.
6. Eine nicht erreichbare Kalender-/CRM-Statusabfrage darf die korrekte Backend-Sicherheitsdiagnose nicht verdecken.

**Grenzen:** Kein echter Windows- oder Smartphone-Lauf, keine tatsächliche Meta-API-/Calendly-/Payment-Anbindung, keine echten Nachrichten und keine neue Hosting-/API-Ausgabe. Priorität 6 (Datenschutz, Produktionsbetrieb/Hetzner) und 7 (Coach-Onboarding) bleiben offen.
