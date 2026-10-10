# Funnel Pilot – Phase 39: lokaler Laptop-Sicherheitsmodus

Stand: 10.10.2026. **Code-/CI-Vorbereitung**, kein echter Windows-/Meta-/Live-Abnahmetest.

## Ziel
Den bestehenden sicheren Windows-Start aus Phase 32 für einen später länger
laufenden, zugeklappten Laptop robuster machen, ohne Sendefreigabe oder Server.

## Implementiert

1. `scripts/start-local.ps1` startet das Backend mit
   `FUNNELPILOT_LOCAL_TEST_MODE=true`, `NODE_ENV=development`,
   localhost-CORS und explizit deaktivierten Sende-, Engine- und
   allgemeinen Webhook-Schaltern. `-CheckOnly` startet keine Server.
2. `backend/src/config/local-laptop-safe-mode.ts` verweigert den Backend-Start,
   wenn in diesem Modus einer der verpflichtend gesperrten Schalter aktiv
   oder unklar ist, die Sender-Allowlist nicht leer ist, destruktive Routen
   nicht deaktiviert sind oder `NODE_ENV` nicht `development` lautet.
   Das gilt auch bei einem automatischen Dev-Server-Neustart.
3. `/health/readiness` meldet den Status `localLaptopSafeMode`.
   Der Start-Preflight verlangt diesen Status und prüft jetzt ausdrücklich
   auch `genericWebhooksEnabled=false`.
4. Der lokale Relay (Port 3002) prüft **vor jeder erlaubten Callback-
   Weiterleitung** das vollständige Backend-Sicherheitsprofil über
   `127.0.0.1:3001/health/readiness`. Bei nicht erreichbarem Backend,
   falschem Profil oder Timeout: **503, keine Weiterleitung**.
   Admin-/Lead-Routen bleiben grundsätzlich 404. Diese zusätzliche
   Sperre ist bewusst für den **lokalen, nicht sendenden Modus**.
5. Negative Tests prüfen falsche/fehlende Flags, fehlenden Mode-Lock,
   laufenden Relay nach unsicherem Backend-Neustart und Backend-Ausfall.

## Später einmal am Windows-Gerät prüfen

- Laptop **am Strom**, Belüftung frei und stabile Verbindung.
- Windows > Energieoptionen > "Auswählen, was beim Zuklappen des Computers
  geschehen soll": bei Netzbetrieb "Nichts unternehmen". Netzbetrieb:
  Ruhemodus/Energiesparen passend deaktivieren. **Keine automatische
  Energieeinstellung durch dieses Projekt.**
- PC mit `Win + L` sperren, nicht ungeschützt lassen; möglichst
  Datenträgerverschlüsselung und Windows-Updates aktiv halten.
- Repository-Stand lokal aktualisieren; Phase-32-`-CheckOnly` und sicheren
  Starter ausführen; sicherstellen, dass Preflight grün ist.
- Testweise bei deaktivierten Sends Backend beenden: Relay muss
  Instagram-/WhatsApp-Callback mit 503 abweisen. Danach den vollständigen
  **sicheren** Starter erneut ausführen, nicht einen unkontrollierten
  separaten Server.
- Dashboard/Inbox, Pete-Fälle, Android-Browser und Windows-Schlafzustand
  separat auf echtem Gerät prüfen.

## Explizite Grenzen

- **Kein** automatischer Windows-Dienst und **kein** Autostart nach Reboot,
  kein Cloudflare-Tunnel, keine Benachrichtigung aufs Smartphone bei Ausfall,
  keine Fernzugriffslösung.
- Wenn Windows schläft, herunterfährt, offline ist oder Updates installiert,
  ist Funnel Pilot **nicht erreichbar**. Ein lokaler Laptop ist kein
  Hochverfügbarkeitsserver.
- **Keine** automatische Instagram-/WhatsApp-Nachricht. Der Lock verhindert
  im lokalen Modus bewusst den späteren kontrollierten Live-Send.
  Dafür braucht es einen **separat freigegebenen** Live-Test mit
  signierter Provider-Verbindung, freigegebener Test-ID und ohne ManyChat-
  Doppelantworten; niemals diesen lokalen Lock aufweichen.
- Die Relay-Prüfung schützt den Eingang, ersetzt aber keine
  HTTPS-Terminierung, Authentifizierung, Datensicherung, DSGVO-Prüfung oder
  Mandantentrennung.
