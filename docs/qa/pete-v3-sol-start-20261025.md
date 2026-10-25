# Pete V3: sicherer Start der vorhandenen Sol-QA

Owner-Go nach dem belegten Blocker aus PETE_MASTER_STATE 108, 25.10.2026.
Bestehender Branch `feat/pete-policy-v4-20261022`, Draft-PR #191.

Der bestehende Push-Workflow verlangt jetzt beide Präfixe zusammen:
`[CF-Pages-Skip] PETE_QA_APPROVED_RUN:`. Damit wird Cloudflare Pages regulär
übersprungen und die ausdrückliche QA-Absicht bleibt erforderlich. Alte QA-Starts
ohne Deploy-Sperre werden abgewiesen. Repository, Branch, erster Run-Versuch,
Provider-Secret, Modell, sämtliche No-Send-Flags, Owner-Manifest und persistente
atomare Ledgerreservierung bleiben verpflichtend. Kein Workflow-Dispatch oder
Rerun als Ersatz, keine neuen Secrets oder Konten. Ledger- und Budgetservice
bleiben unverändert. Ein regulär zurückgewiesener Schreibaufruf wird nicht umgangen.

Der vorhandene Runner kann zusätzlich sechs bis zwölf frei formulierte Lead-Turns
pro synthetischem Fall ausführen. Die zwanzig Entwicklungsfälle enthalten je sechs
Lead-Turns, also bis zu zwölf Nachrichten einschließlich Pete-Antworten. Die alten
kurzen Fälle bleiben lesbar. Die separaten Mentor-Holdouts werden nicht geöffnet.
Keine automatische Qualitätsnote und kein künstlicher Lead- oder Bewertungsagent.

Jede Ausgabe erfasst Quelle, echte Emission versus Unterdrückung, tatsächlichen
Provider-/Metering-Zähleranstieg, Modell, Token, bestätigte Kosten, verbleibende
Reservierung und Fehler. Stale LLM-Felder nach STOP/Human zählen nicht als neue
Modellantwort. Ein serverseitiger verifizierter Link bleibt Regeltext, auch bei
vorherigem Modellverbrauch. Teilgespräche werden bei Kostenstopp erhalten und
nicht als abgeschlossen gezählt. Ungeklärter Providerverbrauch stoppt ohne Retry.

Vor einem kostenpflichtigen Start müssen kostenlose Build-/Sicherheitsprüfungen
auf dem vorbereiteten Code erfolgreich sein. Eine neue Owner-Charge wird separat
eingetragen, ausschließlich aus dem bereits ausdrücklich genehmigten Umfang.
Am Ausgangsledger `5822b3d7e35ac74b62ff0eaba221755cb46bdf30` sind 1,659058 USD
im zulässigen QA-Topf frei. Vor der Reservierung erneut verifizieren; höchstens
1,65 USD in ganzen Cent, niemals die vollen 3 USD unterstellen oder einen alten
Approval-Beleg wiederverwenden. Der bestehende Workflow prüft das Modell-Credential
ohne Tokenverbrauch, persistiert dann erst die Reserve und ruft die Engine auf.

Diese Vorbereitung behauptet keine neue erfolgreiche Sol-Antwort. Tatsächliche
Run-IDs, SHAs, Dialogbewertung und abgerechnete Kosten werden erst nach dem Lauf
im vorhandenen PR und Master ergänzt. Falls die Freigabe-/Providerstrecke blockiert
oder das Budget nicht für zwanzig vollständige Dialoge reicht, bleibt das
Qualitätsgate offen. Kein Merge, Deployment oder Live-Send.

## Erster echter Lauf und eng begrenzte Korrektur

Run `40197233847`, Source `c460464e0bab89d7790d678c7f2eb5593d4b9ab9`:
Credential-Metadaten HTTP 200; 1,65 USD vor Modellaufrufen remote reserviert.
Vier erfolgreiche, abgerechnete Sol-Antworten: drei normale Modelltexte und eine
abgelehnte Modellantwort, die als `llm_handoff` erschien; zusätzlich ein
serverseitiger CHECK-Link. 35.042 Input-/362 Output-Token, 0,073704 USD gebucht,
keine offene Reservierung. Kein vollständiger Sechs-Runden-Fall, kein Yoda-Score.

Die fünfte Lead-Nachricht war eine normale Sachfrage zur Begleitung. Ein vom
Modell vorgeschlagener Next Step scheiterte am unveränderten Guard, danach wurde
der Chat durch `invalid_output / next_step_denied` dauerhaft menschlich übernommen.
Der Lauf stoppte sofort. Der rohe verworfene Antworttext ist nicht gespeichert;
eine Aussage über dessen genaue Formulierung wird nicht erfunden.

Korrektur: Ein nicht autorisierter Vorschlag bleibt ohne Aktion. Die separat
validierte, URL-/preisfreie Modellprosa läuft jedoch weiter durch dieselben
Wahrheits-, Kontinuitäts- und Fragegrenzen. Ein verworfener Handlungsvorschlag ist
kein Human-Takeover-Wunsch. Schemafehler, gefährliche Texte, echte Human-Wünsche,
Provider-/Budgetfehler und alle asynchronen Ownership-Prüfungen bleiben gesperrt.
Diagnose `peteSemanticProposalRejected` markiert echte Modelltexte nach verworfenem
Vorschlag. Regressionen prüfen Weiterreden ohne Buchung/Linkberechtigung sowie
weiterhin blockierte Modell-URLs, Preise und Buchungsbestätigungen.

Owner-Klarstellung: Cloudflare war nur für das nicht mehr verwendete Handy-Feature.
Pete benötigt keine Cloudflare-Auslieferung. Der spätere persönliche
Darth-Vader-Test bleibt ausschließlich am Laptop. Die unabhängige Sol-QA läuft
im bestehenden isolierten GitHub-Testbackend. Die alte Cloudflare-Verknüpfung
wird per offiziellem Skip-Präfix ausgelassen; keine Kontoeinstellung deaktiviert
oder deren Deaktivierung behauptet.

Lokaler Korrekturcheck: TS-Build, 25 Desktop-, 621 Backend- und 26 Starter-/Budgettests PASS. Zusätzlich ausdrückliche Methodenlink-Bitte und ihre Verneinung abgesichert. Neue Korrekturcharge maximal 1,57 USD mit eigener Approval-Ref; zusammen mit den 0,073704 USD des ersten Laufs höchstens 1,643704 USD. Kein Rerun der verbrauchten ersten Charge.
