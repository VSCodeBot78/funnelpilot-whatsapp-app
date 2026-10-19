# Funnel Pilot – X-Wing-Gesamtabnahme (Owner-Test)

**Stand:** 18.10.2026 | **Status:** TESTPLAN, noch nicht durchgeführt und nicht bestanden.  
**Zweck:** Nicht nur Pete-Dialogqualität prüfen, sondern das gesamte Funnel-Pilot-Produkt als Coach vom ersten Start bis zum sicheren Betrieb. Owner testet als echter neuer Coach ohne Entwicklerwissen. Pete/Darth-Vader wird separat bestanden, bevor die produktnahe X-Wing-Abnahme final erfolgen darf.

## Vier Prüfstufen (kein unkontrollierter Livegang)

1. **Offline / lokale Testumgebung:** isolierter, frischer Coach-/Onboarding-Testzustand, Demo-Leads und simulierte Provider-Antworten; kein Kontakt zu Meta, WhatsApp, Calendly, echten Leads oder kostenpflichtiger KI. Vorher Datenisolation/Backup; niemals bestehende Coach-Daten löschen, nur weil man das Onboarding neu erleben will.
2. **Integrations-Vorbereitung:** echte Meta-App-Berechtigungen und Sign-up-UX prüfen, Verbindung/Kontostatus nur per ausdrücklich autorisiertem Login, niemals Tokens im Chat/Screenshot; Meta-App-Review, Permissions und Webhooks als eigene Gates. Ebenso Calendly OAuth/Zugang und HubSpot optional. „verbunden“ ist nicht „synchronisiert“ oder „zum Senden freigegeben“.
3. **Isolierter E2E-Provider-Test:** erst nach dokumentierter Freigabe mit kontrollierten eigenen Testaccounts/-kontakten, speziellen Testkampagnen, echten API-Rechten und überprüften Outbound Guards. ManyChat-Koexistenz und doppelte Antworten müssen ausgeschlossen sein; keine automatischen Live-Nachrichten an echte Leads. Kosten gesondert genehmigen.
4. **Live-Freigabe:** nur nach allen Gates, Owner-Darth-Vader und X-Wing; kein PR-Merge/Deploy/Senden/Abonnement durch diesen Plan.

## X-Wing-Testmatrix: 20 manuelle Owner-Fälle

Kennzeichnung: **OFFEN**, nicht automatisch grün durch erfolgreiche Unit-Tests.

| Nr. | Prüfpunkt und konkreter Soll-Zustand | Stufe | Ergebnis |
|---:|---|---|---|
| 01 | Erststart als neuer Coach: Onboarding startet sinnvoll automatisch; bestehender Coach wird nicht bei jedem Start genervt | Offline | OFFEN |
| 02 | Onboarding Schritt für Schritt ohne Hilfsvideo/Entwicklersprache verständlich; Fortschritt zurück/vorwärts, keine Datenverluste | Offline | OFFEN |
| 03 | Profil/Zielgruppe/Angebot/Preise/Branding/Links eintragen, speichern, Browser neu öffnen, Werte bleiben | Offline | OFFEN |
| 04 | Onboarding jederzeit über „Einrichtung“ erneut öffnen; bestehende produktive Daten unangetastet | Offline | OFFEN |
| 05 | Meta Instagram/WhatsApp Verbindung zeigt ehrliche Zustände: nicht verbunden, Autorisierung, Review, Berechtigung, Webhook, Sendesperre | Offline→Auth | OFFEN |
| 06 | Meta Sign-up-Fehler/Abbruch/Ablaufdatum: verständliche Lösung ohne Entwicklerhandbuch, kein falsches „erfolgreich“ | Auth | OFFEN |
| 07 | Kampagne neu anlegen mit Trigger Instagram DM / Reel-Kommentar / Story / WhatsApp / manueller Follower, Aktivierungszustände klar | Offline | OFFEN |
| 08 | Reel-Filter (bestimmte / alle / nächstes nur wenn tatsächlich implementiert und Meta-seitig testbar), Keyword-Liste vs. beliebiger Kommentar eindeutig | Offline | OFFEN |
| 09 | Öffentliche Kommentarantwort mindestens 3 Varianten, einzeln änderbar; mehrere Erst-DM-Varianten ebenfalls mindestens 3; keine wiederholten identischen Texte als einziges Muster | Offline | OFFEN |
| 10 | Visualisierter Ablauf: Kommentar → Opening-DM → Button → optionale Link-Nachricht → Pete; optionale Wartezeit und Abzweigung klar, fehlende Funktion als „nicht verfügbar“ markieren | Offline | OFFEN |
| 11 | Alle Änderungen speichern, neu laden, bearbeiten, verwerfen; fehlende Pflichtangaben/ungültige HTTPS-Links sauber markiert; kein Datenverlust | Offline | OFFEN |
| 12 | Vorschau im Chatstil mit Info-Hinweisen, aber **keine** echten Sends, KI-Kosten, versteckten Webhooks oder unbeabsichtigte Provider-Effekte | Offline | OFFEN |
| 13 | Inbox: neue Nachricht, Gesprächsverlauf, Status, Filter und Human Takeover/release verständlich; AI bleibt bei Human pausiert | Offline→E2E | OFFEN |
| 14 | Pete versteht Keyword-Kontext, ruft keine unautorisierten Links/Phantasie-Angebote auf, respektiert Opt-out ohne weitere Verkaufspushs (P0 #168) | Offline→E2E | OFFEN |
| 15 | Lead erfassen/zuordnen, nur erforderliche Daten gespeichert; CRM/HubSpot-Status unterscheidet „lokal“ / „verbunden“ / „synchronisiert“ | Offline→Auth | OFFEN |
| 16 | Calendly-Verbindung/Availability: Pete schlägt nur **nachweislich** verfügbare Slots vor; bei Fehler kein lokales Fallback als echte Live-Slots ausgeben | Offline→E2E | OFFEN |
| 17 | Termine: echte gebuchte/stornierte Buchungen korrekt anzeigen, keine zweite widersprüchliche manuelle Slotpflege als Pflicht | Offline→E2E | OFFEN |
| 18 | Nachfassaktionen/„Ghosting“ optional; Meta-Kommunikationsfenster, Opt-out, vorhandener Human Takeover, Booked und Dedupe verhindern unzulässiges Senden | Offline→E2E | OFFEN |
| 19 | Settings: Pete-Name/Tonalität/Sprache coachbezogen; Datenschutz- und Impressum-URL coachbezogen; zentraler Copyright/Footer serverseitig nur Owner/Admin änderbar | Offline→E2E | OFFEN |
| 20 | Vollständiger Demo-Tag: Onboarding → Testkampagne → eigener Kommentar/DM → Inbox/Leadstatus → Pete/Takeover → Calendly-Testbuchung → Terminanzeige; Abbruch/Neustart ohne Datenverlust | Offline→E2E | OFFEN |

## Bewertung: keine Schönfärberei

- Jeder Fall **PASS**, **FAIL**, **BLOCKED** oder **NOT_IMPLEMENTED** mit Screenshot, tatsächlichem Ergebnis, erwartetem Ergebnis, Ursache, Reparatur-Referenz.
- **Gesamt-X-Wing besteht erst mit ≥18/20 PASS und 0 kritischen Fehlern.** 0 offene P0/P1 bei Opt-out, ungewolltem Send, Human Takeover, Datenübergriff, Doppelantworten, Kalender-Falschbehauptungen oder Geheimnisoffenlegung.
- Davon getrennt **Bedienbarkeit mindestens 90/100** anhand 5 Kriterien à 20 Punkte: Orientierung, Verständlichkeit, Aufgabenabschluss ohne Hilfe, Fehlermeldung/Wiederherstellung, Geschwindigkeit/Wenig-Klicks. Fehler und Nachfragen dokumentieren, nicht vorab schöngerechnet bestehen lassen.
- NOT_IMPLEMENTED/BLOCKED gilt **nicht als PASS**. Prüfungen, die reale Anbieterberechtigung voraussetzen, sind bis zur Autorisierung offen. Grüne GitHub-CI beweist nicht die E2E-Abnahme.
- Der spätere SaaS-Gate braucht zusätzliche nachgewiesene Mandantentrennung, serverseitige Berechtigungen, Lösch-/Retention-Konzept, Billing/Support/Datenschutz; X-Wing des Einzelcoach-Dashboards allein reicht dafür nicht.

## Vorbedingungen und Reihenfolge

1. **Pete-Jedi:** Fresh Yoda-v4: ≥18/20 Gespräche, ≥90/100, 0 kritische Fälle; Owner-Darth-Vader geprüft; Opt-out #168 behoben. **Erst danach** automatisches Provider-Senden erwägen.
2. **Desktop-Funktionsumfang** inklusive öffentliche Varianten, DM-Varianten, Tooltip-Hilfe, Flow-Vorschau und Backend-Speichern implementiert und CI grün; lokaler Testordner auf PR-Stand aktualisiert.
3. **Echte Onboarding-Neuerfahrung** in isoliertem Testworkspace ermöglichen, ohne Produktivdaten zu löschen; Backend HTTP 500 aus vorigem Laptop-Test beheben.
4. **Verbindungs- und Berechtigungstest** mit Meta/Calendly nur mit ausdrücklicher Owner-Autorisierung; Login und Zugangsdaten bleiben beim Owner. Vor Integration Metas aktuelle Berechtigungen, messaging window und webhook event requirements erneut prüfen.
5. **X-Wing 20 Fälle** inkl. Fehlversuchen, danach nur mit ausdrücklicher Abnahme Live-Freigabe.

## Go/No-Go

**NO-GO, solange:** P0 #168 offen, Browser-/Backend-Speichern nicht durchgespielt, Meta und Provider-Berechtigungen/Review ungeklärt, irgendein echter Send ohne ausdrückliche Freigabe, oder <18/20 Owner-PASS.  
**GO erst:** nach protokolliertem Owner-Test, reproduzierbaren Nachweisen, geklärten Kosten/Meta-Berechtigungen und separater Livesend-Freigabe.

Keine Änderung an bereits laufenden ManyChat-Kampagnen, keine geheime Aktivierung, kein automatischer Produktiv-Deploy.
