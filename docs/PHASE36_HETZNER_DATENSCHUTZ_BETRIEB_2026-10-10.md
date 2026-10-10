# Funnel Pilot – Phase 36 / Priorität 6: Datenschutz, Zugriffsschutz und Hetzner-Betrieb

**Stand 10.10.2026:** Bestandsaufnahme und gezielte Code-Härtung. **Kein** Hetzner-Server installiert oder öffentlich freigegeben. Keine echte Meta-Nachricht, SaaS-Mandantennutzung oder Produktionsanmeldung getestet. Datenschutz-Checkliste ersetzt keine individuelle juristische Beratung.

## 1. Ergebnis der Bestandsaufnahme (vor den Änderungen)

| Bereich | Nachweisbarer Ausgangszustand | Risiko / Maßnahme |
| --- | --- | --- |
| Admin-/Lead-/Chat-API | Express hatte bislang **keine eigene Nutzeranmeldung**; Admin-Schutz war als Reverse-Proxy-Aufgabe kommentiert | Versehentlich öffentlich geroutete Endpunkte könnten Lead- und Gesprächsdaten offenlegen. **Jetzt zusätzliche serverseitige Produktions-Sperre**. |
| Server-Netzwerk | `backend/src/index.ts` band bei `NODE_ENV=production` zuvor an `0.0.0.0` | Potenziell direkt aus Netzwerk erreichbar. **Jetzt immer 127.0.0.1**. Container/Firewall trotzdem separat prüfen. |
| Öffentlich erlaubte Webhooks | Meta-Instagram/WhatsApp prüfen HMAC; Calendly im Produktionsmodus strikte Signatur; OAuth-Rückruf prüft State/Cookie | Nur die notwendigen signierten Callback-Endpunkte öffentlich belassen. End-to-end-Provider-Test und Rate Limiting fehlen. |
| Workspace-Daten | Klartext-JSON im konfigurierten `DATA_DIR`; synchrone Überschreibung von Dateien | **Jetzt private, atomare JSON-Ersetzung** für Gespräche, Leads, Einstellungen, Booking-Events, Message-Events. Keine Verschlüsselung im Ruhezustand, keine DB-Transaktionen, keine Backups. |
| OAuth-Zugangsdaten | `oauth-connections.enc.json` mit AES-256-GCM und separatem Server-Key; kurzlebige OAuth-State-Werte | Schlüsselrotation, Speicher-/Backup-Sicherheit, Widerruf und Recovery noch mit echten Accounts zu prüfen. |
| Dummy-Leads | Das Backend erzeugte bei leerer Leads-Datei Beispielkontakte | In Produktion **keine Demo-Leads mehr neu erzeugen**. Bereits existierende Demo-Datensätze werden bewusst nicht automatisch gelöscht. |
| SaaS-Mandanten | Ein globaler Datenordner und gemeinsame API ohne Login/Rollen/Mandanten-Zuordnung | **Kein SaaS-Betrieb erlaubt**. Spätere Migration zu getrennten Coach-Datensätzen mit serverseitiger Tenant- und Rollenprüfung erforderlich. |
| Chat-/KI-Inhalte | Nachrichten, Kontaktdaten, Metadaten, Gesprächsstatus, bei Verwendung providerbezogene Daten | Rechtsgrundlage, Transparenz über KI/Anbieter, Auftragsverarbeitung, Zweckbindung, Löschfristen, Auskunft/Export und Drittlandtransfers vor produktiver Nutzung klären. |

## 2. Was die neue serverseitige Produktionssperre tatsächlich tut

- `backend/src/index.ts`: Backend hört **immer auf 127.0.0.1**, nie direkt auf allen Netzwerkinterfaces.
- `backend/src/services/production-admin-guard.ts`, im Backend **vor allen Routern** aktiviert: Bei `NODE_ENV=production` sind administrative API-Routen, Chatverläufe, Leadlisten, Einrichtung, Testchat und `/health/readiness` **ohne ein mindestens 32 Byte langes internes Gateway-Geheimnis gesperrt**. Nicht konfiguriert = **503**, falsch/fehlend = **403**. Validierung erfolgt mit konstantzeitlichem Vergleich bei gleicher Länge.
- Von dieser Authentisierung ausgenommen sind nur explizite Provider-Callback-Pfade (Meta GET/POST, signierter Calendly-POST, OAuth-Callback GET) sowie `GET /health`. Die **jeweilige** Payload-/Provider-Signatur muss zusätzlich im zuständigen Handler gültig sein. Ein freier Callback ist **kein** freier Verwaltungszugriff.
- Ein Reverse Proxy muss zuerst einen **echten Administrator** identifizieren und authentisieren und **erst dann selbst** `X-Funnelpilot-Admin-Ingress` mit dem **geheimen Wert** ergänzen. Vom externen Benutzer gesendete Header mit gleichem Namen **immer vollständig verwerfen/überschreiben**. Secret weder in Browser-HTML/JavaScript, Dashboard-`VITE_*`-Variablen, Requestlogs noch Repositorium bereitstellen.
- Die zusätzliche Sperre ersetzt **KEIN** Benutzer-Login, sichere Session-/Cookie-Einrichtung, Zwei-Faktor-Authentisierung, Benutzerrollen, zentrale Geräteverwaltung oder Mandantentrennung. Ein Gateway-Secret ist nur ein **maschineninternes Vertrauenssignal**. Die Lösung darf erst nach echtem Admin-Login und Gateway-Konfiguration für den Betreiber auf Hetzner freigegeben werden.
- CORS ist keine Authentisierung. Ebenso ist eine bloße Basic-Auth vor dem Dashboard ohne Schutz sämtlicher API-Routen keine hinreichende Freigabe. Keine öffentliche Quick-Tunnel-Freigabe für Verwaltungs-APIs.

**Wichtige Kompatibilitätsfolge:** Eine nackte Produktionsinstallation, die noch keine authentisierte Reverse-Proxy-Integration konfiguriert hat, zeigt **keine** Lead-/Admin-Daten und ist absichtlich nicht bedienbar. Diese Sperre **nicht** für eine einfache Installation deaktivieren. Die lokale Entwicklungs-/Abnahmeumgebung aus Phase 32/35 bleibt davon getrennt.

## 3. Speicherung, Schutz und Wiederherstellung

Die App enthält noch einen Single-Process-JSON-Store, keine Datenbank. Unter `DATA_DIR` können (je nach Nutzung) insbesondere `conversations.json`, `leads.json`, `settings.json`, `message-events.json`, `booking-events.json`, Kampagnen, Ghosting-, Termin-/Verfügbarkeitskonfigurationen und `oauth-connections.enc.json` liegen. Exakte Dateinamen und Laufzeitverwendung vor echtem Deploy prüfen.

**Neu in Phase 36:** Gesprächs-, Leads-, Nachrichten-/Buchungsereignis- und Einstellungsdateien werden über eine neue gleichnamige temporäre Datei **auf dem gleichen Datenträger** mit POSIX-Modus 0600 geschrieben und anschließend per Rename ersetzt. Neue Datenverzeichnisse der Utility bekommen Modus 0700. Damit werden viele teilweise geschriebene JSON-Dateien vermieden. **Nicht garantiert:** Keine Mehrprozess-Konsistenz, keine gesicherten fsync-Transaktionen, kein Schutz vor Bitfehlern oder versehentlichem Löschen, keine verschlüsselten Backups. Windows benötigt geeignete NTFS-ACLs; vorhandene Ordnerrechte werden nicht automatisch repariert.

**Unbedingt vor dem Live-Betrieb:** Volumen für `DATA_DIR` außerhalb des Git-Repos, nur Service-User-Zugriff, verschlüsselter Datenträger oder nachgewiesene serverseitige Verschlüsselung, sichere gesonderte Secret-Verwaltung, Datensicherungen regelmäßig und automatisiert auf **getrennten** Speicher, Verschlüsselung, festgelegte Aufbewahrung, Alarm bei fehlgeschlagenem Backup und **mindestens ein erfolgreicher Wiederherstellungstest**. Das OAuth-Verschlüsselungsgeheimnis muss getrennt gesichert werden, sonst sind Token-Backups unbrauchbar.

**Geplanter Recovery-Test (nur Testdaten):** Backend/Pete/Messaging und Jobs anhalten → komplette Datenablage plus verschlüsselte OAuth-Datei konsistent sichern → Kopie auf isolierten Testhost zurückspielen → nur lokales Netz, Live-Sendeschalter AUS → JSON-Validität/Leadzahlen/STOP- und Handover-Metadaten prüfen → erst danach gesonderte Freigabe. Ohne Test- und Rollbacknachweis kein „Backup fertig“.

**Offenes Produktionsrisiko:** Andere JSON-Stores werden noch nicht durch dieselbe Utility geschrieben; einzelne alte Dateien/Ordner können zu offene POSIX-Rechte besitzen. Vor Produktionsfreigabe alle Datendateien durchgehen und restriktive Rechte prüfen. Der derzeitige Store lädt bei Lesefehlern teils Default-/Leerwerte; **bei beschädigten Beständen Betrieb stoppen und aus Sicherung wiederherstellen**, nicht einfach neu beschreiben.

## 4. Minimaler Hetzner-Betriebsentwurf – noch NICHT installieren

1. Separaten Linux-Server oder VM mit unterstützter LTS-Version, automatischen Sicherheitsaktualisierungen und nicht-root Service-User bereitstellen. SSH mit Schlüsseln; Firewall standardmäßig verweigernd, öffentlich zunächst nur notwendige HTTPS- und kontrollierte Admin-Zugänge. Port 3001 nicht öffentlich routen.
2. HTTPS über sauber konfigurierten Reverse Proxy vor Dashboard, Authentisierung und getrennten API-Zugängen; keine direkten Zugriffe auf lokal gebundenen Admin-Server. Streng separate Locations für Provider-Webhooks und OAuth-Callbacks; exakte Callback-URLs und Signaturprüfung, minimale erlaubte HTTP-Methoden.
3. **Serverseitiges** `FUNNELPILOT_ADMIN_INGRESS_SECRET` mit mindestens 32 zufälligen Bytes erzeugen und geschützt am Backend **sowie** als internen Proxy-Wert hinterlegen. Proxy verwirft externe Header, authentisiert den menschlichen Admin vor dem Einspeisen und schützt die gesamte Admin-API inklusive GET, POST, Settings, Leads, Conversations, Debug und Test. Das Secret nicht in Git/Frontend/UI kopieren.
4. `NODE_ENV=production`, `ENABLE_GENERIC_WEBHOOKS=false`, zunächst `INSTAGRAM_SEND_ENABLED=false`, `WHATSAPP_SEND_ENABLED=false`, `INSTAGRAM_ENGINE_ENABLED=false`, `INSTAGRAM_ALLOW_ALL_SENDERS=false`, `INSTAGRAM_AUTO_ENABLE_NEW_LEADS=false`; nur getrennt freigegebene reale Testkonten später aktivieren. Calendly strikt signiert. Nicht auf `localhost`-Dev-CORS verlassen. Admin-CORS nur für genau konfigurierten Dashboard-Origin.
5. Privater, verschlüsselter Datenspeicher und **getestete verschlüsselte Backups**; Monitoring ohne Nachrichten-/Tokeninhalte, Logs mit begrenzter Aufbewahrung, feste Alarme bei 403/401-Spikes, Webhook-Fehlern, Speicherplatzmangel, fehlendem Backup und fehlgeschlagenem Restore.
6. Sicherheitsabnahme mit echten Testkonten: unbekannter Besucher, fremder Coach, abgelaufene Session, alle Admin-Endpunkte inkl. `/health/readiness`, gefälschte Webhook-Signaturen, OAuth-State, doppelte Events, STOP/Human-Handover, echte und nicht zugestellte Nachrichten; Prüfliste mit belegten Ergebnissen. **Keine** Produktivfreigabe ohne diese Abnahme.

## 5. Datenschutz- und SaaS-Vorbedingungen

- Dateninventar und Verarbeitungsverzeichnis: Kategorien (Name, Telefonnummer/Instagram-ID, DM-Text, Angebot/Interesse, Terminstatus, KI-/Webhook-Metadaten), Zweck und Rechtsgrundlage, Empfänger und Speicherdauer pro Kategorie festlegen.
- Datenschutzhinweis für Leads und Coaches, transparenter KI-Einsatz (Pete als KI-Assistent), Auftragsverarbeitungsverträge und Transfers mit Hetzner, Meta, OpenAI sowie späteren Integrationspartnern individuell klären. Nicht behaupten, dies sei automatisch DSGVO-konform.
- Zugriff: klare Rollen (**Betreiber, Coach, optional Team**), technische Isolation pro Workspace, auditierbare Login-/Rollenwechsel, serverseitiges Verbot von Cross-Tenant-Zugriffen; die aktuelle App hat dies **nicht**.
- Löschung/Auskunft/Export: durchgängige Behandlung aller Chat-, Lead-, Log-, Termin-, Backup- und Providerkopien entwerfen und anschließend testen; STOP-Nachrichten bleiben unabhängig von Werbe-Einwilligungen gesperrt.
- Speicherung: minimierte Rohdaten/Logs, Maskierung sensibler Inhalte in Support- und Monitoringdaten, dokumentierte Backup-Aufbewahrung und automatischer Ablauf der geplanten Löschfristen.
- **Kein Coach-Onboarding in gemeinsamen Live-Datenspeicher**, solange Login, Autorisierung, Einzelmandanten-Rechte und Isolationstests fehlen. Priorität 7 kann UI/Schema und synthetische Tests vorbereiten, aber nicht SaaS freigeben.
- Zukünftig für mehrere Coaches vorzugsweise auf eine transaktionale Datenbank mit verpflichtenden `workspace_id`-Beziehungen und serverseitigen Zugriffstests migrieren; Dateispeicherung nicht unbemerkt als Mandantenmodell ausweiten.
- Mobile PWA M-02 erst mit denselben Login-/Mandanten-/Logout-/HTTPS-Anforderungen; Service Worker darf keine privaten Nachrichten eines Coaches dem nächsten Gerätebenutzer zeigen.

## 6. Go/No-Go

**Code-Verbesserungen sind nicht gleich Betriebserlaubnis.** Vor erster produktiver Nutzung fehlen mindestens: echter Hetzner-Server, authentisierter Reverse Proxy und Secret-Injektion, Server-Zugriffstests, Sicherheits-/Rate-Limit-Konzept, DS-GVO-Verträge und Dokumentation, verschlüsselte und erfolgreich wiederhergestellte Backups, Provider-Zulassungen und beobachtete reale Testzustellung. Bis dahin bleibt die bestehende **lokale Testumgebung** mit deaktivierten Sends maßgeblich.

**Nächste Arbeitsphase:** Priorität 7 – coach-fähiges Onboarding in UI/Schema und Tests vorbereiten **ohne** Multi-Tenant-/Live-Versprechen. Native ManyChat-Buttons M-01 und installierbare PWA M-02 bleiben danach separate spätere Arbeiten.
