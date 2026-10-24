# Dashboard 2.0 – Calendly-/Termin-Integration (Entwurf, 24.10.2026)

## Ziel und Scope
Eine verlässliche Terminansicht für den Besitzer und echte verfügbare Strategiegespräch-Zeiten für Pete. **Nur Plan und Review auf separatem Draft-PR #193. Keine aktive Kalenderanbindung, kein Merge/Deploy, keine Buchung und kein Live-Versand durch dieses Dokument.** PR #191 und das bestehende Desktop-Pete-Labor bleiben unverändert.

## Bereits vorhandene Quellen
- Calendly-Event des Besitzers im verbundenen Account: **Coaching / Strategie Gespräch**, Dauer **45 Minuten**, Zeitzone **Europe/Berlin**, Buchungslink `https://calendly.com/eltern-fitundvital/strategiegespraech`.
- Die verfügbare Regel bei Prüfung am 24.10.2026: Freitag 18:00, 19:00, 20:00 (je 45 Minuten). Dies ist eine **Regel, keine künftige Verfügbarkeits- oder Buchungsgarantie**.
- Im Backend auf PR #191 gibt es bereits `backend/src/services/calendly-availability.service.ts` (Calendly-API mit lokalem `CALENDLY_PAT`) und `backend/src/services/availability-source.service.ts`; `sourceMode="calendar"` liefert nur echte Calendly-Slots und bei API-Fehler/leerem Ergebnis ausdrücklich **keine erfundenen Dashboard-Fallback-Slots**.
- Die in ChatGPT verbundene Calendly-App ist **nicht** automatisch die Authentifizierung der lokalen Funnel-Pilot-Anwendung. Lokale Token-/Berechtigungs- und Provider-Konfiguration vor echter Verwendung separat sicher prüfen.

## Geplante sichere Umsetzung nach Darth-Vader-Test
1. **Eine Termin-Wahrheitsquelle:** Calendly liefert reale Event-Type-Verfügbarkeit. Falls Google Calendar in Calendly als Konfliktkalender verbunden ist, berücksichtigt Calendly diese Belegungen. Nicht zwei konkurrierende Terminrechner im Dashboard etablieren.
2. **Dashboard 2.0 Kalenderkarte, zunächst read-only:** Status `nicht konfiguriert`, `verbunden, Verfügbarkeit nicht bestätigt`, `live geprüft` oder `Störung`; Eventtyp, Länge, Zeitzone, letzte erfolgreiche Abfrage und die nächsten exakt datierten verfügbaren Slots. Keine Uhrzeiten ohne tatsächliche API-Antwort, keine Geheimnisse im UI, keine historischen Termine als aktuell ausgeben.
3. **Pete-Scheduling:** Bei qualifizierter Buchungsabsicht Kalenderquelle serverseitig frisch abfragen (keine frei generierten Termine); Datums-/Zeitzonenbehandlung über `startAt` und explizite Datumsfelder, inklusive Umstellung Sommer-/Winterzeit. Bei API-Ausfall nur den nachweislich gültigen Calendly-Buchungslink anbieten und transparent sagen, dass konkrete Slots nicht geprüft werden konnten.
4. **Buchung bleibt bei Calendly:** Pete darf verfügbare Vorschläge und den Buchungslink senden, aber erst ein bestätigtes Anbieter-Event bzw. verifizierter Buchungseintrag bedeutet `gebucht`. Ein versendeter Link oder eine Zusage im Chat ist **keine Buchungsbestätigung**.
5. **Echte Synchronisierung:** Später nach Genehmigung Bestätigungen, Absagen und Umbuchungen per verifiziertem Webhook abrufen und sicher dem richtigen Lead zuordnen; keine personenbezogenen Kalenderdetails in unberechtigten Kontakten oder Preview-Tests darstellen.
6. **Für SaaS später:** individuelle Coach-OAuth-Berechtigungen, verschlüsselte Token, Mandantentrennung, getrennte Event-Type-Mappings und zuverlässige Fehlermeldungen statt globalem `CALENDLY_PAT`.

## Abnahmekriterien vor einer Freigabe
- Testfall mit vorhandenen Slots (exaktes Datum, Uhrzeit Europe/Berlin, Dauer, bestätigte Quelle); kein falsches Startdatum an der Zeitumstellung 25.10.2026.
- Testfall ohne Slots; Testfall 401/403/Timeout; Testfall nicht verbundener Kalender; Testfall bereits ausgebuchter Slot nach Wiederabfrage.
- Kein statischer Ersatzslot im Kalendermodus; kein `gebucht` ohne Provider-Nachweis; Human-Takeover/STOP und alle No-Send-Flags bleiben erhalten.
- Mobile Ansicht bei 360/768/1440 px, Hell/Dunkel, zugängliche Status- und Zeitbeschriftungen.
- Keine externe Paid-LLM-Abfrage, keine Realbuchung, keine Live-Nachrichten während der Offline-Tests.
- Im Erstschritt keine API-Aktualisierung, keine Kalender-OAuth-Installation, keine veränderten Laptop-Starter; separate Owner-Abnahme nach dem Darth-Vader-Test.

## Verweise
- Bestehende PRs: #191 Pete und #193 Dashboard 2.0
- Calendly öffentliche Dokumentation: `https://developer.calendly.com/docs/api-guides/view-event-type-and-user-calendar-availability-data`; `https://calendly.com/help/how-to-connect-your-google-calendar`.
