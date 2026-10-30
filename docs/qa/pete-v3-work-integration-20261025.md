# Pete V3: Integration und technischer Prüfnachweis

Stand: 25.10.2026, Europe/Berlin. Entwicklungszweig `feat/pete-policy-v4-20261022`, bestehender Draft-PR #191. Ausgangscommit `ec59327696c213faac2fc37c9b5f5799ff2f06d8`, Ausgangstree `6255b989ce577fab0ad97c18a6eefbe7024e1a6f`.

## Ergebnis und Grenzen

Der bestehende Konversationspfad beantwortet ausdrückliche Termin- und Angebotsinfo-Anfragen mit serverseitig verifizierten Links, statt gewöhnliche Anfragen an ein unnötiges dauerhaftes Human-Handoff zu verlieren. Die bestehende Policy V4, derselbe Responses-Aufruf und die vorhandenen Ownership-, STOP-, Medizin-, Privacy- und Transportgrenzen bleiben maßgeblich. Es gibt keine zweite Engine, App oder neue Agenten.

Dieser Bericht belegt kostenlose technische Prüfungen. Er erteilt **keine echte KI-Qualitäts-, Owner-, Live-, Merge- oder Deploymentfreigabe**. Frische Sol-Dialoge wurden nicht ausgeführt: In der Work-Umgebung fehlen ein echter Provider-Schlüssel und die authentifizierte Besitzer-Desktop-Session samt aktuellem persistentem Ledger. GitHub-Publikation und deren neue CI müssen am tatsächlichen PR-HEAD separat zurückgelesen werden. Alte CI-Erfolge werden nicht auf einen neuen Commit übertragen.

## Tatsächliche Änderungen

- Reiner `pete-semantic-action-guard.ts`: Vorschläge `none`, `offer_info`, `booking`; Literalbeleg aus dem letzten wirklichen Lead-Turn; HTTPS und exakte vertrauenswürdige Hostlisten; keine Preise, Checkout-Auswahl, Buchung, WhatsApp-Nachricht oder Versandberechtigung aus Modelltext. `outboundAuthorized` bleibt immer `false`. Die Integration nutzt die vorhandene Founder-Konfiguration. Ein späterer Tenant-Adapter muss eigene authentifizierte Linkkonfiguration bereitstellen; dies ist keine SaaS-Freigabe.
- Normale ausdrückliche Wünsche passieren zuerst den geprüften Transaktionspfad. Verneinte Links/Termine, bloße Sachfragen, fremde Arzttermine, Modellanweisungen/Zitate, Fragegrenzen, Sales-Opt-out, STOP, Pause und menschliche Übernahme autorisieren keine neue CTA. Eine reine Zeitangabe kann nur auf einen vorherigen echten Terminwunsch und eine anschließende Verfügbarkeitsfrage antworten. Sie erfindet keinen freien Slot und keine Buchungsbestätigung.
- Angebotsanschauen, auch mit später eventuell gewünschter Buchung, führt zum Methoden-/Infolink. Die bestehende abgesicherte Checkout-Logik wird nicht durch eine Modellentscheidung erweitert. Eine nicht belegte Probe-/Kennenlernphase wird als ungeklärt benannt und nicht zugesagt. Der bestehende 5-Wochen-/499-EUR-Katalog wurde nicht in einen unbelegten 8-Wochen-Vertrag umgeschrieben.
- Das vorhandene strikte JSON-Schema derselben Modellantwort enthält zusätzlich `nextStep` und `evidenceQuote`. Alte gespeicherte/mockbare Antworten ohne beide Felder bleiben ausschließlich normaler Text ohne Aktionsberechtigung. Halbe, unbekannte oder Checkout-Vorschläge scheitern. Erfolgreiche serverseitig gerenderte Links heißen weiterhin `verified_transaction`, auch wenn dafür ein Modellvorschlag verwendet wurde. Verifizierter Providerverbrauch bleibt separat sichtbar.
- Die erste gewöhnliche eigene Antwort nennt Pete als Jochens KI-Assistenten, auch wenn sie deterministisch ist. Die Vorstellung wird im weiteren Dialog nicht ständig wiederholt; der Kontinuitätsvergleich berücksichtigt die serverseitige Einführung.
- Technische Provider-, JSON- und Budgetfehler sind ausschließlich im authentifizierten Desktop-Anfrage-Scope als `lab_error` sichtbar, ohne eine persönliche Übernahme vorzutäuschen. Kein automatischer Retry, keine Freigabe zusätzlicher Kosten, ungeklärter Verbrauch bleibt reserviert. Echte Human-Wünsche/`model_handoff` und alle Live-Fehlpfade behalten die menschliche Eskalation. STOP, Human Takeover, Superseding und KI-AUS werden nach dem asynchronen Aufruf erneut geprüft.
- Historischen Singularfehler `keine Verkaufsnachricht`/`Werbenachricht` korrigiert. Vier bisher nicht registrierte Stress-/Opt-out-Suiten werden jetzt in `npm test` ausgeführt. Der Opt-out-Test verlangt nun eine deterministische Bestätigung ohne API-Aufruf und prüft danach weiterhin die persistente Sperre aller automatischen Nachfasswege. Eine veraltete wortwörtliche Prompt-Assertion wurde auf die vorhandene gleichbedeutende Wiederholungsregel aktualisiert; keine tatsächliche Schutz-Erwartung wurde entfernt.
- Abhängigkeiten: kritische/hohe Auditbefunde behoben. Vite `6.4.5` mit dem vorhandenen React-Plugin statt einer unnötigen Vite-8-Migration; transitive Aktualisierungen und `qs: 6.16.1` als expliziter kompatibler 6.x-Override. Backend und Dashboard liefern im aktuellen vollständigen `npm audit --json` jeweils **0 Befunde**. Der bestehende Offline-CI-Workflow prüft zusätzlich beide Audits mit `--audit-level=high`.

## Ausgeführte kostenlose Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| Backend `npm run build` | PASS, strenges TypeScript/NodeNext |
| Backend `npm test`: Desktop-Scope/Budget | 25/25 PASS |
| Backend `npm test`: gesamte registrierte Suite | 610/610 PASS, einschließlich 40 neuer V3-Integrationstests |
| Backend `npm test`: Starter/Relay/QA-Verträge | 25/25 PASS |
| Backend gesamte Suite zusätzlich unter Node 22.23.4 | 25 + 610 + 25 PASS |
| Dashboard `npm run build` | 103/103 Tests und beide vorhandenen Vite-Builds PASS |
| Echter Vite-/Express-Desktop-Proxy | 9/9 PASS |
| Echtes Chromium/React, Origin/CSRF und KI-AN/AUS | 9/9 PASS, 0 externe Provideraufrufe |
| Separate Resume-/Round2-Budgetverträge | 10/10 PASS |
| `npm audit` Backend und Dashboard | jeweils 0 low/moderate/high/critical |
| `git diff --check` | PASS |

Keine Testzahl in dieser Tabelle ist eine Zahl bestandener echter Sol-Gespräche. Token-/Kostenwerte in Mocktests sind synthetisch.

## Unabhängiger Blick auf echte Gesprächsqualität

Die ursprüngliche Datei `Pete Test 25.10.2026 - Google Docs.pdf` wurde direkt gelesen (6 Seiten, vier frei formulierte Besitzer-Dialoge), nicht aus Unit-Testergebnissen nachbewertet. Der dortige Stand verfehlt 4/4 sichere nächste Schritte: ungeklärte Probephase, angenommener Telefontermin mit anschließender Zeitangabe, ausdrücklicher Telefontermin, unverbindliches Anschauen des Buchungswegs. In zwei Gesprächen muss der Lead erst nach der KI-Identität fragen. Im vierten werden Leistungen mehrfach umformuliert, ohne den Einwand entscheidend voranzubringen.

Der neue Code reproduziert die kritischen Übergänge einschließlich Zeitangabe mit echtem vorherigem Lead-Wunsch, umgangssprachlichem Terminwunsch und unverbindlicher Angebotsansicht technisch. Das sind **Mock-/Engine-Regressionen**, keine neue Bewertung echter Sol-Antworten. Die ursprünglichen Laufzeit-FailureReasons/Tokenbelege für die vier alten Gespräche fehlen im PDF weiterhin. Eine konkrete alte Provider-/JSON-Fehlerursache wird deshalb nicht behauptet.

Die 40 Mentor-DEV-Dialoge sind kein ausgeführter echter Modelllauf. Die 12 getrennten Mentor-Holdouts wurden nicht für Prompt-Tuning geöffnet oder als bestanden ausgegeben. Neue freie mehrstufige Sol-Gespräche und mindestens 18/20 Yoda-Fälle fehlen. Wiederholungen, persönlicher Nutzen und angemessene freie Gesprächsführung sind damit noch nicht neu zertifiziert.

## Kosten, Publikation und nächstes Gate

- Tatsächlich neue echte Modellaufrufe: **0**, neue reale API-Kosten: **0 USD**. Keine Secrets übernommen oder in Bericht/Code kopiert. Die 3-USD-Freigabe hebt bestehende Ledgergrenzen nicht auf. Der unveränderte Code nennt 13 USD Projektdeckel und mindestens 11.158772 USD frühere Buchungen, also höchstens 1.841228 USD vor weiteren unbekannten Buchungen. Dies ist kein aktueller Verfügbarkeitsnachweis.
- Alle 16 vorhandenen GitHub-Workflows auf Auslöser geprüft. Bezahlte Jobs benötigen spezielle, von diesem Entwicklungscommit abweichende Commitpräfixe/Branches. Die Offline-Jobs enthalten keine Merge-/Deploy-Kommandos. Für eine regulär erlaubte GitHub-Publikation ist ausschließlich das vorhandene Draft-PR vorgesehen; `[CF-Pages-Skip]` unterdrückt den bekannten alten Pages-Deploy, ohne die normalen GitHub-Tests zu überspringen. Keine Providerkontoeinstellungen wurden geändert.
- Historische Schreibblockaden werden nicht durch andere Credentials, Dateipfade, Git-Push oder andere Schreibwerkzeuge umgangen. Ein zurückgewiesener regulärer Schreibaufruf muss mit seinem genauen Resultat gemeldet werden. Kein Merge, Deployment, Live-Send, echter Kalendertermin oder neue Projektstruktur.
- Nächstes fachliches Gate: aktueller veröffentlichter Commit mit grüner Linux-/Windows-CI und anschließend echte freie Sol-Prüfung in der gesicherten Desktop-Session innerhalb des nachgewiesenen Restledgers. Bis dahin **kein Darth-Vader-/Live-Go**. Keine manuelle ZIP-Installation als fertiges Ergebnis.

## Quellen

- PETE_MASTER_STATE, insbesondere 90 bis 101, vor Arbeitsbeginn über Google Drive gelesen.
- Originalquelle: [PR #191](https://github.com/VSCodeBot78/funnelpilot-whatsapp-app/pull/191), Ausgangs-SHA und originale Git-Blobs geprüft; vollständiger regulärer Git-Fetch erfolgreich.
- [Vite 6: Migration von Vite 5](https://v6.vite.dev/guide/migration), [unterstützte Vite-Versionen](https://vite.dev/releases).
- [Cloudflare Pages: offizielles Commitpräfix zum Überspringen eines Deployments](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/#skipping-a-build-via-a-commit-message).
