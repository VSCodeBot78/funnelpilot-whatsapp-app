# Vorbereitungsboard nach dem Desktop-Test (20.10.2026)

Status: Read-only Code-Sichtung und Backlog. Keine Implementierungs-, Deployment- oder API-Kostenfreigabe. Maximal fünf aktive Arbeitspakete. Die gesperrte Sales-Opt-out-Testdatei aus Issue #168 darf nicht über Ersatzdateien/andere Werkzeuge umgangen werden.

## 1. Privater Pete-Labor-Test / echte KI (P0)
- Bereits im Code: `backend/src/app.ts` stellt `GET /health/readiness` mit `peteLlmConversationSelected`, `peteLlmCostGateApproved`, `peteLlmProviderReady` und `peteLlmTestBudget` bereit.
- `backend/src/core/pete-llm-conversation.ts` verlangt getrennte Feature-, Kosten- und Consent-Freigaben.
- `backend/src/routes/test-chat.ts` liefert `replySource`; nur `llm` zählt als echte Provider-Antwort, nicht `deterministic`, `safe_noncritical` oder `verified_transaction`.
- Offen: Desktop-Pfad unter echten lokalen Variablen und Kostenledger ohne Schlüsseloffenlegung überprüfen; Owner testet anschließend.

## 2. Sales-Opt-out / Yoda-Fall 12 (P0, BLOCKIERT)
- `backend/src/core/conversation-engine.ts` persistiert `salesFollowUpsOptedOut` nach erkannter Ablehnung vor asynchronem Modellaufruf.
- GitHub Issue #168 fordert zusätzliche persistente Grenzfallnachweise. Frühere Testdatei-Schreibblockade bleibt gültig; keine Umgehung, kein ungesicherter Merge oder Deploy.
- Freigabe erst nach regulär zulässigem Test- und Review-Weg.

## 3. Live-Gate / Betriebs- und Provider-Sicherheit (P1, später)
- In `backend/src/services/production-admin-guard.ts` wird die Produktions-Adminoberfläche hinter einem vertrauenswürdigen authentifizierten Reverse Proxy vorgesehen. Public Callback-Allowlist ist eng begrenzt; Handler müssen Signaturen prüfen.
- Vor Live: verifizierte Provider-Events und Deduplizierung, in-flight Human-Takeover, STOP und Opt-out, Crash-/Mehrprozess-Verhalten, persistente Versandversuchsmarker, Provider-Fehler/Retry, gesonderte Meta-Freigabe.
- Lab und produktive Daten/Token strikt trennen; keine IG-/WA-Sends im Test.

## 4. SaaS-Architektur (P2, nur Konzept vor Vader)
- Bestehende `/campaigns`-Route und `CampaignRecord` prüfen, bevor Mandantenfähigkeit umgesetzt wird. Keine bloße UI-Filterung als Mandantentrennung.
- Später definieren: `tenantId` an Leads, Konversationen, Kampagnen, Settings, Budgetledger und Audit-Logs; serverseitige Autorisierung; Datenmigration; Coach-Rollen; Isolationstests; Aufbewahrung/Löschung; tenantweise Kostenzuordnung.
- Vor dem Test keine invasive Schemaänderung und kein Zahlungs-/Abosystem.

## 5. Dashboard-Regression und Nachweise (P2)
- Owner-Abnahme: Dollarzeichen-Platzhalter, Leerzeichen in Buttonlabels, Kampagne speichern/neu laden, Ghosting-Zyklen und Texte, Desktop-Pete-Labor.
- Automatisierte Tests, Code-Review und echte Owner-Tests getrennt dokumentieren; keine grüne CI als Nachweis für eine echte KI-Antwort ausgeben.
- Bereits separat aufgenommen: `docs/backlog/pete-api-kosten-dashboard-20261020.md` (read-only, nach Pete-Abnahme).

## Was jetzt bewusst NICHT gemacht wird
Keine neuen Dashboard-Features, kein Mandanten-/Billing-Refactor, keine neue Testdatei zur Umgehung von #168, keine API-Aufrufe, kein Meta-Review, kein Deploy/Merge, keine Änderungen an ManyChat oder am Windows-Originalordner.
