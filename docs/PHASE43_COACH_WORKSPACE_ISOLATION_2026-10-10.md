# Funnel Pilot – Phase 43: getrennte Coach-Workspaces als isolierter Entwicklungsbaustein

**Stand: 10.10.2026. Kein Kunden-Onboarding, keine Kontoerstellung und keine Produktionsfreigabe.**

## Ausgangssituation und Einschränkung

Die aktive Funnel-Pilot-Instanz verwendet weiterhin einen einzigen globalen
`DATA_DIR` mit `settings.json`, `leads.json`,
`conversations.json`, `campaigns.json` und weiteren Datendateien.
Die Phase-37-/38-Coach-Identität ist lediglich ein Entwurf im
**gleichen** aktiven Workspace. Externe Coaches dürfen darüber nicht
angemeldet werden.

## In Phase 43 umgesetzt

`backend/src/data/workspace-isolation-sandbox.ts` ist ein **nicht
angebundenes** Workspace-Speicher-Prototypmodul:

- Separater Namespace je validierter ID `ws_<id>` unter
  `<test-root>/workspaces/<workspace-id>/<resource>.json`.
- Eigene Datenräume für `settings`, `campaigns`, `leads`,
  `conversations`, `message-events`, `booking-events`, `ghosting`
  und rein beschreibende `integration-metadata`.
  **Keine Provider-Schlüssel/Tokens oder Zahlungen in diesem Prototyp.**
- Kein impliziter Zugriff auf Legacy-`DATA_DIR`, keine Default-Coach-
  Freigabe, keine Übernahme von Jochen-Master-Prompt, Leads oder Preisen.
- Zugriffsprüfung anhand der **von einem vertrauenswürdigen Server
  bereitgestellten** Memberships; Owner, Operator und Viewer.
  Cross-Workspace-Membership wird verweigert. Viewer ist read-only;
  Integrationsmetadaten sind Owner-only.
- Grants werden für eine konkrete Workspace-Actor-Paarung ausgegeben,
  gelten nur in der erzeugenden Store-Instanz und können nicht per
  JSON-/Header-Objekt nachgebaut werden.
- Pfade/Ressourcen strikt validiert; vorhandene Symlinks werden
  abgewiesen, JSON wird privat/atomar gespeichert. Beschädigte Dateien
  werfen einen Fehler statt globalen Fallback zu verwenden.

**Wichtig:** Das Modul ist kein SaaS-Login, keine belastbare
Mandantentrennung für die **aktiven** Routen und kein Mehrprozess-/Cloud-
Datenspeicher. Es wird **nicht** von der bestehenden Inbox, Pete, Meta,
Settings, Coach-Onboarding oder HTTP-Routen importiert.

## Automatisierte negative und positive Tests

`backend/src/config/workspace-isolation-phase43.test.ts` simuliert:

1. Zwei fiktive Coach-Workspaces mit identischen Lead-IDs erhalten
   physisch getrennte JSON-Dateien in sieben Ressourcenkategorien.
2. Nachweis, dass bestehendes Legacy-`leads.json` weder gelesen
   noch überschrieben wird.
3. Zugriffe eines anderen Coaches, fingierte Grants, Path Traversal,
   ungültige Ressourcen und fremde Instanz-Grants werden verweigert.
4. Unterschiedliche Owner-/Operator-/Viewer-Rechte sowie
   Owner-only-Integrationsmetadaten.
5. Beschädigte JSON-Datei und doppelter Membership-Eintrag werfen Fehler.
6. Symlink-Workspace-Hop wird abgelehnt (POSIX-Test).

Alle Testdaten sind synthetisch, der Speicher liegt ausschließlich im
temporären Testordner. Keine Meta-, WhatsApp-, Kalender-, HubSpot-
oder OpenAI-Anfragen.

## Vor echten Coach-Konten zwingend noch erforderlich

1. Sichere Anmeldung, Sitzungsverwaltung, CSRF-Schutz, Session-
   Rotation, Logout, Rollen und überprüfter Identitätsnachweis.
   `actorId` darf ausschließlich aus verifizierter Server-Session
   stammen, **niemals** aus `x-workspace-id`, URL oder Formular.
2. Serverseitig verwaltete, widerrufbare Memberships und Prüfung bei
   jeder Datenoperation (inkl. Einladungen und Team-Rollen).
3. Die **gesamten** aktiven CRUD-Routen, KI-Engine, Preis-/Branding-
   Konfiguration, WhatsApp-/Instagram-Webhooks, Ghosting,
   Buchungen, Provider-Tokens und Background-Jobs workspace-spezifisch
   umbauen und echte Isolations-E2E-Tests gegen zwei Accounts fahren.
4. Transaktionaler Datenbank-/Migrationspfad, Backup & Restore,
   Verschlüsselung, Geheimnisse/Provider-Konto-Zuordnung, Audit
   und datenschutzrechtliche Freigabe.
5. Bis dahin kein fremdes Coach-Login anbieten oder ein vermeintliches
   `workspaceId` in der heutigen Single-Workspace-Runtime akzeptieren.

## Freigabestatus

**GO:** interne technische Vorbereitung mit synthetischen Coaches.

**NO-GO:** echte Coach-Konten, Mandantenfreigabe, öffentliche
Admin-Schnittstelle oder getrennte Live-KI-Instanzen.
