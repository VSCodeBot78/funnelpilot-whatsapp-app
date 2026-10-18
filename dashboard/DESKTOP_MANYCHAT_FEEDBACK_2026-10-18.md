# Desktop Funnel Pilot – Owner-Feedback und ManyChat-Referenz
Stand: 18.10.2026. Grundlage: Owner-Browserprüfung am Laptop und neun geteilte ManyChat-Screenshots, Referenzkampagne „No Bullshit“. **Anforderungen, keine bereits umgesetzten Features.** Bewusst nur Entwurf/Planung; keine Meta-/Calendly-/HubSpot-API-Anfragen und keine Live-Sends.

## Produktentscheidung

Desktop-Dashboard zuerst abschließen, danach dieselbe Bedienlogik nach Mobile übertragen. Bestehende Dashboard-Funktionen und gespeicherte Mama-Papa-/Dummy-Kampagnen beibehalten. Kein optisches Komplett-Redesign; nachvollziehbare Infobuttons dort, wo Erläuterungen fehlen. Viele initiale Einstellungen gehören in das Onboarding; nach Einrichtung soll der Alltag primär Inbox/Kampagnen/Leadstatus/Buchungen sein. „Nutzer kann es ohne Code bedienen“ bleibt Pflicht.

## Referenz: ManyChat Kommentar-Trigger und Nachrichtenablauf

Die Screenshots zeigen:
- Trigger-Liste als einzelne Karten (aktiv/inaktiv), Kanal Instagram, Kommentar oder DM, pro Trigger leicht verständlicher Name und Status, bei vorhandenen Live-Daten Kennzahlen.
- Auslöser „bestimmtes Post/Reel“, „beliebiges Post/Reel“ oder „nächstes Post/Reel“; nur eine solche Auswahl je Trigger. Die Option „nächstes“ erfordert später sauber geklärte Einmalbindung an den nächsten **nach Aktivierung** veröffentlichten Medieninhalt; ohne bestätigte Meta-Eventquelle **nicht aktivieren**.
- Keyword-Bedingung: definierte Wörter/Wortlisten (Komma-Trennung) vs. beliebiger Kommentar. Letzteres standardmäßig AUS, um ungewollte Antworten/Spam zu verhindern.
- Optionale öffentliche Antwort auf Kommentar mit mehreren vorbereiteten Textvarianten und Ein/Aus-Schalter. Variantenauswahl muss deterministisch/prüfbar festgelegt werden (nicht aus Screenshot inferieren); Schutz gegen Doppelantworten.
- Optionale **Eröffnungs-DM**, eigener Text, mit Button und nächstem Schritt; Regeln für Kontakt-/DM-Erlaubnis und Meta-Fenster separat verifizieren.
- Optionale weitere DM mit Link und Text; Link-Titel plus echte HTTPS-Zieladresse, bei ungültiger URL keine Sendefreigabe. Screenshot zeigt außerdem optionales E-Mail-Feld und optionalen Follow-Request; **nicht ungeprüft als verpflichtende Standardaktion** übernehmen.
- Visueller Flow: Nachrichten-Karten, Button-Verzweigung, mögliche Smart Delay (Screenshot 23 Stunden), anschließende Nachrichten. Der Standard-Flow bleibt schlank: Trigger -> öffentliche Antwort (optional) -> Opening-DM/Button -> Link/Antwort (optional) -> Pete (optional). Komplexe starre A/B/C-Frageketten vermeiden.
- Jeder Schritt eigenständig editierbar, per Toggle aktivierbar, jederzeit als Chat-Draft und als Flow-Übersicht testbar. Die App soll klar **Entwurf / bereit zur Abnahme / live** unterscheiden. „Flow aktiviert“ darf in PR #184 ausdrücklich nicht mit echtem Senden gleichgesetzt werden.
- Öffentliche Kommentare, DMs und Follow-ups dürfen nur nach bestätigter Meta-Berechtigung/Policy, Opt-out, Human Takeover, Echo- und Double-send-Guards sowie expliziter Live-Freigabe ausgeführt werden.
- Screenshots enthalten tatsächlich live markierte ManyChat-Automation. **Diese nicht verändern** und parallele Antwortsysteme vor Livegang ausschließen.

## Desktop-Bestand: geprüft vs. noch offen

| Bereich | Codebestand am 18.10.2026 | Fehlend / Qualitätskriterium |
|---|---|---|
| Kampagnen | PR #184 hat Vorlagen, Quelle/Keyword, Alle-vs-Ausgewählte Reels, linearen Draft, Vorschau, Suchfunktion, Sicherungen | Next-Reel-Trigger, echter Instagram-Post-Picker, mehrere öffentliche Kommentartexte, unterschiedliche DM-Blöcke mit Buttons/Aktionsübergängen, Smart Delay/Verzweigungen und tatsächliches Meta-Provider-Routing sind NICHT fertig |
| Onboarding | `SetupWizardModal.jsx` enthält Setup-Seiten, Anbieterstatus inkl. Calendly/HubSpot; Anbieterautorisierung != Synchronisierung | Wichtig für Owner: Automatisch öffnen nur bei tatsächlich noch nicht abgeschlossener Einrichtung; erneuter Start jederzeit im Menü. Bei Offline-Backend keine erfolgreiche Verbindung behaupten |
| Inbox | Bestehender Human-Takeover- und Inbox-Bereich | In Verbindung mit neuem Trigger-Flow nicht doppelt senden |
| Leads/CRM | Lokale Leadansicht vorhanden, HubSpot als möglicher OAuth-Provider vorbereitet | CRM-Richtung als späterer Sync/Single Source of Truth definieren; **kein** „null Server-Speicher“ versprechen: minimale Zuordnung, Owner/Human Takeover, Opt-out, Conversation Context, Event-IDs für Dedupe erforderlich; Datensparsamkeit/Löschfristen |
| Termine | `AppointmentsView.jsx` zeigt schon gebuchte, stornierte und historische Termine; `calendly-availability.service.ts`, `calendly-webhook.service.ts`, `availability-source.service.ts` vorhanden | Kalender als Buchungs-Source of Truth vorziehen; keine parallele manuelle Slotpflege als Standard. Pete darf nur **verifizierte aktuelle Verfügbarkeit** vorschlagen; bei Calendly-/OAuth-Fehler keine veralteten Dashboard-Fallback-Slots als Live-Information ausgeben. Gebuchte Termine/Status im Dashboard |
| Nachfassen | Ghosting/Provider-Follow-up-Einstellungen existieren | Meta-Nachrichtenfenster, opt-in, opt-out P0 #168 und Takeover je Provider konkret regeln; keine pauschale 23h-Verzögerung als Compliance-Nachweis |
| Hilfetexte | Rechtliches, Booking und diverse Einstellungen haben FieldLabelWithInfo | Auch Kampagnen-Auslöser, Keyword-Matching, Reel-Modi, öffentliche Kommentarantwort, Button-DM, Delay, Pete-Handoff klar erläutern; nicht alle alten Infobuttons entfernen |
| Brand/Legal | `SettingsGeneralPanel.jsx` hat derzeit **editierbaren** Footer-Text, `SettingsLegalPanel.jsx` Privacy/Imprint-URLs | Zentrale Produkt-Copyright-/Footer-Vorgabe **serverseitig nur Owner/Admin** ändern lassen; nicht bloß HTML-Feld verstecken. Coach-eigene Rechtstexte weiterhin getrennt editierbar |
| Coach SaaS | Produktname, Pete-Name/Ton/Stil/Sprache und Setup-Skizze vorhanden | Coach-Isolation und Rechte erst mit Backend-Auth/RBAC; keine SaaS-Fertigmeldung vor durchgängigem Isolationstest |

## Fünf geplante Arbeitsblöcke (maximal fünf)

1. **Desktop Flow UX**: Triggerkarten + drei Reel-Scopes, Keywords/beliebiger Kommentar, Kommentarantwortvarianten, getrennte Opening-DM/Button/Link-Blöcke, editierbares lineares Flow-Canvas, Infobuttons. Zunächst keine Provider-Ausführung.
2. **Preview und Sicherung**: read-only Flow-Draft einschließlich Button- und Delay-Verbindungen, Speichern/Neuladen, Konfliktbehandlung, ungültige URLs, nicht verfügbare Reel-ID, Undo/Abbruch/fehlgeschlagener Backend-Create; Eigentümer-Abnahme am Laptop. 20-Fälle-Protokoll entsprechend erweitern.
3. **Calendly / Terminansicht**: Live-Quelle und gebuchte Termine; erst echte Slotquelle positiv verifizieren, niemals statisches Fallback als tatsächliche Live-Verfügbarkeit darstellen. Verbindung und Booking-Synchronisation im Onboarding auseinanderhalten.
4. **SaaS-Regeln und CRM-Schnittstelle**: getrennte Coach-Settings, minimaler lokaler Leadkontext + HubSpot-Sync-Konzept; Footerschutz owner-only am Backend, Datenschutz/Impressum tenant-spezifisch.
5. **Pre-Live-Policy & Endabnahme**: Meta-Automationsfenster, Echo-/Doppelsend-Schutz, P0 #168 Opt-out, Human Takeover, 20 dialogbasierte Yoda-v4-Tests mit >=18/20 & >=90/100 & 0 kritischen Fehlern, danach Darth-Vader-Owner-Test und separate Live-Send-Freigabe.

## Aktuell nicht freigegeben

- Meta/Instagram/WhatsApp-Send oder Änderung bestehender ManyChat-Kampagnen
- automatische Calendly-Terminbuchungen, Sync-Durchläufe oder Live-Kalender-Aussagen ohne verifizierte Daten
- GitHub-Merge, Railway/Cloudflare-Deploy, Kosten/Abos/API-Aufladungen
- öffentliche Demo mit echten Lead- oder Kundendaten
- Änderungen an bestehenden Mama-Papa-/Dummy-Kampagnen
