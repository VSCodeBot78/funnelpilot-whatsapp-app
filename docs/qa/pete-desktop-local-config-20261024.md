# Pete Desktop: lokale Modellkonfiguration (24.10.2026)

## Fehler und Nachweis

Der Besitzer sieht trotz freigegebenem Owner-Testmodus die Sammelmeldung
„GPT-6.1 Sol, lokaler API-Schlüssel oder KI-Testmodus fehlen.“ Die bisherige
Prüfung verlangt gleichzeitig `OPENAI_MODEL=gpt-6.1-sol`,
`PETE_LLM_CONVERSATION_ENABLED=true` und einen nichtleeren lokalen Schlüssel.
Der bestehende, unveränderlich gepinnte AutoStart übernimmt jedoch eine alte
`backend/.env` und setzt die beiden ersten Werte nicht. Ein vorhandener
Schlüssel mit alten oder fehlenden globalen Flags genügt deshalb bisher nicht.

Kostenlos reproduziert: Der neue HTTP-Regressionstest scheitert vor dem Fix
an `providerConfigured=false`, obwohl ein synthetischer Schlüssel vorhanden
ist. Welche der drei Bedingungen auf dem Besitzer-Laptop konkret fehlt,
ist aus seiner bisherigen Sammelmeldung nicht ableitbar. Kein Zugriff auf
seinen Laptop oder seinen echten Schlüssel wird behauptet.

## Gezielte Korrektur

- Der geschützte Desktop-Pfad verwendet den bestehenden KI-AN-Klick mit
  kumulativem Testbudget als lokale Zustimmung. Der zusätzliche globale
  Conversation-Schalter ist dafür nicht erforderlich.
- Nur innerhalb des authentifizierten Desktop-Anfrage-Scope wird das
  bestehende Produktmodell `gpt-6.1-sol` direkt ausgewählt. Globale Umgebungs-
  und Produkt-/QA-Konfigurationen werden weder umgeschrieben noch aktiviert.
- Die lokale Provider-Konfiguration verlangt weiterhin einen nichtleeren
  API-Schlüssel. Wenn dieser fehlt, nennt die Oberfläche genau
  `OPENAI_API_KEY` und die lokale `backend/.env`, statt drei mögliche Ursachen
  zu vermischen. Kein Schlüssel gelangt in Status, Diagnose, Chat oder GitHub.
- AutoStart, Bootstrap und dessen Prüfsumme bleiben unverändert. Die
  Korrektur liegt im aktualisierbaren Anwendungscode und wird nach erfolgreicher
  kostenloser CI vom vorhandenen AutoStart übernommen. Kein Austausch des
  unveränderlichen Launchers nötig.

Unverändert bleiben Origin/Host/Loopback, Cookie/CSRF, Forwarded-Abweisung,
Runtime-Sicherheitsprüfung, serverseitige Testkontakt-Ausstellung,
Anfrage-Scope, Reservierung vor dem Aufruf, Dateilock, Budgetgrenzen,
Verbrauch und ungeklärte Reservierungen, AUS nach Neustart sowie STOP/Human
Takeover. `PETE_LLM_API_CALLS_APPROVED=false`, Meta-/WhatsApp-Sends AUS.
PR #193 bleibt unberührt.

## Tatsächlich bestandene lokale Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| Backend-Build | bestanden |
| Desktop-HTTP-/Budget-Testknoten | 23/23 |
| Übrige Backendtests | 520/520 |
| Starter-/Relay-Verträge | 25/25 |
| Echter Vite-/Session-Proxy | 9/9 |
| Echter Chromium-/React-/Vite-/Express-Browser | 9/9 |
| Frontendtests | 103/103 |
| Dashboard- und Pete-Labor-Build | bestanden |

Neue Backend-Fälle prüfen fehlende globale Flags und alte Mini-/false-Werte,
jeweils bei vorhandenen synthetischen Schlüsseln. Vor KI AN kein Providerpfad;
nach explizitem KI AN der vorhandene, vollständig gemockte Responses-Pfad
mit ausschließlich Sol, synthetisch 100 Input-/20 Output-Token,
0,000400 USD verbucht und 0,249600 USD Rest. Normale Routen erhalten keine
Desktop-Berechtigung. Prozessweite Flags bleiben unverändert. Ohne lokalen
Schlüssel werden weder Budget freigegeben noch Provideranfragen ausgeführt.

Der echte Browser startet nun ausdrücklich mit alten globalen
`gpt-4.1-mini`/`false`-Werten. Er bedient KI AN/AUS erfolgreich, erhält die
neue eindeutige Meldung ohne Schlüssel und prüft unveränderte globale Flags.
Alle externen Backend-/Browser-Requests sind gesperrt; null externe Aufrufe,
null Nachrichtenrequests, nur zwei bewusst angeklickte Budgetrequests.
Keine echte Modellantwort, Schlüsselgültigkeit oder Qualitätsabnahme aus
Offline-Mocks ableiten. Keine zusätzlichen API-Kosten.

Die endgültigen GitHub-Linux-/Windows-Ergebnisse auf dem veröffentlichten
Commit werden nach Abschluss in PR #191 und PETE_MASTER_STATE dokumentiert.
Die Ausführung auf dem Besitzer-Laptop bleibt separat zu bestätigen.

## Nächste Besitzer-Aktion

Nach erfolgreicher CI alte Backend-/Dashboard-Fenster schließen, den
vorhandenen AutoStart neu starten und im Chat-Test Budget wählen / KI AN
klicken. Fehlt tatsächlich der lokale Schlüssel, kann Code ihn nicht
ersetzen. Er bleibt ausschließlich lokal einzurichten, ohne Upload oder
Weitergabe im Chat. Keine erneute Kostenbelegpflicht.
