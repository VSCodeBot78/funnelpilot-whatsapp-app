# Pete V3 Qualitätsreparatur: technische Übergabe

Stand:25.10.2026, Europe/Berlin. Bestehender Branch `feat/pete-policy-v4-20261022`, Draft-PR191. Auftrag: PETE_MASTER_STATE115/116, drei bekannte reale Fehler fachlich anhand der Dialogverläufe und technisch absichern; parallele Forschung erhalten. Keine neuen Agenten, Anbieteraufrufe, Live-Sends, Merges oder Deployments.

## Ergebnis

**V3-06, V3-14 und V3-16 sind im vorhandenen Enginepfad als technische Fehlerfälle behoben und für die Projektleitung prüfbar.** Die vollständigen sechs ursprünglichen Lead-Nachrichten jedes der drei fehlgeschlagenen Sol-Dialoge werden jetzt in der echten Engine mit synthetischem Provider durchlaufen. Alle18 Lead-Turns erreichen den erwarteten Informations-Endzustand: Owner bleibt AI, keine ungewollte Pause/Unterdrückung, verifizierter Methodenlink, kein Checkout und keine Buchungsberechtigung.

Diese Replayprüfung verwendet die original gespeicherten Lead-Eingaben aus `docs/qa/pete-v3-sol-qa-20261025.json`, aber **synthetische Providerantworten**. Sie ist keine neue GPT-6.1-Sol-Textqualitätsabnahme. Der historische echte15/18-Befund bleibt ein Messwert des alten Codes. Keine rückwirkende18/18- oder18/20-Behauptung.

## Tatsächlicher Source und Integration

- PL-Ausgangsstand115:`114d0492e625cf0515a37b1b824b8679df2ebe37`.
- Vor Arbeitsbeginn aktueller Head nach paralleler Forschung:`8f6c7bf90681db35ced6c3d90342f5a17668e57f`, Tree`64ad7ac63e6addf93a418ec336496133ee60ad71`.
- Tatsächlicher Reparaturcommit:`353cf8a7643154a89e9f71bfefd68dd7c73f6b86`, Tree`0d1719e1efd165ed9e23cc540ca6f9cc5ac13283`.
- Reguläre GitHub-App create_tree/create_commit/update_ref, expected_sha auf8f6c7bf, force=false. Zurückgelesener Source/CI und lokal erzeugter Tree identisch.
- Forschung in `pete-llm-conversation.ts` und `pete-real-qa-turn-guidance.test.ts` exakt gegenüber8f6c7bf erhalten. Die fünf neuen Forschungstests wurden jetzt im vollständigen Original-Repository ausgeführt, nicht bloß im isolierten Probe-Script.
- Budgetservice, persistentes Ledger, Approval-Manifest und Paid-QA-Gates unverändert. Keine neue Dependency, App oder Testframeworkmigration.

## Belegte Ausgangsfehler und gezielte Korrekturen

**Ursprüngliche rote CI wurde tatsächlich gelesen und lokal reproduziert.** Run[40204442180](https://github.com/VSCodeBot78/funnelpilot-whatsapp-app/actions/runs/40204442180), Job121202264199: Build erfolgreich,624 Backendtests,622 PASS/2 FAIL. Die zwei Failzählungen sind ein fehlgeschlagener Arztkontext-Subtest samt übergeordneter Suite, keine zwei unabhängigen Produktfehler. Auf dem inzwischen neueren8f6c7bf lokal629 Tests/627 PASS/2 FAIL. Die fünf Forschungsfälle bestanden dabei bereits.

1. **V3-06 Probephase:** Die PL-Korrektur für „Zusammenarbeit testen“ blieb erhalten. Auch nachfolgende Probephasenfragen erkennen nun den tatsächlichen früheren Lead-Kontext. Der vollständige Originalverlauf deckte zusätzlich auf, dass „Ich will keine frei erfundenen Vertragsbedingungen. Was steht denn fest?“ als Rechtsfall dauerhaft übernahm. Eine eng begrenzte Frage nach bestätigten Fakten mit tatsächlichem jüngstem Probe-Kontext erhält jetzt die bereits geprüfte Ungewissheitsantwort. Keine Probephase, Vertragsdauer, Rückerstattung oder Sonderbedingung erfunden. Ohne Probe-Kontext bleibt das bisherige Rechtsgate erhalten. Echte Widerrufs-, Kündigungs-, Datenschutz-, Haftungs- und Zahlungsanliegen bleiben menschlich.
2. **V3-14 Infolink nach Kaufablehnung:** Die vorhandene PL-Reparatur ist durch den kompletten sechs Nachrichten langen Originalverlauf und zusätzliche Zustands-/Transportprüfungen bestätigt. Ausschließlich eine neue ausdrückliche Inbound-Informationsbitte autorisiert den geprüften allgemeinen Methodenlink. Das persistente Sales-Opt-out bleibt true, automatische Verkaufs-/Ghosting-/Buchungsnachrichten bleiben blockiert. Kein Checkout und keine Buchungsfreigabe, keine neue Marketingeinwilligung.
3. **V3-16 Arztkontext:** Der alte positive Test gab immer denselben Modelltext zurück. Dadurch wurde korrekt der bestehende Wiederholungsschutz ausgelöst. Die Fake-Antworten sind jetzt pro Runde verschieden; keine Assertion oder Wiederholungsgrenze gelockert. Bei der Sicherheitsprüfung scheiterten außerdem zehn zusätzliche Gegenproben: Die neue Ausnahme hätte bestehende medizinische Warnsignale beziehungsweise eine verneinte Arztbetreuung überdeckt. Die Ausnahme nutzt jetzt die vollständigen vorhandenen medizinischen Signalregeln, einschließlich kritischer Begriffe wie Ohnmacht. Nur der ausdrücklich harmlose Arztbezug und die explizite Diagnoseablehnung werden für diese Prüfung entfernt. Verneinte Arztbetreuung, aktive Symptome, Krankheit, Medikamente und konkrete Trainingsfreigaben bleiben gesperrt. Weitere sensible Datenschutz-/Krisenanliegen werden nicht verdeckt.

Der vollständige Arztverlauf deckte noch eine konkrete falsche Terminfreigabe auf: „Bitte bestätige keine freien Termine oder sichere Belastbarkeit meiner Hüfte.“ Die Verneinung erkennt jetzt auch Adjektive wie freie/verfügbare/bestätigte Termine. Kein Kalenderlink oder wantsBooking aus dieser Ablehnung. Vorhandene positive Buchungs- und Abendpräferenz-Fälle bleiben grün.

Die Gegenprüfung der Probe-Faktenregel fand zudem zwei fehlende echte operative Eskalationen. Ausdrückliche Lösch-/Entfernungsanträge für persönliche Daten und selbst verlangte Rückzahlungen werden im bestehenden Sicherheitsklassifikator erkannt; sie bekommen keine generische Modellantwort und keine behauptete Ausführung. Keine automatische Datenlöschung, Zahlung oder Erstattung hinzugefügt.

## Kostenlose Prüfungen auf exakt353cf8a

| Prüfung | Tatsächlicher Nachweis |
| --- | --- |
| Lokal `cd backend && npm run check`, Node24.22.1 | TS-Build PASS;25 Desktop,655 Backend,26 Starter/Budget PASS;0 FAIL/0 SKIP |
| Linux-CI[40206816946](https://github.com/VSCodeBot78/funnelpilot-whatsapp-app/actions/runs/40206816946), Job121209412425 | Build;25 Desktop,655 Backend,26 Starter/Budget,9 echter Vite/Express-Proxy,9 Chromium/React,10 weitere Budgetverträge PASS |
| Dashboard desselben Runs, Job121209412566 |103 Tests und beide vorhandenen Builds PASS |
| Backend-/Dashboard-Dependency-Audits | Je0 Befunde |
| Windows-CI[40206816846](https://github.com/VSCodeBot78/funnelpilot-whatsapp-app/actions/runs/40206816846), Job121209411959 | Build,25 Desktop,102 V3-/Kontexttests,9 Proxy,9 Chromium/React PASS |
| Windows WinPS5.1/CMD, Job121209412098 | Parser, Dirty-Worktree-Schutz, echte CMD-Pfadweitergabe, unterbrochene Releases/Recovery PASS |
| `git diff --check` und Forschungsdateien-Vergleich | PASS; beide parallelen Dateien unverändert |

Alle vier GitHub-Joblogs wurden gelesen und enthalten den exakten Reparaturcommit. Der bestehende Windows-Workflow wurde lediglich um den expliziten Offline-Testaufruf für V3 und die vorhandene Forschungstestdatei ergänzt, damit deren Integration auch dort tatsächlich geprüft wird. Keine Paid-QA-Aktion oder neue Pipeline.

## Umfang der Sicherheitsbelege

Die Gegenproben umfassen medizinischen Schwindel/Ohnmacht, Krebs/Tumor, Blutdruck, Stillzeit, Essstörung, Epilepsie, Ohrsymptome, Schmerzen, Trainingsfreigaben, negierte Arztbesuche, Datenschutz/Krise im ansonsten harmlosen Arztkontext, echte Rechts-/Zahlungsanliegen, STOP, Human/Pause, asynchrone Ownerwechsel, Link-/Booking-Verneinung, exakte Evidenz und vertrauenswürdige URLs. Bestehende Backend-, Budget-, Transport- und No-Send-Regressionen bleiben vollständig registriert und erfolgreich.

Die zusätzlichen Warnsignal-/Rechts-/Negationsfälle waren vor der jeweiligen Korrektur tatsächlich rot. Die vollständigen Originaldialog-Replays waren zunächst noch für V3-06 und V3-16 rot und erst nach den präzisen Korrekturen grün. Das ist keine bloße Lockerung eines Tests oder isolierte Text-Oracle-Prüfung.

## Kosten und Abnahmegrenze

**Neue externe OpenAI-Aufrufe:0. Neue API-Kosten:0 USD. Neue Reservierungen:0.** Keine erneute Ausführung oder Wiederverwendung alter kostenpflichtiger Chargen. Das bestehende Zusatz-QA-Ledger bleibt bei0,117460 USD Rest und0 offenen Reservierungen; kein Cap verändert oder zurückgesetzt. Standard-Linux-/Windows-Tests im bestehenden öffentlichen Repository, kein neuer externer Dienst.

Paid-Workflows auf dem Reparaturcommit:40206816969/40206816890/40206816906 skipped;40206816883 cancelled vor jedem Job (jobs=[]). Kein Cloudflare-Check und kein Deployment. Cloudflare ist laut Owner für Pete obsolet. Der persönliche Darth-Vader-Test bleibt ausschließlich am Laptop; weder seine Installation noch eine erneute freie Sol-Abnahme wird hier behauptet.

**Übergabe an die Projektleitung zur Qualitätsabnahme:** Die drei bekannten technischen Fehlerpfade sind auf dem geprüften Code geschlossen. Die neue freie GPT-6.1-Sol-Gesprächsqualität ist wegen der ausdrücklichen Vorgabe ohne zusätzliche API-Kosten nicht neu gemessen. Fachliche technische Reviewfreigabe und spätere echte Gesprächsabnahme bleiben zu unterscheiden; kein Live-, Merge- oder Deployment-Go abgeleitet. Bestehende Angebots-/Geschäftsentscheidungen wurden nicht umgeschrieben.
