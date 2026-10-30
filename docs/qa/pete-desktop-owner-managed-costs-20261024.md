# Pete aktivieren mit lokalem Testbudget

## Aktuelle Owner-Anweisung

Der Besitzer verwaltet seine bisherigen Kosten selbst in OpenAI und möchte
Pete im bestehenden Desktop-Labor einschalten können. Diese Anweisung vom
24.10.2026 ersetzt die frühere Pflicht, vor jedem ersten lokalen KI-Test eine
vollständige historische Kostenabstimmung nachzuweisen. Sie erlaubt keinen
kostenpflichtigen Entwickler-/CI-Test, keinen Live-Versand, Merge oder Deploy.

## Tatsächliches Verhalten

- Der echte Schalter bleibt zunächst AUS. Der Status lädt automatisch.
- Mit `KI AN (kostenpflichtig)` bestätigt der lokal authentifizierte Besitzer
  0,25 / 0,50 / 1 / 2 USD als kumulative Grenze des vorhandenen Testzählers.
  Kein zusätzlicher Rechnungsupload und kein weiterer Bestätigungsdialog.
- Der Client sendet dabei ausdrücklich `ownerManagedCosts: true`. Die Route
  akzeptiert nur das exakte Boolean `true` bei AN, gültige feste Beträge und
  die unveränderte lokale Sitzung/CSRF-/Runtime-Grenze.
- Die Bestätigung wird als `ownerManagedCostsAcknowledgedAt` im bestehenden
  `DATA_DIR/pete-api-budget.json` gespeichert. Keine zweite Datenbank und keine
  erfundene historische Review-Datei. Die neue Zustimmung setzt weder vorhandene
  Kosten noch offene Reservierungen zurück.
- Historie bleibt `historyVerified: false`; vollständiger historischer Betrag
  und vollständiger Projektrest bleiben `null`. Die Oberfläche behauptet keinen
  bestätigten Projektrest. Die bekannten 11,158772 USD bleiben sichtbar.
- Zusätzlich zum gewählten lokalen Limit bleibt die technische Grenze von
  13 USD gegen den unveränderten bekannten Buchungsboden und sämtliche aktuellen
  Ledger-Verpflichtungen bestehen. Deshalb kann die verfügbare Freigabe kleiner
  als der gewählte Betrag sein. Dies ist kein vollständiger Kontoabgleich.
- Eine vorhandene gültige historische Review wird mit ihrem vollständigen
  historischen Betrag weiterverwendet. Eine bereits versiegelte Review wird
  weiterhin vollständig
  geprüft; die neue Zustimmung kann veränderte versiegelte Belege nicht ersetzen.

`getPeteDesktopBudgetStatus`, Aktivierung und Reservierung verwenden dieselbe
Kostenbasis. Vor jedem Provider-Aufruf greifen dieselbe exklusive Dateisperre,
Maximalreservierung und kumulative Grenze. Unbekannte Nutzung bleibt reserviert.
Überhöhte gemeldete Nutzung stoppt die Abrechnung weiter. Nach Backend-Neustart
ist KI AUS; Budget, Bestätigung und Verbrauch bleiben erhalten.

## Unveränderte Sicherheitsgrenzen

Loopback, Host/Origin, Forwarded-Abweisung, Desktop-Kennzeichen, HttpOnly-/SameSite-
Cookie, CSRF, JSON, Runtime, serverseitige Testkontakte und Anfrage-Scope bleiben
unverändert. Globales `PETE_LLM_API_CALLS_APPROVED` und Meta-/WhatsApp-Versand
bleiben AUS. STOP und Human Takeover bleiben wirksam. Fehlender Provider blockiert
AN weiterhin. Beschädigter Ledger, Lock, Abrechnungsfehler oder ausgeschöpftes
Budget lassen sich durch die Owner-Zustimmung nicht aufheben. PR #193 unberührt.

## Kostenlose lokale Nachweise

| Prüfung | Ergebnis |
| --- | --- |
| Desktop-Scope-/Budgettests mit gemocktem Provider | 21/21 |
| Echter Chromium-/React-/Vite-/Express-Test | 9/9 |
| Echter Vite-Proxy-Test | 9/9 |
| Übrige Backendtests | 520/520 |
| Starter-/Relay-Verträge | 25/25 |
| Budgetskripte | 10/10 |
| Dashboard-Tests | 103/103 |
| Backend-, Dashboard- und Pete-Labor-Build | bestanden |

Browser: Ohne Review ist AN bedienbar. Echter AN-Klick speichert 0,25 USD und
die Zustimmung, echter AUS-Klick erhält den Betrag. Beide Klicks erzeugen
keinen Provider-Aufruf. Fehlender API-Schlüssel deaktiviert den Schalter.
Temporäre synthetische Daten, Fake-Key, alle externen Fetches gesperrt.

Backend: Ohne Zustimmung bleibt der bisherige Pfad gesperrt. Mit Zustimmung
erreicht die Anwendung den tatsächlich vorhandenen Modellpfad mit vollständig
gemockter Responses-Antwort, kennzeichnet `replySource=llm` und verbucht die
synthetischen Usage-Werte. Der Test bestätigt 0,0004 USD und 0,2496 USD Rest,
ohne einen echten Provider-Aufruf. Bestehende Bestände/Reservierungen, echte
Prozessneustarts, parallele Reservierungen, Budgetgrenze und Abrechnungsfehler
geprüft. Vorherige strenge Review-/Integritätsprüfungen bleiben bestanden.

Die bestehenden Linux-/Windows-CI-Jobs führen diese Prüfungen ebenfalls aus.
Der erste Linux-Lauf blieb über mehrere Minuten beim Installationsschritt
`install --with-deps chromium` stehen; ein direkter Abbruch ist über die
vorhandene Verbindung nicht verfügbar. Der Backend-CI-Job verwendet deshalb
Ubuntu 24.04 mit dem dort bereits vorinstallierten Chrome statt einer erneuten
OS-/Browserinstallation, mit festem Job-Timeout von zehn Minuten. Dieselben
Browser-/Sicherheitsprüfungen bleiben vollständig verpflichtend. Die Windows-CI
verwendet weiter den gepinnten Playwright-Chromium. Runner-Quelle:
https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md .
Ihre tatsächlichen Ergebnisse auf dem veröffentlichten HEAD werden nach
Abschluss in PR #191 und PETE_MASTER_STATE dokumentiert. Keine echte Sol-
Dialogbewertung oder erfolgreiche Besitzer-Installation wird daraus abgeleitet.

## Besitzer-Schritt

Nach erfolgreicher CI den vorhandenen AutoStart mit geschlossenen alten
Serverfenstern neu starten. Im Chat-Test Budget auswählen, `KI AN` klicken
und frei schreiben. Keine erneute Anforderung des bereits geprüften Exports
oder alter Budgetdateien als Voraussetzung für diesen Owner-Testmodus.
