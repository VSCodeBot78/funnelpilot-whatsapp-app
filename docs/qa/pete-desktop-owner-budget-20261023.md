# Lokales Pete-Labor: KI-Schalter und persistentes Testbudget

**Aktualisierung 24.10.2026:** Der Besitzer prüft seine historischen Kosten selbst
in OpenAI. Der aktuelle [Owner-Testmodus](pete-desktop-owner-managed-costs-20261024.md)
ermöglicht AN durch ausdrückliche Budgetbestätigung ohne Rechnungsupload.
Verbrauch, Reservierungen, feste Grenzen und Sicherheitsprüfungen bleiben
erhalten; Historie wird dabei nicht als geprüft ausgegeben. Die folgenden
Abschnitte dokumentieren den früheren, weiterhin unterstützten strengen
Belegabgleich und dessen ursprüngliche Einführung.

Umsetzung auf dem bestehenden PR #191. Kein Merge, Deployment, Live-Send oder
kostenpflichtiger Modelltest durch diese Änderung.

## Verhalten

Das vorhandene Desktop-Pete-Labor zeigt einen ausdrücklichen Schalter
`KI AN (kostenpflichtig)` / `KI AUS`, die Grenzen 0,25 / 0,50 / 1 / 2 USD,
bestätigten Verbrauch, offene Reservierungen und das noch nutzbare Budget.
Die Grenze gilt kumulativ seit der ersten Freigabe in diesem Datenverzeichnis.
Neuer Kontakt, neue Browser-Sitzung und AUS/AN setzen nichts zurück. Ein
Backend-Neustart verlangt erneut den bewussten AN-Klick; Verbrauch und Limit
bleiben gespeichert. Ein später höher gewähltes Limit ist eine ausdrückliche
Erhöhung des kumulativen Limits, kein neues zusätzliches Budget.

Nur der lokale Betreiber kann eine abgesicherte Desktop-Sitzung eröffnen:
verifizierter Laptop-Safe-Mode, Loopback-Verbindung, feste lokale Browser-Origin,
geprüfter Host, keine Forwarded-Header, HttpOnly/SameSite-Strict-Cookie sowie
separates CSRF-Token. Kontakt-IDs werden vom Server zufällig ausgestellt und
an diese Sitzung sowie die feste Kampagne gebunden. Ein ID-Präfix oder ein
vom Browser behaupteter Owner-Status genügt nicht. Das ist eine lokale
Betreibergrenze, keine neue SaaS-Anmeldung oder Remote-Admin-Schnittstelle.

Der bezahlte Kontext besteht nur innerhalb der jeweiligen Desktop-Anfrage
(AsyncLocalStorage), wird vor jeder Reservierung erneut geprüft und kann
weder durch gespeicherte Lead-Felder noch normale Webhooks übernommen werden.
`PETE_LLM_API_CALLS_APPROVED` bleibt global **false**. Instagram-/WhatsApp-
Engine und Sends bleiben deaktiviert. Der AutoStart und seine Pins wurden
nicht geändert; ein Push installiert nichts auf dem Besitzer-Laptop.

Alle Reservierungen und Abrechnungen liegen weiterhin ausschließlich in
`DATA_DIR/pete-api-budget.json`, unter dessen vorhandener exklusiver
Dateisperre und atomarem Dateiaustausch. Es gibt keinen zweiten laufenden
Budget-Ledger. Vor dem Provider-Aufruf wird der konservative Maximalbetrag
gegen das verbleibende lokale UND projektweite Budget reserviert. Unbekannte
Usage, Fehler oder Prozessabbruch erstatten diese Reservierung nicht. Ein
verwaister Lock oder beschädigter Ledger wird nicht automatisch gelöscht.
Gemeldete Usage oberhalb der Reservierung blockiert das Budget und zählt
mindestens den gemeldeten Betrag weiter.

Nur `replySource=llm` zusammen mit verbuchter Provider-Usage gilt im Desktop
als Modellantwort. Die Anzeige nennt Modell und Tokenzahlen. Regelantworten,
geskriptete Kampagneneinstiege und Handoffs werden separat beschriftet. Tests
in dieser Änderung benutzen ausschließlich gemockte Provider, keine echte KI.

## Tatsächlich geprüfte bisherige Kosten

Quelle: bestehender Repo-Zweig `pete-phase3-budget-ledger`, Commit
`5822b3d7e35ac74b62ff0eaba221755cb46bdf30`, Datei
`phase3-budget-ledger.json`, Blob `0f15a243416eeab53f527d2f88d4d280f0fe1f07`.

| Bestehender Rahmen | Historisch verbucht | Offen reserviert |
| --- | ---: | ---: |
| Alter 8-USD-Projektrahmen | 7,817830 USD | 0 USD |
| Konservativer 5-USD-Zusatzrahmen | 3,340942 USD | 0 USD |
| Zusammen | 11,158772 USD | 0 USD |

Die sieben Zusatzbuchungen summieren sich auf 3.340.942 Mikro-USD. Letzte
Charge: Run `39924119190`, 1,035994 USD. Diese Buchungswerte sind keine
OpenAI-Rechnung und kein Kontoguthaben; ältere Buchungen enthalten auch
konservative Belastungen bei ungeklärter Nutzung. Die bestehende konservative
Projektobergrenze bleibt 8 + 5 = 13 USD. Daraus entsteht keine neue
automatische Kostenfreigabe.

**Weiterhin nicht belegt:** sämtliche Ausgaben der früheren lokalen
Laptop-Installation, deren Zuordnung zum neuen AutoStart-Datenpfad und der
vollständige Abgleich mit Provider-Belegen. Deshalb liefert die ausgelieferte
Version `historical_spend_unverified`, keinen bestätigten Projektrest und
keine bezahlte Freigabe. Es wird keine fiktive vollständige Historie erzeugt.

## Grenze des historischen Abgleichs

Eine vollständige Prüfung kann später ausschließlich durch einen lokal
geprüften Beleg `DATA_DIR/pete-desktop-history-review.json` nachgewiesen
werden. Dafür existiert bewusst kein Browser-Upload und kein HTTP-Feld
`historyVerified=true`. Die Datei ist ein unveränderlicher Prüfbeleg, kein
zweiter Verbrauchszähler. Es wird kein gültiger Prüfbeleg mitgeliefert.

Der lokale Prüfer muss vor dem ersten AN alle alten lokalen Ledger und die
Provider-Abrechnung prüfen und folgende Felder belegen:

| Feld | Anforderung |
| --- | --- |
| `version`, `kind` | `1`, `owner-reviewed-desktop-history` |
| `knownCloudLedgerCommit`, `knownCloudLedgerBlob` | Exakte oben belegte Snapshot-IDs |
| `priorMicroUsd` | Geprüfter historischer Projektbetrag in ganzen Mikro-USD, mindestens Snapshot plus alte lokale Belastungen |
| `unresolvedSources`, `ownerReviewedComplete` | `0`, `true`, erst nach tatsächlicher vollständiger Prüfung |
| `reviewedAt` | Tatsächlicher Prüfzeitpunkt als ISO-Datum, nicht in der Zukunft |
| `dataDir` | Tatsächlicher kanonischer lokaler Ziel-Datenpfad |
| `initialTargetLedgerSha256` | Hash des bereits vorhandenen Ziel-Ledgers, oder `absent`, falls wirklich keiner existiert |
| `localLedgers` | Nichtleere Liste alter lokaler Originaldateien mit absolutem Pfad und SHA-256 |
| `providerStatement` | Tatsächlich geprüfter Provider-Beleg mit absolutem Pfad und SHA-256 |

Hashes und Schema prüfen die unveränderte Zuordnung, nicht die finanzielle
Vollständigkeit eines Belegs. Diese ist eine bewusste lokale Betreiberprüfung.
Alte lokale Reservierungen bleiben konservativ enthalten. Unbelegte
Überlappungen zwischen lokalen und Cloud-Buchungen werden nicht abgezogen.
Andere schreibende API-Testprozesse müssen vor diesem Snapshot gestoppt und
berücksichtigt sein; dies ist kein kontoweiter verteilter Billing-Dienst.

Bei erster Freigabe werden Hash und historischer Betrag im bestehenden
Budget-Ledger versiegelt. Fehlende/veränderte Belege, falscher Zielpfad,
zu geringer Betrag oder eine nachträglich geänderte Review-Datei sperren
erneut. Neue kostenpflichtige Cloud-QA erfordert weiterhin eigene Freigabe
und einen erneut vollständigen Kostenabgleich; dieses Feature erteilt sie nicht.

## Kostenlose Verifikation

`npm run build` und `npm test` im Backend; `npm run build` im Dashboard.
`npm run test:desktop` prüft echte lokale HTTP-Routen mit vollständig
gemockten Provider-Antworten und deutlich als synthetisch markierten
Billing-Fixtures. Einschließlich falscher Origin/Host/CSRF/Sitzung, erfundener
Kontakte/Kampagnen, Budgetmanipulation, Parallelreservierungen, echtem
Prozessneustart, unbekannter Usage, OFF während eines laufenden Aufrufs,
Historienänderung, Projektobergrenze, korruptem Ledger, Lock, STOP,
Human Takeover, geskriptetem Einstieg und Drift der Safe-Mode-Flags.

Der bestehende Windows-AutoStart-Workflow erhält einen zusätzlichen
Windows-Backend-Job für dieselben Desktop-Prüfungen. Er besitzt keine Secrets
und keine Schreibrechte. Die unveränderten PowerShell-/CMD-Tests bleiben
erhalten. In den isolierten Tests wird ausdrücklich eine synthetische lokale
Entwicklungsumgebung simuliert; sämtliche externen Requests werden abgefangen.
Die kostenpflichtigen Workflow-Trigger bleiben unverändert gesperrt.
