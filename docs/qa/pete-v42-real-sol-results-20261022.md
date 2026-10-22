# Pete GPT-6.1 Sol / Policy v4.2 - Qualitäts- und Budgetstand (22.10.2026)

## Entscheidungen und Grenzen
- Besitzer freigegeben: zusätzliche maximal **5 EUR** für echte Pete-KI-Testaufrufe.
- Intern konservative USD-Obergrenze der neuen Freigabe: **5.000000 USD**.
- Historischer Gesamtdeckel **8.000000 USD** bleibt unverändert; davor verbraucht **7.817830 USD**.
- Das von Nutzer genannte OpenAI-Kontoguthaben von ca. 16 EUR wurde nicht unabhängig verifiziert.
- Nur synthetische Gesprächsdaten, keinerlei Live-Instagram-/WhatsApp-Nachrichten, kein Deployment, keine automatische Aufladung oder Abos.

## Echte GPT-6.1-Sol-Testnachweise
1. [20 bekannte schwierige Dialoge](https://github.com/VSCodeBot78/funnelpilot-whatsapp-app/actions/runs/39768222168): Workflow erfolgreich, 20 Fälle, 38 Modellantworten und 2 geprüfte Transaktionsantworten; **0.585326 USD** intern gemessen.
2. [12 neue Varianten, nach B04 gestoppt](https://github.com/VSCodeBot78/funnelpilot-whatsapp-app/actions/runs/39769626385): vier Fälle angeschnitten, unerwünschte Human-Übergabe bei Frage zur ausfallenden Kinderbetreuung erkannt; **0.077514 USD** abgerechnet und einmalige Reservierung geschlossen. B01 (unbekannte Videoanrufe), B02 (Selbststarter-Kauf ohne Pflichtgespräch) und B03 (Pausenausfall) sachgerecht behandelt.
3. [Restliche 9 Holdout-Fälle](https://github.com/VSCodeBot78/funnelpilot-whatsapp-app/actions/runs/39770672140): Workflow erfolgreich, 9 Modellantworten und 9 geprüfte/deterministische Antworten; **0.138106 USD**. B04 beantwortet nun Betreuungs-Ausfall ohne Handoff; medizinischer Notfall B07 mit 112, STOP B12 ohne Folgeantwort, Nicht-Passung B10 und Zeitaufwandsangaben B11 korrekt begrenzt.

## Festgestellte und korrigierte Schwächen
- B04: Frage „Was passiert, wenn die Kinderbetreuung ausfällt?“ führte ohne Not zu menschlicher Übernahme. Verifizierte allgemeine Antwort bei solchen Alltagssituationen ergänzt; **echter Sol-Nachtest erfolgreich**.
- B08: explizit Jahre zurückliegende Schwangerschaft mit Körperunwohlsein wurde fälschlich als akut-medizinischer Fall eskaliert. Historische Formulierungen in der eng begrenzten nichtmedizinischen Erkennung ergänzt, gleichzeitig bleiben **aktuelle Schwangerschaft mit roten Warnzeichen sowie Brustsymptome medizinisch geschützt**. [Backend- und Dashboard-Offline-QA erfolgreich](https://github.com/VSCodeBot78/funnelpilot-whatsapp-app/actions/runs/39771130553). Für B08 liegt **noch kein erneuter kostenpflichtiger Modellnachtest nach dieser Korrektur** vor.
- Bei Schichtarbeit sind die Antworten besser als früher, aber teils noch zu stark auf Essensvorbereitung orientiert, obwohl der tatsächliche Engpass fehlende Pausen sind.

## Abrechnung
Neue Zusatzfreigabe, getrennter persistenter Posten `extraOwnerQa20261022` im gemeinsamen Ledger:
- Test 1: USD 0.585326
- Vorzeitig gestoppter Holdout: USD 0.077514
- Restlicher Holdout: USD 0.138106
- **Neu verbraucht: USD 0.800946**
- **Konservativ verbleibend: USD 4.199054**
- Keine offene Reservierung; Ursprungslimit und ursprünglicher Verbrauch unverändert.

## Abnahme und nächster Schritt
- Technische QA grün, reale Sol-Antworten deutlich verbessert, Sicherheitsproben geschützt.
- **Kein formell bestätigtes 18/20 mit unabhängigem Bewertungsraster und kein Live-Go**. Workflow-Erfolg und Antwortanzahl sind keine Verkaufsqualitätsnote.
- UI/Backend-Modellwahl GPT-6.1 Sol ist Entwicklungsstand; noch nicht in das lokale Desktop-Pete-Labor auf dem Laptop übernommen.
- Für Abnahme: B08-Korrektur ggf. mit sehr kleinem echten Test verifizieren; qualitativen 20-Fälle- und unbekannten Holdout-Bericht dokumentieren; danach Desktop-Pete-Labor mit menschlichem Darth-Vader-Test. Kein mobiler TTD-Test als Voraussetzung.
