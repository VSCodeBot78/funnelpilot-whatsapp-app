# Flexible interne Pete-QA-Grants: technische Übergabe

Stand: 25.10.2026, Europe/Berlin. Auftrag: PETE_MASTER_STATE 121/122 und [PR-Kommentar 6400728469](https://github.com/VSCodeBot78/funnelpilot-whatsapp-app/pull/191#issuecomment-6400728469).

**Ergebnis: Budgettrennung technisch bestanden, bereit zur Abnahme der Projektleitung.** Ausschließlich vorhandener PR #191 und bestehender Ledger-Zweig. Keine neue App, Agenten, Dienste oder Workflows. Keine echten OpenAI-Anfragen, auch keine Modell-Metadatenabfrage; zusätzliche Providerkosten **0 USD**. Keine Live-Sends, Merges oder Deployments.

## Tatsächliche Commits

| Commit | Änderung |
| --- | --- |
| `d02dbfa925d907a401e2fcca42ad16629128466d` | Gemeinsamer Grant-Vertrag, gitbestätigter Provider-Adapter, isoliertes lokales Run-Ledger und Tests |
| `e90e54b84fe09250f76ab174fb19ff58e2ff4ed3` | QA-Status bilanziert keinen vermeintlichen alten Pete-Rest |
| `3bce329cbbf4a2d087606933dfdf9bf0621afdf6` | Null Eingabetokens sind kein Abrechnungsbeleg; Reservierung bleibt bestehen |
| `e9eb66e7795a866db10be33c4d0abef1555078b7` | Ausschließlich Ledger-Zweig: separate bereits belegte 3-USD-Freigabe angelegt, nichts reserviert oder verbraucht |

Geprüfter Runtime-Tree: `9dd85d8cf4d74e94e4c2ea29b0e2df293aea9e95`. Die parallelen Forschungsdateien `pete-llm-conversation.ts` und `pete-real-qa-turn-guidance.test.ts` sind gegenüber Ausgangsstand `66d9fdf` unverändert. Keine Änderung an Angebot, Dialogregeln oder Kunden-/Desktop-Freigaben.

## Persistentes Budget und Rücklesen

Ledger: bestehender Branch `pete-phase3-budget-ledger`, Datei `phase3-budget-ledger.json`. Nach regulärem Write erneut über GitHub gelesen, Blob `b23593384f3cbd5a29e0053d25508432558e1fc5`, Commit `e9eb66e`. Der gesamte JSON-Bestand außerhalb des neuen Registers stimmt mit dem vorherigen Blob `35d7fb2` überein; vorhandene historische Objekte wurden beim Anhängen im Text erhalten.

| Konto | Obergrenze | Verbucht | Reserviert | Rest |
| --- | ---: | ---: | ---: | ---: |
| Historische Basis | 8,000000 USD | 7,817830 USD | 0 | 0,182170 USD |
| Historisches Extra `extraOwnerQa20261022` | 5,000000 USD | 4,882540 USD | 0 | 0,117460 USD |
| Neuer interner QA-Grant | 3,000000 USD | 0 | 0 | 3,000000 USD |

Kein OpenAI-Kontoguthaben und keine Rechnungsabfrage. Die alten Reste werden nicht auf den neuen Grant umgebucht.

- Grant-ID: `qa-20261025-owner-sol-separate-3usd`.
- Owner-Referenz: `owner:2026-10-25-separate-sol-3usd`.
- Freigabebeleg: obiger Owner-/PL-Kommentar und Master 121/122.
- Autorisierungs- und initialer History-Hash: `94a0fb832eefdc4194f26c5f27a6a36bd82b63446763594609a4534157d3ce7c`.
- Zweck ausschließlich synthetische Pete-Sol-QA im vorhandenen Repository, Modell `gpt-6.1-sol`.
- Vorhandene Approval-Datei v2 beantragt zunächst maximal 2,00 USD aus diesem Grant. Sie führt selbst keine Reservierung und keinen Test aus.

Die tatsächliche gitbasierte Grant-Historie aus den zwei echten Ledger-Snapshots wurde zusätzlich lokal mit dem produktiven Vertragsprüfer validiert: PASS. Beide GitHub-Refs wurden nach der Buchung erneut gelesen.

## Durchsetzung im vorhandenen Providerpfad

Der bestehende Budgetservice prüft vor jeder neuen Providerreservierung die GitHub-Actions-/Secret-/Modell-/No-Send-Bedingungen, isolierten Datenpfad, aktuellen Source-SHA, unveränderten Quellstand und die exakte Übereinstimmung des lokalen Ledger-Commits mit dem entfernten Ledger-Ref. Eine lokale Datei oder eine Environment-Betragsangabe ist keine Freigabe.

Der gemeinsame Vertrag rekonstruiert Zähler aus einer Hash-Kette; der Adapter vergleicht diese mit der vollständigen versionierten Git-Historie. Änderungen an bereits belegten Freigaben, historische Resets, zurückgesetzte oder neu gehashte Nutzungshistorie und entfernte Grants scheitern. Der bestehende QA-Workflow lädt deshalb die vollständige Ledger-Historie. Sein expliziter Paid-Trigger und alle No-Send-Bedingungen bleiben erhalten.

Reserviert wird vorab pro eindeutigem GitHub-Run. Ein fehlgeschlagener Push oder ein veralteter Ref stoppt vor dem Provider. Der native Git-Test mit zwei unabhängigen Klonen bestätigt: Der zweite konkurrierende Push wird abgelehnt, genau ein Hold bleibt im entfernten Test-Repository.

Jede Modellanfrage wird innerhalb des bereits persistent gehaltenen Run-Betrags nochmals konservativ lokal reserviert und unter dem vorhandenen Dateilock verbucht. Fehlendes/gelöschtes Run-Ledger startet niemals bei null neu. Pending-Nutzung sperrt weitere Anfragen. Bei fehlendem Usage, Timeout, widersprüchlichen Kosten, null Eingabetokens oder fehlendem passendem Abschlussbeleg bleibt der gesamte entfernte Hold ungeklärt reserviert. Ein späterer automatischer Settlement-/Refund-Versuch ist dann gesperrt; eine Klärung verlangt einen ausdrücklich geprüften Buchhaltungsschritt.

Nur vollständig abgeglichene, zum Grant/Run/Source passende meterte Nutzung reduziert den Hold auf die belegten Istkosten. Zwei Runs mit maximal 2 USD und 1 USD teilen dieselbe 3-USD-Obergrenze. Geringere Istkosten bleiben korrekt verfügbar. Neue spätere Freigaben benötigen neue geprüfte Ledger-Einträge und Approval-Konfiguration, keine Änderung eines Betrags im Runtime-Source. Kein Auto-Nachladen.

## Tatsächliche kostenlose Prüfungen

Lokaler finaler `npm run check`: TS-Build, **25 Desktoptests, 679 Backendtests, 36 Starter-/Relay-/Budgettests PASS**, 0 FAIL/0 SKIP. Dashboard: **103 Tests PASS**, beide Vite-Builds PASS. Beide `npm audit --audit-level=high`: **0 Schwachstellen**. Zusätzliche zehn historische Restbudgettests PASS; `git diff --check` PASS.

Finale Runtime-CI auf `3bce329cbbf4a2d087606933dfdf9bf0621afdf6`:

| Lauf / Job | Tatsächliches Ergebnis |
| --- | --- |
| [Linux 40223415125](https://github.com/VSCodeBot78/funnelpilot-whatsapp-app/actions/runs/40223415125), Backend `121259667262` | Build, 25/679/36 Tests, 9 echte Express/Vite-Proxy-, 9 Chromium/React- und 10 Restbudgettests PASS; Audit 0 |
| Derselbe Lauf, Dashboard `121259666983` | 103 Tests und beide Builds PASS; Audit 0 |
| [Windows 40223415128](https://github.com/VSCodeBot78/funnelpilot-whatsapp-app/actions/runs/40223415128), `121259666950` | 25 Desktop-, 42 Grant-/Vertrag-/Provider-, 102 V3-/Kontext-, 9 Proxy- und 9 Browsertests PASS |
| Derselbe Lauf, `121259666722` | Tatsächlicher WinPS5.1-Parser, CMD-Pfadübergabe, Schutz lokaler Änderungen und unterbrochene Release-Recovery PASS |

Alle vier finalen Rohlogs gelesen, Checkout-SHA geprüft. Vorstufen `d02dbfa` und `e90e54b` bestanden ebenfalls Linux und Windows; maßgeblich sind die finalen Zahlen oben.

Strenge Negativtests umfassen fehlende Freigabe, falsche Approval-Ref, manipulierte Historie/Cap/Restwerte, Cross-Grant-/Legacy-Replay, Retry, parallele Holds und native Push-Kollision, Source-/Ledger-Ref-Abweichung, fehlenden Secret-/No-Send-Schutz, fehlende/gelöschte Receipt, Timeout, fehlendes oder unmögliches Usage sowie STOP, Human Ownership und Sales-Follow-up-Opt-out.

**Tatsächlich erst rot, dann behoben:** Die zusätzliche Null-Token-Probe zeigte vor dem letzten Fix zwei fehlschlagende Sicherheitsfälle im Vertrag und echten Provider-Service. Nach dem Fix bestehen beide streng. Keine Assertion gelockert. Der erste neue Opt-out-Test verwendete anfangs den falschen Flag-Namen; er prüft jetzt den vorhandenen `salesFollowUpsOptedOut` samt automatischer Follow-up-Sperre.

Lokale Browserumgebung: Zunächst fehlten Chromium/Chrome. Nach Installation des vorhandenen Playwright-Testbrowsers gab Node 24 lokal nur einen Teilverlauf aus; dies wird ausdrücklich nicht als vollständiger Browser-PASS gewertet. Die vollständigen jeweils neun Browserprüfungen sind mit Node 22 auf echtem Linux- und Windows-CI belegt. Kein Dialog-/Runtime-Fix dafür behauptet.

## Kosten- und Übergabestatus

Die regulären GitHub-Schreibaktionen wurden angenommen; keine erneute Sicherheitsblockade und keine Umgehung. Für die neue 3-USD-Freigabe existieren nach Rücklesen **0 Reservierungen und 0 Buchungen**.

Die wiederverwendbaren Paid-Jobs für alle drei Codecommits liefen nicht: beim ersten Commit Job `founder-qa` ausdrücklich SKIPPED, bei den beiden folgenden abgebrochene Workflow-Hüllen ohne Jobs. Auch die historischen Paid-Jobs sind SKIPPED bzw. ohne Jobs. Kein Secret-/Modell-Metadaten-Preflight wurde gestartet. Keine Cloudflare-Ausführung.

**Nächster Schritt:** Projektleitung nimmt die Budgetintegration ab. Erst danach kann sie den bereits genehmigten echten QA-Lauf über den bestehenden expliziten Trigger starten, nach erneutem Lesen beider Refs und erfolgreicher persistenter Reservierung. Work startet keinen Paid-Test. Echte Gesprächsqualität, Yoda und Owner-Darth-Vader wurden durch diese kostenlosen Budgettests nicht neu gemessen.


## Projektleitung: freigegebener realer Sol-Teststart, erste Charge

25.10.2026. Unabhängige fachlich-technische PL-Abnahme des separaten QA-Grants siehe [PR-Kommentar 6401929297](https://github.com/VSCodeBot78/funnelpilot-whatsapp-app/pull/191#issuecomment-6401929297). Owner hat ausdrücklich **höchstens 3 USD** für echte GPT-6.1-Sol-Qualitätstests freigegeben. Der erste bestehende QA-Auftrag `qa/pete-approved-test.json` reserviert daraus **höchstens 2,00 USD** (20 vorab festgelegte Sechs-Turn-Fälle) und bleibt die einzige beantragte Charge dieses Trigger-Commits. Ein verbleibender Rest löst **keinen** zweiten Lauf automatisch aus.

Dieser Commit ist ausschließlich die explizit autorisierte Auslösung des vorhandenen GitHub-Test-Workflows. Er verändert keinen Runtime-Code. Dieser Eintrag ist **kein Testresultat**: Ein realer Providerstart ist erst nach bestandenem kostenlosem CI-/Credential-Preflight und erfolgreich **remote persistierter** Run-Reservierung zulässig. Bei Fehlschlag kein Rerun, kein Budget-Reset, keine falsche Qualitätsnote. IG/WA, Kalender, Checkout und Deployment bleiben aus. Der persönliche Darth-Vader-Test sowie Merge-/Live-Freigabe bleiben offen.
