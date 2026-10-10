# Pete – Eltern-Stresstest 2.0 (Phase 30, 10.10.2026)

## Umfang und überprüfbare Basis

- **70 eigenständig formulierte, synthetische Mutter-/Vater-Rollenspiele** in 14 Themenfeldern à fünf Varianten, **210 echte Testeingaben** an die deterministische Natural-DM-Engine.
- Variiert wurden Schichtarbeit, Elternalltag, Zeitdruck, kostenlose Downloads, Keto-Begleitung, Werbeablehnung, Geldmangel, freigegebene und ungeklärte Preise, Human-Handover, Gesundheitsrisiken, Kalenderstatus, Vertrauen, Themenwechsel und STOP.
- Für **alle 70 Gespräche** werden die tatsächlichen Pete-Antworten samt Status in CI protokolliert. Das ist keine Bewertung echter Eltern, kein echter OpenAI-Modell-Dialog und kein wirklicher Instagram-/WhatsApp-Versand.
- `backend/src/config/pete-parent-stresstest-v2.test.ts`, ausgeführt als Bestandteil von `npm test`.
- Automatisch überprüft: keine Antwort nach STOP/Handover, keine falsche Buchungsbestätigung, keine ungeklärten Altpreise, höchstens eine Frage pro Antwort, keine ABCD-Menüs, keine fingierte persönliche Jochen-Identität, keine erfundenen Ernährungsplan-Zusagen; außerdem keine wortgleiche Folgeantwort und kein generischer Erstfragen-Neustart nach Gesprächsantworten.

## Gefundene Probleme und Korrekturen

| Gefundener Rückfall (tatsächlich im ersten CI-Durchlauf beobachtet) | Änderung |
| --- | --- |
| „Schreib mich nicht mehr an“ setzte den STOP-Status nicht | Explizite Varianten in der Hard-STOP-Entscheidung ergänzt; Folgeeingaben bleiben unbeantwortet |
| „Schick mir stattdessen bitte den kostenlosen Keto Guide“ nach Vertrauensbedenken führte zurück in die alte Skepsis-Frage | Neues konkretes Anliegen hat Vorrang vor dem vorherigen Gesprächszustand |
| „Das kann ich mir aktuell nicht leisten“ führte zum generischen Einstieg | Budgetformulierung wird als Finanz-Einwand behandelt; keine erfundene Lösung |
| Nach „Ich lese nur“, „Passt für mich“, „Vielleicht melde ich mich später“ kamen weitere Qualifizierungsfragen | Info-only-Verlauf schließt kurz ohne neuen Sales-Funnel; wiederholte identische Verabschiedungen reduziert |
| „Was bekomme ich dafür?“ beim Selbststarter wurde nicht verstanden | Antwort verweist auf die tatsächliche Produktseite statt erfundener Inhalte |
| „Den Link schaue ich mir an“ führte erneut zur Erstqualifizierung | Ruhiger Abschluss ohne weitere Frage |
| Frage nach Anrechnung, Monatsrate, Rabatt, Anzahlung zur 6-Monats-Begleitung wurde generisch oder doppelt beantwortet | Kontextbezogen sagen, was noch persönlich geklärt werden muss; **keine** erfundenen Konditionen |
| „Was ist bei Jochen anders?“ trotz vorherigem Vertrauensgespräch ignoriert | Tatsächliche Themen Bewegung, familienkompatible Ernährung sowie Schlaf/Stress gespiegelt, keine Erfolgsgarantie |
| „Ist der Elterncheck kostenlos?“, „Geht der Guide ohne Coaching?“, „Ich höre lieber Audio“ lösten neue Standard-Fragen aus | Kontextbezug zum zuletzt gezeigten Gratis-Angebot |
| „Siehst du den Termin?“, „Kannst du den Termin garantieren?“ nach eigener Buchungsbehauptung nicht verstanden | Provider-Bestätigungsstatus bleibt maßgeblich; ohne Webhook ausdrücklich nicht bestätigt |
| „Mein Keto Guide“ ließ Pete fälschlich wie den Eigentümer klingen | „Jochens Keto Guide“ |
| „Ich bespreche das zu Hause“, „Ich brauche Zeit“ und Ablehnung der Verkaufsmasche wurden teilweise in Buchungsfragen überführt | Klare Akzeptanz von Bedenkzeit / keine neue Verkaufsfrage |

## Qualität nach Überarbeitung

Der Lauf `38058460401` auf der damaligen Zwischenfassung enthielt bei denselben 70 Gesprächen noch **33** Antworten mit dem generischen „größter Knackpunkt“-Einstieg und **17** unmittelbar wiederholte identische Pete-Antworten. Nach der zweiten Korrekturrunde ergab die erneute vollständige Auswertung auf Commit `8b81d3d3` (Lauf `38058760602`):

- **0 generische Knackpunkt-Resets**, **0 unmittelbar identische Folgeantworten** in den 70 Szenarien.
- **0 Verkaufsfragen** auf die erfassten Dankes-/Abschlussformulierungen.
- **205 Backend-Tests**, **5 lokale Relay-/Launcher-Tests** und **8 Dashboard-Tests** bestanden = **218/218**; beide Builds erfolgreich, 0 Fehler.
- 182 Pete-Texte und 28 korrekt unterdrückte Antworten in den 210 simulierten Lead-Eingaben. Diese Zahlen messen die Testabdeckung, **nicht** Lead-Konversion oder Akzeptanz bei realen Menschen.

## Tatsächliche finale Antworten (Auszug)

**Mama:** „Schick mir stattdessen bitte den kostenlosen Keto Guide.“
**Pete:** „Klar 😊 Jochens Keto Guide ist kostenlos. Du bekommst ihn als PDF und als Hörversion. Hier findest du ihn: https://jochen-kammerer.de/keto-guide/“

**Mama:** „Gibt es eine Anrechnung der fünf Wochen?“
**Pete:** „Ob die fünf Wochen auf eine längere Begleitung angerechnet werden können, klärt Jochen persönlich. Ich möchte dir dazu nichts zusagen, was nicht feststeht.“

**Mama:** „Was ist bei Jochen anders?“
**Pete:** „Jochen verbindet kurze, alltagstaugliche Bewegung mit familienkompatibler Ernährung und schaut auch auf Schlaf und Stress. Das ist keine Erfolgsgarantie, und du musst hier nichts überstürzen.“

**Mama:** „Ich will keine Werbung und kein Verkaufsgespräch.“ Danach: „Vielleicht melde ich mich später.“
**Pete:** „Alles klar 👍“

## Verbleibende offene Punkte

- Die Budget-Klärung („Ist gerade wirklich der Preis das Problem…?“) wirkt bei eindeutiger Geldnot stellenweise noch schematisch. Diese Antwort wurde im Rahmen der bestehenden, separat regressionsgeprüften Einwandstrategie nicht grundsätzlich ersetzt.
- In einer deterministischen Testengine können nur vorbereitete Sprachmuster geprüft werden; die Qualität eines echten LLM-Gesprächs lässt sich damit **nicht** belegen. Der editierbare Master-Prompt deckt nicht alle festen Antworttexte ab.
- Persönliche finale Ton-/Markenabnahme durch den Gründer, tatsächliche Antwortzeiten, echte Provider-Webhooks, Meta-/ManyChat-Koexistenz und echte Interessentenreaktionen sind **noch nicht nachgewiesen**.
- 4-Farben-Personalisierung ist weiterhin nicht systematisch pro Persönlichkeitstyp abgenommen.
- Technische Erfolgsmeldung gilt für die lokale CI-Simulation, **nicht** als Freigabe für aktiven Versand oder Verkauf der Software an weitere Coaches.

## Nächster Schritt

Phase 31 (kompletter Funnel-Durchlauf mit simulierten Systemereignissen) **separat**, erst nach Abschluss dieses Pakets. Danach Phase 32 (Windows-Abnahme vorbereiten). Kein neues Live-Send-Opt-in und keine API-Kosten durch Phase 30.
