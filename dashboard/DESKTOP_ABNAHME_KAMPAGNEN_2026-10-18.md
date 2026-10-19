# Desktop-Kampagnen-Dashboard – Abnahmeprotokoll

Stand: 18.10.2026, Draft PR #184, Basis `feat/pete-phase4b-event-origin-readonly-20261017`.

## Geltungsbereich und harte Grenzen

Diese Checkliste prüft ausschließlich den **Desktop-Kampagneneditor** samt read-only
Kampagnenvorschau. **Keine** Freigabe für Meta-/WhatsApp-Sends, Pete-Livebetrieb,
Follow-up-Scheduler, kostenpflichtige API-Aufrufe, Deployments oder eine
öffentlich zugängliche Pete-Testumgebung. Alle Versandschalter bleiben aus.
Die Mobilversion wird **erst nach** erfolgreicher Desktop-Bedienungsabnahme
übernommen. Kundendaten nicht in öffentlich zugänglichen Demos verwenden.

Voraussetzung der manuellen Browserprüfung: Eigentümer nutzt den erlaubten,
privaten Desktop-Testzugang und einen abgeschotteten Testdatenbestand.
**Nicht** die öffentliche `fp-mobiltest-jochen-2026.pages.dev`-Vorschau als
Pete-/Backend-Testlabor verwenden. Für alle Tests nur künstliche Kampagnen,
Keywords, URLs und bestätigte synthetische Beispielfall-IDs einsetzen.
Keine neuen Provider-Verbindungen oder Berechtigungen installieren.

## Abnahmeliste (20 Fälle)

Pro Fall in der Laptop-Prüfung: `PASS`, `FAIL` oder `BLOCKED` und Screenshot/Notiz
eintragen. Die folgenden Sollzustände sind **keine bereits bestätigten Ergebnisse**.

| Nr. | Handlung | Sollverhalten | Status |
|---|---|---|---|
| 01 | Kampagnen öffnen | Liste und Editor sind sichtbar, der Entwurfsmodus ist kenntlich | OFFEN |
| 02 | Leere Kampagne anlegen | Name bearbeitbar, alle Automations-/Handoff-/Follow-up-Schalter aus | OFFEN |
| 03 | Vorlage „Instagram-DM mit Keyword“ erstellen | `CHECK` und Einstieg `Instagram-DM` voreingestellt, nicht live | OFFEN |
| 04 | Vorlage „Reel-Kommentar mit Keyword“ erstellen | `BULLSHIT` und Reel-Auslöser gesetzt, kein Versand | OFFEN |
| 05 | Story-Vorlage und WhatsApp-Vorlage erstellen | `KETO` bzw. `START` als editierbare Beispiele, nicht live | OFFEN |
| 06 | Manuelle Follower-Begrüßung öffnen | Kein automatisches erstes Anschreiben | OFFEN |
| 07 | Reel-Schalter „Alle Reels“ an/aus | Bei aus öffnet sich Bereich für ausgewählte Reels | OFFEN |
| 08 | Zwei bestätigte 8–32-stellige Reel-Media-IDs hinzufügen | Auswahlkarten sichtbar, einzeln entfernbar, keine Dublette | OFFEN |
| 09 | Reel-Link, Buchstaben und 41. Reel-ID probieren | Ungültige Eingaben zurückgewiesen, keine geschätzte ID/Bilder | OFFEN |
| 10 | Verschiedene Keywords im gleichen Ablauf setzen | Gemeinsam benutzter Antworttext klar; unterschiedliche Texte benötigen getrennte Kampagnen | OFFEN |
| 11 | Feste Nachricht per Schalter anlegen | Text wird in Flow und Chat-Vorschau angezeigt, nicht versendet | OFFEN |
| 12 | Link-Schalter einschalten und HTTPS-Adresse setzen | Link-Beschriftung und URL sichtbar, nur unanklickbare Vorschau | OFFEN |
| 13 | Ungültige/nur angefangene URL eingeben | Warnung sichtbar; Wechsel darf Text nicht unbemerkt verwerfen | OFFEN |
| 14 | Pete-Übergabe aktivieren und wieder deaktivieren | Nur Entwurfsanzeige ändert sich; keine KI-Anfrage | OFFEN |
| 15 | Kampagne speichern und erneut öffnen | Änderungen und Schalter bleiben erhalten | OFFEN |
| 16 | Gespeicherten Kampagneneinstieg in Vorschau übernehmen | Quelle und Keyword füllen sich; bei Reels ohne ID expliziter Hinweis | OFFEN |
| 17 | Check, KETO oder BULLSHIT mit passendem Ursprung simulieren | Eindeutiger Treffer oder begründeter Konflikt/kein Treffer, `sendAllowed:false` | OFFEN |
| 18 | Ungespeicherte Eingaben, auch angefangenen HTTPS-Link, dann Kampagne wechseln | Optionen Speichern, Bearbeiten, bewusst Verwerfen; niemals stiller Verlust | OFFEN |
| 19 | Kampagnensuche nach Name, Keyword und Quelle benutzen | Passende Liste; keine Ergebnisse = klarer Hinweis | OFFEN |
| 20 | Kampagne löschen (nicht letzte) | Explizite Bestätigung, Abbrechen möglich, erst nach Backend-Erfolg entfernt | OFFEN |

## Technische Negativfälle für die Entwicklerprüfung

- Backend-Create verweigert: kein Phantom-Datensatz und keine scheinbare Erfolgsmeldung.
- Backend-Save verweigert: ungespeicherter Formzustand wird nicht als gespeichert bezeichnet.
- Nur Buchungskonfiguration schlägt nach bestätigtem Kampagnen-Update fehl:
  **Teilerfolg wird klar angezeigt**. Der Fall ist derzeit noch separat zu
  prüfen, bevor die Bedienung als fertig gilt.
- Verspätete Antworten von Kampagne A dürfen nicht in Editor B erscheinen.
- Reel-Preview ohne bestätigte Media-ID muss `manual_review` bzw. einen
  sichtbaren Hinweis ergeben. Keine fiktiven Media-IDs.
- Zwei zu demselben Keyword passende Kampagnen müssen `ambiguous` melden.
- Die schreibende Meta-/WA-Schnittstelle darf von keinem dieser Tests erreicht werden.
- Zur Testabnahme müssen Desktop-Screenshots/Bedienung und CI getrennt
  dokumentiert werden. Grüne synthetische Tests ersetzen keinen realen Nutzerlauf.

## Getrennte Pete-Live-Freigabegates (nicht Teil dieses Desktop-Checks)

1. **P0 #168:** Persistente Kaufabsage/Opt-out nach Ablehnung aller Angebote
   muss verlässlich stoppen. Noch offen.
2. **Yoda v4:** Neuer, eigenständiger 20-Fälle-Dialoglauf mit mindestens
   18/20, mindestens 90/100 Punkten und **0 kritischen Fehlern**.
3. **Darth Vader:** Owner testet Pete als kritischer Eltern-Lead.
4. Human Takeover, Doppelantwort-Schutz, 4-Farben-Stil,
   Kampagnen-Routing, Linkwahrheit, Nachfassfenster separat bestätigen.
5. Meta-Review/Provider-Rechte, echtes Instagram-Medienverzeichnis,
   Live-Sends und kostenpflichtige API-Nutzung brauchen eigene Freigabe.
6. Cloudflare Pages **Hauptadresse** bleibt ohne bestätigten Access-Schutz
   und darf keine echten Daten hosten.

## Ergebnisfeld

- Automatisierte Tests: Github Actions CI des betreffenden PR-HEAD notieren.
- Manuelle Browserabnahme: **NICHT DURCHGEFÜHRT**.
- P0/Sicherheit für Pete-Livebetrieb: **NICHT FREIGEGEBEN**.
- Desktop-Ergebnis: **NOCH NICHT ABGENOMMEN**.
