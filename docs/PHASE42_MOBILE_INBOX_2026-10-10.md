# Funnel Pilot – Phase 42: mobile Inbox mit Fokus auf Handlung

Stand 10.10.2026. UI/CI-Vorbereitung, keine echte Smartphone-Abnahme.

## Bedienung auf dem Handy
- `Chats` zeigt die kurze Leadliste mit drei überprüfbaren Filtern:
  Alle, Heiß (bestehende Readiness/Tag), Übernommen (nur realer
  Backend-State mit `owner=human` oder `aiPaused=true`).
- `Unterhaltung` zeigt nur den aktiven Chat, den bekannten Owner und
  `Pete pausieren · Übernehmen`. `Infos` zeigt den Lead-Kontext.
  Ohne Kontakt ist Chat-/Info-Schalter deaktiviert.
- Beim Tippen auf einen Lead wird auf die Unterhaltung gewechselt.
  Aus der Tagesübersicht kann ein Lead direkt im Chat geöffnet werden.
- Rückgabe an Pete erfordert eine bewusste Bestätigung. Bei STOP ist
  keine Freigabeschaltfläche sichtbar. Die serverseitigen STOP-/Handover-
  Sperren bleiben maßgeblich.
- Ohne geladenen Backend-State wird **kein** manueller Sendebutton
  angeboten. Keine lokal simulierte Nachricht darf als gesendet wirken.
  Entwürfe werden beim Kontaktwechsel verworfen, nicht an neue Personen
  mitgenommen. Bei nicht freigeschaltetem Meta-Send bleibt die Nachricht
  erhalten und es erscheint die bestehende Dry-Run-Meldung.

## Unveränderte Grenzen
Nur eine responsive Weboberfläche. **Keine installierbare PWA**, keine
Push-Nachrichten, keine Offline-Persistenz, keine Smartphone-App, kein
Fernzugriff vom Handy auf ein nicht authentifiziertes Laptop-Backend.
Die aktuelle Anwendung ist **single-workspace**; vor externen Coaches:
HTTPS, Login und Rollen, echte Tenant-Isolation, Backups und Datenschutz.

## Abnahme am realen Gerät (noch offen)
1. Auf einem gesicherten Testzugang im Android-Browser Breiten
   360/390/430px prüfen: Chats, Tab-Wechsel, Filter, Scroll, Tastatur.
2. Mit synthetischen Testleads Hot/Overtaken prüfen.
3. In realer Inbox Übernahme -> `owner=human`, `aiPaused=true`;
   keine Pete-Antwort; Rückgabe nur nach Bestätigung.
4. Offline-Backend und STOP: kein vorgetäuschter Versand oder KI-Start.
5. Desktop >850px auf regressionsfreie Mehrspaltenansicht prüfen.

Kein lokaler Port darf ungeschützt öffentlich erreichbar sein.
