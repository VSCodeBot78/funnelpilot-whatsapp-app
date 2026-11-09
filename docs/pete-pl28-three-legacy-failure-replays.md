# PL28 | Drei alte Pete-Fehlerfälle erneut mit Sol getestet | 09.11.2026

## Auftrag und Testumgebung
Owner-GO: genau drei echte KI/Sol-Testgespräche mit der alten Wortwahl aus früheren fehlgeschlagenen Tests; nach Auswertung Laptop herunterfahren.
- Lokal: Repo `C:\Users\Jo\FunnelPilot-Dashboard-PR193`, Git-HEAD vor Test `9cf08620b22d23f3ef1fc2d4f42d8413453adc8a`, zuvor Git sauber.
- Echtes Modell: `gpt-6.1-sol`; NoSend Desktop-Labor, nur synthetische Leads. Instagram/WhatsApp Send OFF.
- 3 unabhängige Gespräche, insgesamt 15 Nutzernachrichten, 11 echte Modellantworten; die übrigen Antworten aus verifizierter Transaktionslogik.
- **Originalformulierungen wurden wörtlich übernommen, soweit dokumentiert.** Zwei Tests reproduzieren alte Owner-Human-Fehler vom 03.11.2026. Brückensätze sind ausdrücklich synthetische Rekonstruktionen, weil das frühere komplette Transkript nicht überall verfügbar ist. Der dritte Fall ist ein früherer **automatisierter Sol-R8-Fehltest** und kein ehemaliger Human-Test.
- Lokales Budget-Ledger vor Tests `5.652592 USD`, nach Tests `5.868592 USD`, Delta `0.216000 USD`. Kein extern bestätigter Rechnungsbetrag. KI nach der Testreihe OFF, Send OFF durch Runner bestätigt. Kein realer Meta/WhatsApp-Send.
- Vollständiges synthetisches Testprotokoll: `C:\Users\Jo\Desktop\PL28_Three_Failure_Replays_2026-11-09.json`, Runner `C:\Users\Jo\Desktop\PL28_3_Human_Failure_Replay.mjs`.

## Ergebnisse – nachvollziehbar, ohne Erfolgsübertreibung
### Test 1: 03.11.2026, 22:21, alte Kostenfrage / „hallo???“
Dokumentierte wörtliche Nachrichten: `ein paar Kilo runter`, `klar, kostet das was?`, `hallo???`. Fehlender früherer Strategiegesprächs-Kontext wurde durch den **neuen synthetischen Satz** `Ich möchte mit Jochen ein Strategiegespräch machen.` ergänzt.
- Auf Kostenfrage diesmal **keine stille Übergabe**, sondern verifizierte Antwort: „Die Terminbuchung kostet nichts und ist noch keine Coaching-Buchung“, mit Calendly-Link. Das frühere P0-Stillstandsverhalten ist hier nicht reproduziert.
- Auf `hallo???` folgt erneut eine echte Modellantwort – aber **falsch inkonsistent**: „ob für das Strategiegespräch Kosten anfallen, ist hier nicht verlässlich bestätigt“ nach vorheriger verifizierter Kostenlos-Aussage. **P1: Kostenauskunft/Kontextwahrheit im Folgeturn inkonsistent; kein erfundener Zahlungsbeleg, aber verwirrend**. Nicht als vollständig fehlerfrei markieren.

### Test 2: 03.11.2026, 23:03, Energie/Abnehmen und Zustimmung
Wörtliche frühere Followerformulierungen:
`im prinzip alle 3`, `energie und abnehmen`, `keine energie abends für sport und ich snacke oft nebenbei`, `nervennahrung wegen dem stress`, `job, alltag, kinder, dass ich fett bin`, `wenn es unverbindlich ist gerne`, `hallo`.
Nur der Satz `Ich könnte das persönlich mit Jochen im Strategiegespräch besprechen.` dient als **neue synthetische Kontextbrücke**.
- Pete reagiert sachlich auf Alltag/Stress, ohne Heilversprechen. Die anfängliche Rückfrage „Welche drei Punkte meinst du?“ ist erwartbar, weil das ursprüngliche Begrüßungsangebot nicht 1:1 rekonstruiert wurde; kein neuer Fehlernachweis.
- Auf Zustimmung `wenn es unverbindlich ist gerne` diesmal **verifizierte Antwort mit Calendly-URL**, keine stille Human-Übernahme. Auf nachgeschobenes `hallo` weitere echte KI-Antwort statt Schweigen.
- Kleinere Stilfrage: „Geht es dir noch um das Strategiegespräch?“ nach schon geklärter Absicht wirkt etwas redundant, **P2**.

### Test 3: Sol-R8, unsicherer alter Selbststarter-Kauf
Wörtliche ältere automatisierte Fehlerformulierung: `Ich bin Papa und glaube, den Selbststarter schon irgendwann gekauft zu haben. Ich will kein zweites Mal zahlen.`; anschließend `Könnt ihr bei euch überhaupt nachsehen, ob ich den Selbststarter damals bestellt habe?` und `Ich will kein zweites Mal zahlen.`
- **Kein stiller Handoff**. Pete behauptet keinen Kauf/keine Zahlung. Auf Statusfrage erklärt die verifizierte Logik, dass der Kauf nicht eingesehen werden kann und Jochen gegebenenfalls den Vorgang prüft. Kein erneuter Checkout-Link auf Verdacht. **Bestanden in diesem Test.**

## Gesamtbefund / Beta-Entscheidung
- **3/3 Gespräche durchgelaufen ohne stillen Handoff**, darunter zwei bekannte frühere reale Human-Ausfallpunkte.
- **Nicht 3/3 fehlerfrei**: P1-Widerspruch zur Kostenfreiheit bei Kostenfrage → „hallo???“ muss für Antwortkonsistenz in Prompt/Continuity-Fakten geprüft werden; kein Anlass für neue Spezial-Regex-Ketten.
- Kein neues Meta-Live-GO: Meta-App/Scopes/Webhooks/Privacy und Owner-Go getrennt nachweisen. 3 synthetische Tests ersetzen weder spontane Owner-Human-Abnahme noch echten Provider-E2E.
- Kein neuer Codepatch oder erneuter kostenpflichtiger Test unter diesem Auftrag. Der dritte Test stammte nicht aus einem persönlichen Human-Test; Herkunft offen gekennzeichnet.

**Belegt:** genau 3 echte Sol-Labortests, 15 Follower-Turns, Testprotokoll und lokale Ledger-Kostendifferenz; KI/Send AUS laut Runner.
**Offen:** Kosten-Widerspruch im Folgeturn und externe Meta/Datenschutz-Gates; aktueller echter Owner-Human-Test.
**Nächster Schritt:** Projektleitung/Prompt-Verantwortliche sollen den Kosten-Widerspruch als eine generische Antwortkontinuitätslücke dokumentieren und offline absichern; keine weiteren API-Kosten oder Live-Aktion ohne neues Owner-GO. Laptop nach Bestätigung der Abschaltsperren herunterfahren.
