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
