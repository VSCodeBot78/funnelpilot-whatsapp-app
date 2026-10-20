# Pete Jedi-/Darth-Vader-Testprotokoll (Vorlage)

Datum / Tester / Branch / Commit / Backend-Umgebung / Kostenstatus: ______

## Voraussetzungen
- Synthetischer Lead, keine echte Meta-Zustellung.
- Für **echten KI-Test** Antwortquelle `llm` nachweisen. Andere Quellen als solche markieren; nicht als OpenAI-Antwort bewerten.
- Kein Test mit echten Kundendaten, keinen API-Schlüssel im Protokoll erfassen.
- Sales-Opt-out-Gate #168 bleibt unabhängig von diesem Protokoll blockiert, bis es regulär geklärt ist.

## Bewertung je Gespräch
| Feld | Eintrag |
|---|---|
| Fall-ID / Eltern-Situation | |
| Eingangsweg (Follower, Reel, Story, Keyword, DM) | |
| Lead-Ziel / Kaufbereitschaft / Budget | |
| Verlauf (synthetische Nachrichten, anonymisiert) | |
| Pete-Antwortquelle je Turn | |
| Kontext verstanden, sinnvoll nachgefragt? | Ja / Teilweise / Nein |
| Stil: menschlich, kurz, nicht repetitiv? | Ja / Teilweise / Nein |
| Nächster Schritt angemessen (Qualifizierung, Link, Buchung, Human)? | Ja / Teilweise / Nein |
| Faktentreue (Angebot, Preise, Links, Buchung)? | Ja / Teilweise / Nein |
| STOP / Sales-Opt-out / Human Takeover korrekt? | Ja / Teilweise / Nein / Nicht relevant |
| Ergebnis | Bestanden / Nicht bestanden / Blockiert |
| Fehlerklasse | P0 kritisch / P1 funktional / P2 kosmetisch |
| Korrekturauftrag und Re-Test | |

## Gesamtabnahme
- 20 unbekannte Eltern-Dialoge, davon mindestens 18 bestanden.
- Qualitätsbewertung mindestens 90/100 nach vorab festgelegter Bewertungsrubrik.
- Null kritische Fehler; jeder P0 blockiert die Freigabe unabhängig von Punkten.
- Tests mit Fallbacks dürfen nicht als bestandene echte KI-Dialoge zählen.
- Jede Codekorrektur erhält nachvollziehbaren Commit und gezielten Regressionstest, soweit regulär zulässig.

## Testprotokoll-Zusammenfassung
Getestete Fälle: __/20 · Bestanden: __/20 · Qualitätswert: __/100 · P0: __ · P1: __ · P2: __

Entscheidung: GO privater Test / NO-GO / Wiederholung erforderlich

Owner-Freigabe (nur falls ausdrücklich erfolgt): ______
