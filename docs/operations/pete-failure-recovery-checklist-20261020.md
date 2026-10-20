# Pete: Betriebsfehler und Wiederanlauf (Vorbereitung, 20.10.2026)

Status: Prüfkatalog, kein Testnachweis, keine Änderung produktiver Konfiguration.

## Codebefund
- `backend/src/core/pete-llm-conversation.ts` nutzt `reservePeteBudget` vor dem Provider-Aufruf und `settlePeteBudget` bei erhaltener Usage. Mögliche Handoff-Gründe sind `not_authorized`, `provider_unavailable`, `invalid_output`, `model_handoff`, `budget_exhausted`, `budget_unavailable`.
- `backend/src/services/pete-api-budget.service.ts` beschreibt persistente Reservierungen mit exklusiver Dateisperre; unklare Reservierungen nach Crash werden nicht stillschweigend gelöscht.
- `backend/src/core/conversation-engine.ts` unterdrückt Antworten bei `stopped`, `human_owned` und `superseded` nach asynchronem Aufruf.
- `backend/src/routes/meta-instagram.ts` enthält einen Duplicate-Pfad. Die Existenz des Codes ist kein Beweis für End-to-End-Race-Sicherheit.

## Spätere Prüfungen und erwartete Ergebnisse
| Fehlerbild | Mindestanforderung | Nachweis |
|---|---|---|
| API-Key fehlt oder Kostenfreigabe aus | Kein Provider-Aufruf, kein stiller kostenpflichtiger Versuch | kontrollierter lokaler Test |
| API 429/5xx/Timeout | Kein erfundener KI-Erfolg; sicherer Handoff/Fehlerstatus, keine Antwort-Duplikate | Fehler-Injektion ohne Live-Send |
| Budget erschöpft oder Ledger defekt | Fail-closed, keine weiteren kostenpflichtigen Calls | persistenter Budget-Test |
| Neustart während Budgetreservierung | Ledger bleibt konservativ, kein Reset | Neustart-Test mit Kopie synthetischer Daten |
| Human Takeover während laufendem Modellaufruf | Verspätete KI-Antwort wird verworfen | Race-Test |
| STOP während laufendem Modellaufruf | Keine neue Antwort oder Follow-up | Race-Test |
| Doppelte Instagram-Webhook-ID | Maximal eine verarbeitete Nachricht / kein doppelter Send | synthetischer Event-Replay |
| Provider-Send unklar / Prozessabbruch | Keine blinde erneute Zustellung | Crash-/Mehrprozessprüfung vor Live |

## Eskalation
P0: Jede reale Doppelantwort, Nachricht nach STOP/Human-Übernahme, Datenleck oder Budgetüberschreitung -> Live blockieren. P1: unklare Providerzustellung/fehlender Auditnachweis -> vor Live klären. P2: kosmetische Fehler -> nachziehen.

Keine Live-IG/WA-Nachrichten, keine produktiven Tokens, keine neuen Kosten oder Deployments ohne Freigabe. Sales-Opt-out-Gate #168 bleibt separat blockiert; nicht über neue Testdateien umgehen.
