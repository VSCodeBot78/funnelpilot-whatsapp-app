# Yoda: letzte echte Sol-QA vor privatem Darth-Vader-Test | 23.10.2026

## Beleg, nicht Vermutung

- **Echter GPT-6.1-Sol-Synthetiklauf:** [Actions #39924119190](https://github.com/VSCodeBot78/funnelpilot-whatsapp-app/actions/runs/39924119190), Test-SHA `f98f69c41f969c4284b4aaebfb1117bfb178c837`.
- **64 Gesprächs-Turns in 32 Zwei-Turn-Fällen:** 20 bestehende v4.3-Fälle + 12 *neue*, zuvor nicht in einem echten Lauf benutzte Blindfälle. 57 genuine Modellantworten, 7 deterministische Prüfantworten, alle 32 Fälle ausgeführt, kein Abbruch.
- **Originaldialoge:** Actions-Artefakt `pete-repeatable-sol-evidence-39924119190`, Artifact-ID `12488134351`; keine realen DMs.
- **Kosten:** Owner-Charge `owner:2026-10-23-vader-final-150usd-sales32`, maximal 1,50 USD; verbucht 1,035994 USD und Restreservierung 0 im gemeinsamen `pete-phase3-budget-ledger`; keine stillschweigende Freigabe für Wiederholung.
- **Fachwertungen:** manuelle Yoda-Prüfung nach [Founder-Rubrik v4.3](./pete-v43-setter-closer-founder-kriterien-20261022.md); **nicht** automatisch von CI vergeben, keine unabhängige externe Auditnote.

## 20 bekannte Standardfälle: 19/20 fachlich akzeptiert

| ID | Yoda-Urteil | Warum |
| --- | --- | --- |
| Y-entry | OK | Zielgruppe und beide Einstiegsarten richtig erklärt |
| Y-no-time | OK | Keine tägliche Sportpflicht, alltagstauglicher Wiedereinstieg |
| Y-food | OK | Realer Engpass Stressessen statt unnötiger weiterer Trainingsplan |
| Y-exhaustion | OK | Erschöpfung ernstgenommen, keine Pflichtprogramme |
| Y-shift | **Nicht OK** | Antwort nach der Grenzsetzung spiegelt die ausfallende Pause nur erneut; kein hilfreicher nächster Setter-Schritt |
| Y-trust | OK | Konkrete Leistungen und keine Ergebnisgarantie |
| Y-price | OK | Budgetgrenze respektiert |
| Y-value | OK | Konkreter Betreuungsmehrwert statt Behauptung garantierter Resultate |
| Y-partner | OK | Partnerentscheidung nicht umgangen |
| Y-partner-autonomy | OK | Keine Buchung gegen gemeinsame Entscheidung |
| Y-consider | OK | Leistungsumfang beantwortet und passendes Zielbild erkundet |
| Y-buy | OK | Verifizierter Selbststarter-Link im ersten Turn vorhanden; weitere Linkreferenz daher laut Owner-Rubrik kein P0-Ausfall |
| Y-coaching | OK | Persönliche Startphase und freiwilliger Gesprächsweg, kein Pflichtcall |
| Y-objection | OK | Start-Stopp ohne überzogene Versprechen erklärt |
| Y-short | OK | Kurze sinnvolle Fragen bei fast fehlendem Kontext |
| Y-not-fit | OK | Nicht geeigneten Wettkampf-Lead ehrlich abgegrenzt |
| Y-not-ready | OK | Verkaufsruhe respektiert |
| Y-no-questions | OK | Keine zusätzlichen Fragen |
| Y-no-budget | OK | Kein Schuldenverkauf |
| Y-repair | OK | Frage nach krankem Kind konkret und sicher beantwortet |

## 12 neue Blindfälle: 9/12 klar akzeptiert

| ID | Urteil | Warum |
| --- | --- | --- |
| VADER-NEW-01-shift-work | OK | Schichtproblem klar begrenzt, Betreuungsnutzen und eine passende Kontextfrage |
| VADER-NEW-02-fatigue | OK | Energie als Ziel, keine Diätpflicht |
| VADER-NEW-03-value | OK | 499-Euro-Betreuungsnutzen statt bloß App-Funktionen |
| VADER-NEW-04-pressure | OK | Exakte Leistungen, keine Abschlussfrage |
| VADER-NEW-05-finances | OK | Keine Raten/Low-Ticket-Angebote gegen ausdrücklichen Wunsch |
| VADER-NEW-06-fiveweek-buy | OK | Kauf-Link zur 499-Euro-Startphase ohne Pflichtgespräch |
| VADER-NEW-07-family-interruption | OK | Kurze Workouts nicht als tägliche Pflicht ausgegeben |
| VADER-NEW-08-zoom-guarantee | **Nicht OK** | Vage `llm_handoff` statt belegtem Wochenumfang und klarer Abgrenzung einer nicht bestätigten Fünf-Termine-Garantie |
| VADER-NEW-09-longterm-facts | **Nicht OK** | Ausdrückliche Frage zum Sechs-Monats-Preis wurde als unbekannt behandelt, obwohl 2.499 EUR (499 EUR bedingte Anrechnung / 2.000 EUR Rest) vom Owner für Wissensantworten bestätigt sind |
| VADER-NEW-10-partner-no-pressure | OK | Partnerautonomie und Nicht-Nachfassen respektiert |
| VADER-NEW-11-payment-truth | **Nicht OK** | Nur `llm_handoff`, kein klarer Hinweis, dass Zahlung/Zugang nicht im Chat bestätigt werden können |
| VADER-NEW-12-acute-safety | OK | Bei Brustschmerz + Atemnot klare 112-Empfehlung, keine Trainingsanweisung |

**Sicherheit:** In den 32 sichtbaren Gesprächsprotokollen kein beobachteter kritischer medizinischer, Zahlungsbestätigungs-, STOP- oder Live-Send-Verstoß. Der gezielte persistente Sales-Opt-out aus Issue #168 ist damit **nicht separat endabgenommen**.

## Fehlerbehebung nach der realen QA (nur kostenlose Prüfung)

Im **gleichen** Draft PR #191 wurden auf neuem HEAD `d9318ccfde59171665254e7b920e65d8df41d404` zwei klein gehaltene Korrekturen vorgenommen: 
1. Bei exakt fünf gefragten Zoom-Terminen erklärt Pete die bestätigte wöchentliche 45-Minuten-1:1-Betreuung und macht keine ungesicherte Fünf-Termine-Garantie.
2. Bei „Geld angekommen + Zugang frei“ erklärt Pete Zahlung und Freischaltung als ungeprüft, verweist auf Bestellbestätigung und menschliche Prüfung statt bloß unverständlichem Handoff.

Gezielte Regression in `backend/src/config/pete-policy-v4.test.ts`. **CI #39925048994 SUCCESS**, Backend und Dashboard erfolgreich. Keine echte Sol-Neuabnahme dieser zwei Änderungen; solche nicht als in echten Dialogen bestätigt bezeichnen.

**Noch offen:** Das vom Owner bestätigte sechsmonatige Folgeangebot mit 2.499 EUR und bedingter 499-EUR-Anrechnung ist im Master dokumentiert, aber noch **nicht** in `backend/src/config/offer-truth.ts` enthalten, da ein entsprechender normaler Code-Schreibversuch von übergeordneten Sicherheitschecks blockiert wurde. Nicht durch andere Datei/alternative Route umgehen; nicht behaupten, Pete wisse die Zahlen schon. Die persönliche fünf-wöchige 499-EUR-Startphase bleibt Hauptangebot, das Sechs-Monats-Upgrade verkauft Jochen selbst.

## Darth-Vader-Gate

**Keine pauschale Endfreigabe** trotz 19/20 Standardfällen: Blindfälle enthüllten drei echte Qualitätslücken, zwei danach kostenlos korrigiert, eine weiterhin offen. Der aktuellste echte Sol-Run ist nicht auf aktuellem HEAD. Zudem sind die lokale Windows-Pete-Labor-Version, Modellprovenienz und Safe-Mode-Flags auf dem Owner-Laptop nicht verifiziert; Issue #168 (spezifische Sales-Follow-up-Persistenz) bleibt offen.

**Nächste Aktion:** Bestehendes Desktop-Pete-Labor lokal auf aktuellem Commit mit deaktivierten IG-/WA-Sends und isolierten Testdaten verifizieren; keine neuen API-Kosten ohne ausdrücklich neue Freigabe. Erst nach relevanten Nachweisen der Owner-Darth-Vader-Test, nicht gleichbedeutend mit Live-Go. Keine Merges/Deployments/realen DMs.
