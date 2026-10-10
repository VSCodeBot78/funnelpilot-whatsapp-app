# Phase 3: Pete-Testbudget und automatische Ausgabensperre

Benutzerfreigabe: maximal 10 EUR bereits aufgeladenes OpenAI-API-Guthaben. Automatisches Aufladen laut Benutzer deaktiviert. Keine zusätzlichen Ausgaben, kein Live-Meta-Versand.

## Interner technischer Puffer

Die API wird in USD abgerechnet. Der interne Pete-Zähler limitiert konservativ auf **8,00 USD**. Das ist **kein garantierter plattformweiter 10-Euro-Hard-Cap** und keine tagesaktuelle FX-Umrechnung. Andere API-Schlüssel, Anwendungen, Steuern oder zusätzliche Kontogebühren werden von diesem Zähler nicht kontrolliert.

Fixes Testmodell: \`gpt-4.1-mini\`, Standardpreise laut OpenAI (Oktober 2026) 0,40 USD/M Eingabe-Tokens und 1,60 USD/M Ausgabe-Tokens. Fremdmodelle werden vor dem HTTP-Aufruf geblockt. Kein Web-Search- oder anderes kostenpflichtiges API-Tool in diesem Pfad.

## Zähler

Speicherung: \`DATA_DIR/pete-api-budget.json\`, privat und atomar. Ein exklusiver Dateilock vermeidet gleichzeitige Reservierungen; bei beschädigtem Ledger oder vorhandener Sperre bricht der Aufruf ab. Reservierungen überstehen Neustarts und werden nicht automatisch gelöscht.

Für jede Anfrage wird VOR der Übertragung die maximal erwartete Tokenrechnung einschließlich kompletter Request-Bytes, Reserve für Wrapper und maximal 400 Ausgabetokens reserviert. Wenn die nächste Reservierung den USD-Cap überschreitet, wird KEIN Provideraufruf ausgeführt. Nach erfolgreicher API-Antwort mit \`usage.input_tokens\` und \`usage.output_tokens\` wird der tatsächliche Verbrauch verbucht. Ohne Usage-Felder oder bei Verbindungsabbruch bleibt die volle Reservierung angerechnet. Caching-Rabatte werden vorsichtshalber nicht abgezogen.

Admin-/Lokalansicht: \`GET /test-chat/budget\` und \`GET /health/readiness\` (peteLlmTestBudget). Zähler zeigt bestätigten Betrag, offene Reservierungen, Gesamtvorbelastung, verbleibenden USD-Rahmen und Tokenzahlen. Secrets werden nicht angezeigt. Produktions-Admin-Guard gilt weiterhin.

## Aktivierung / Datenschutz

Die Freigabe der 10 EUR bestätigt das Kostenbudget, **nicht** den Versand echter Kundendaten oder echtes Instagram-/WhatsApp-Outbound. Vier bestehende technische Voraussetzungen bleiben nötig: \`PETE_LLM_CONVERSATION_ENABLED=true\`, \`PETE_LLM_API_CALLS_APPROVED=true\`, privater \`OPENAI_API_KEY\` und gespeicherte Einstellung \`aiEnabled=true\`. Keine dieser Einstellungen wird durch diesen PR geändert.

Der Zähler muss mit stabiler, dauerhaft gleicher \`DATA_DIR\` und einem einzigen gemeinsam gesperrten Datenvolume laufen. Nicht mehrere unabhängige Server mit separaten Budgetdateien starten. Datei niemals zurücksetzen, um das Testbudget neu zu erhalten.

GitHub-CI verwendet nur synthetische Texte und gemockte Fetch-Aufrufe, niemals die echte OpenAI-API.

Phase 3: 50 schwere mehrstufige Elternrollen, vorerst nur Synthetik, unabhängig bewerten und Fehler wiederholt nachtesten. Echte Modell-Tests benötigen geschützten Runner-/Secret-Zugang und Klärung des Datenflusses. Phase 4 Gründer-Laptop-Abnahme folgt erst nach bestandenem Test.
