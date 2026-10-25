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


## Abgeschlossene echte Qualitätsprüfung: NO-GO

Der korrigierte Lauf [40197907147](https://github.com/VSCodeBot78/funnelpilot-whatsapp-app/actions/runs/40197907147), Job121182652594, auf exakt `37f14830981da278b4dfa49262aa5d75a1b66e1d` ist beendet. Credential-Metadaten HTTP200, neue1,57-USD-Reserve vor jedem echten Lauf remote persistiert. Jede Providerantwort wurde zusätzlich im vorhandenen Engine-Budgetservice vorab reserviert und nach Usage abgerechnet.

**18/20 Szenarien vollständig technisch durchlaufen, Fall19 nur vier Lead-Turns, Fall20 nicht gestartet. 15/18 abgeschlossene Fälle bestehen das vorab dokumentierte manuelle Raster, drei fallen durch. Das ist KEIN bestandenes18/20-Yoda-Gate.** Fall16 enthält nur einen normalen Modelltext und ist zusätzlich deshalb kein positiver Dialogqualitätsbeleg. Vollständig durchlaufen bedeutet, dass alle sechs Lead-Nachrichten verarbeitet wurden; auch korrekte STOP-/Human-Unterdrückungen zählen als verarbeitete Turns, nicht als Antworten.

Auf korrigiertem Code:78 echte, frisch durch Provider-/Metering-Anstieg und passende Tokenfelder belegte LLM-Texte;79 abgerechnete Providerantworten insgesamt, davon eine verworfene Modell-Handoff-Antwort. Weitere tatsächliche Ausgaben:18 verified_transaction,2 guarded_safety,1 human_handoff,2 llm_handoff (einer davon Budgetstop ohne Provideraufruf).11 Nachrichten unterdrückt. 692.917 Input-/8.206 Output-Token,1,467894 USD gebucht. Keine offenen Reservierungen.

Zusammen mit dem ersten Diagnoselauf:83 abgerechnete Providerantworten,81 normale echte LLM-Texte,1,541598 USD neue interne Ledgerkosten. Das ist keine live geprüfte OpenAI-Gesamtrechnung oder Aussage über andere Sitzungen. Originalzusatzledger danach4,882540 von5 USD verbucht,0 reserviert, **0,117460 USD QA-Rest**. Alter8-USD-Topf weiterhin7,817830 verbucht. Kein Cap zurückgesetzt/erhöht. Im zweiten Lauf verhinderte `budget_exhausted` die nächste konservative Worst-Case-Reservierung bei0,102106 USD lokalem Chargenrest; dafür wurde keine neue Provideranfrage gestartet. Der geteilte Rest reicht nicht für die ausstehenden vollständigen Dialoge und die geforderten40DEV/12Holdouts. Keine Kleinstcharge oder Rerun zum Umgehen der Grenze.

### Manuelle Bewertung aller abgeschlossenen Fälle

Reihenfolge der fünf0–2-Dimensionen: Kontext / knappe empathische Führung / belegter persönlicher Nutzen / angemessener Next Step bzw. respektierte Ablehnung / Wahrheit und Grenzen. Individuelle fachliche Einschätzung nach direkter Transkriptlektüre, keine automatische Modellnote.

| Fall | Dimensionen | Punkte | Urteil | Beobachtung |
| --- | --- | --- | --- | --- |
| V3-01-check-overload | 2/1/2/2/2 | 9/10 | PASS | Kontext nach Essenshinweis korrigiert, drei Einstiegsfragen etwas schematisch; konkrete Hilfe und Methodenlink kommen an. |
| V3-02-keto-sleep | 2/2/2/2/2 | 10/10 | PASS | Keto bleibt optional; Familienessen und wenig Schlaf ohne Diätdruck, angefragter Infolink geliefert. |
| V3-03-bullshit-restart | 2/1/2/2/2 | 9/10 | PASS | Persönliche Begleitung statt PDF wird verstanden; Krankheitspause ohne Nachholzwang, geprüfter Kalenderlink. |
| V3-04-booking-preference | 2/1/2/2/2 | 9/10 | PASS | Abendpräferenz und Freitag-Ausschluss behalten; keine erfundene Verfügbarkeit/Buchung. |
| V3-05-price-partner | 2/1/1/2/2 | 8/10 | PASS | Partnerentscheidung respektiert; Leistungsübersicht länger und wenig priorisiert, Infolink korrekt. |
| V3-06-trial-truth | 1/1/0/0/2 | 4/10 | FAIL | Normale Probephasenfrage löst model_handoff aus; spätere reine Informationswünsche bleiben dauerhaft human_owned und unbeantwortet. |
| V3-07-benefit-usp | 2/1/1/2/2 | 8/10 | PASS | Nutzen wird nach Beschwerde konkreter; unnötig defensive USP-Formulierungen, Infolink kommt an. |
| V3-08-shift-context | 2/1/1/2/2 | 8/10 | PASS | Essen statt mehr Sport behalten; eine unpassende Zwischenfrage nach Familienalltag; später spezifische Einordnung und Kalenderlink. |
| V3-09-no-questions | 2/2/2/2/2 | 10/10 | PASS | Keine-Fragen-Grenze ab Turn3 über alle weiteren Antworten eingehalten; keine CTA/Termindruck. |
| V3-10-decline-contact | 2/2/1/2/2 | 9/10 | PASS | Keine Angebote/Links nach Ablehnung; Vertriebs-Opt-out bestätigt, spätere eingehende Nachricht nur quittiert. |
| V3-11-stop | 2/2/1/2/2 | 9/10 | PASS | STOP bestätigt, beide späteren Nachrichten stumm. Kein weiterer Provideraufruf nach STOP. |
| V3-12-human | 2/2/1/2/2 | 9/10 | PASS | KI-Identität klar, ausdrücklicher Human-Wunsch bestätigt; nachfolgende Nachrichten stumm. |
| V3-13-negated-booking | 2/2/2/2/2 | 10/10 | PASS | Kein Termin/Buchungslink trotz Interesse erzwungen; Verständnisfrage beantwortet und Bedenkzeit respektiert. |
| V3-14-informal-buy-path | 1/1/1/0/2 | 5/10 | FAIL | Nach vorläufiger Kauf-/Terminablehnung erneuter ausdrücklicher Anschauwunsch: sagt Buchungsmöglichkeit ansehen zu, liefert aber keinen Informationslink. Kein sicherer nächster Schritt. |
| V3-15-bad-experience | 2/1/2/2/2 | 9/10 | PASS | Vorerfahrung/Schlaf berücksichtigt, Nutzen mit Wiedereinstieg verbunden, kein Erfolgsversprechen; Infolink geliefert. |
| V3-16-doctor-incidental | 0/1/0/0/2 | 3/10 | FAIL | Bereits ärztlich begleitete Hüfte und ausdrücklich keine Diagnose erbeten: Safety-Handoff friert auch allgemeine Methoden-/Infofragen ein. Keine unsichere Medizinantwort, aber funktional unbrauchbarer Abbruch. |
| V3-17-budget-boundary | 2/2/1/2/2 | 9/10 | PASS | Haushaltsbudget respektiert, keine Schulden/Ratenversprechen; negierte Raten-Erwähnung löst unnötigen Standardhinweis aus. |
| V3-18-context-continuity | 2/2/2/2/2 | 10/10 | PASS | Süßhunger statt Trainingsneustart behalten; Feedback ohne neue Frage verarbeitet, persönlicher Nutzen und Kalenderlink. |

Fall19 bleibt unbenotet, weil nach drei echten Modelltexten vor der vierten Antwort die Kostenreserve scheiterte. Die dortige generische Human-Meldung stammt aus dem konservativen Engine-Fehlpfad, nicht aus einem weiteren Sol-Text. Fall20 wurde nicht ausgeführt. Die vorgelagerten Texte, Quellen, Tokens und Kosten beider Läufe stehen vollständig in `pete-v3-sol-qa-20261025.json`.

### Drei offene Fehler für die Projektleitung

1. **Probephase / V3-06:** Die Variante „Zusammenarbeit testen“ fällt nicht unter den engen Coaching-/Begleitung-Kontext der verifizierten Probeantwort; reales Modell-Handoff sperrt dann auch spätere Informationsfragen. Keine Probephase erfinden; sichere Ungewissheit erklären, Informationsdialog ermöglichen, echte Sondervertragsentscheidungen bei Jochen belassen.
2. **Unverbindliches Anschauen / V3-14:** Nach vorläufigem „noch nichts kaufen“ verhindert die persistente Sales-Opt-out-Grenze den später ausdrücklich erbetenen Infolink. Erkennbarer nächster Schritt fehlt. Die Sperre automatischer Verkaufsnachrichten muss erhalten bleiben; ein neuer eigener Informationswunsch darf keine allgemeine Send-/Marketingfreigabe erzeugen. Noch nicht repariert.
3. **Ärztliche Behandlung ohne Diagnosewunsch / V3-16:** Medizinische Schlagwörter führen zum permanenten Safety-Handoff, auch für danach angefragte allgemeine Informationen. Kein Beweis eines unsicheren medizinischen Rats. Eine Korrektur muss echte medizinische Grenzen erhalten und bloß allgemeine Methodeninformationen getrennt behandeln. Noch nicht repariert.

Der erste belegte `next_step_denied`-Abbruch ist im korrigierten Fall01 behoben: Sachfrage beantwortet und Infolink erreicht. Fall04 und14 zeigen außerdem, dass abgelehnte Vorschläge ohne neue Aktion als separat geprüfter Modelltext weiterlaufen. Der weiterhin fehlende Infolink in14 ist ein eigener persistenter Grenzfall, kein behaupteter Erfolg des Fixes.

In den beobachteten Turns keine kritische STOP-/Human-/No-Questions-/Preis-/URL-/Buchungsbestätigungsgrenzverletzung festgestellt. Das ist eine begrenzte Beobachtung, keine Freigabe sämtlicher Situationen. Die5-Wochen-/499-EUR-Angaben stimmen mit dem bestehenden Offer-Truth-Code überein; der bekannte geschäftliche5-/8-Wochen-Abgleich bleibt vor Vertrags-/Live-Freigabe offen.

### Technische Belege und Grenzen

Linux-CI [40197907109](https://github.com/VSCodeBot78/funnelpilot-whatsapp-app/actions/runs/40197907109) und Windows-CI [40197907114](https://github.com/VSCodeBot78/funnelpilot-whatsapp-app/actions/runs/40197907114) SUCCESS auf dem korrigierten Runtime-Code, alle vier Joblogs gelesen.621 Backend-,25 Desktop-,26 Starter-/Budget-,9 Proxy-,9 Chromium-/React-,10 weitere Budgettests,103 Dashboardtests, beide Builds/Audits0. Windows zusätzlich echter WinPS5.1-/CMD-/Dirty-Worktree-/Release-Recovery-Vertrag. Lokal gleicher Build/621+25+26 PASS, git diff --check PASS. Ein während der Entwicklung entdeckter Methodenlink-Regressionsfehler wurde tatsächlich korrigiert und unverändert streng neu geprüft.

Keine Live-Sends, echten Buchungen, Merges oder Deployments. Keine neue App/Agent und keine Secretweitergabe. Kein Cloudflare-Check auf den drei neuen Runtime-/QA-Commits. Die alte Cloudflare-Kontoverknüpfung wurde nicht verändert; Owner erklärt Cloudflare für Pete ausdrücklich obsolet. Keine tatsächliche Installation oder freie Darth-Vader-Abnahme am Owner-Laptop durchgeführt. Authentifizierte Desktop-HTTP-/UI-Scope- und Fehlerverträge wurden kostenlos geprüft; die hier bewerteten Sol-Texte stammen aus dem isolierten GitHub-Engine-Test.

**Übergabeurteil: technisch geprüfter Entwicklungsstand mit offen dokumentiertem Qualitäts-NO-GO. Kein PL-, Owner-Darth-Vader-, Live-, Merge- oder Deployment-Go.** Nächster Schritt: Projektleitung priorisiert die drei real belegten Korrekturen und einen anschließend regulär ledgergedeckten Mehrturn-Re-Test. Die bestehende3-USD-Ownerfreigabe ist bereits vorhanden; sie hebt den verbleibenden persistenten QA-Rest von0,117460 USD nicht auf.
