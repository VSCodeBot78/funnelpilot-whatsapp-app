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
