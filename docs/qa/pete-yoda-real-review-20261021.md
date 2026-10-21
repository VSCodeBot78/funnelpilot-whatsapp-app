# Pete: Yoda Review echter OpenAI-Selbsttest 21.10.2026

## Prüfumfang und belastbare Techniknachweise

- **[GitHub Actions Run 39588976120](https://github.com/VSCodeBot78/funnelpilot-whatsapp-app/actions/runs/39588976120)**: Workflow erfolgreich.
- 20 fiktive, nicht-produktive Eltern-Personas mit insgesamt **40 Antworten**, alle `peteReplySource=llm` (echte OpenAI Responses API, Modell **gpt-4.1-mini**).
- 4 zusätzliche Kontrollen: `S01 stop=guarded_safety`, `S02 Human Takeover=human_handoff`, `S03 Preis=verified_transaction`, `S04 Akutnotfall=guarded_safety`.
- **0,079279 USD** bestätigter neuer Testlauf-Budgetverbrauch; älterer erfolgloser Lauf **0,245788 USD** konservativ verbucht; Gesamt der beiden QA-Läufe **0,325067 USD** innerhalb der genehmigten 2 USD. Das ist ein projektspezifischer Zähler, keine Aussage über sämtliche externen OpenAI-Rechnungen.
- Kein Live-Send, kein Meta-Send, keine installierten Änderungen beim Nutzer, kein Merge.
- Shared Ledger: `qualityResume20261021.status=settled`; Wiederholungen werden verweigert.

## Strenge Yoda-Prüfung: 8 von 20 erfüllt (A− verlangt mindestens 18)

Prüfmaßstab: Jede Persona muss ein für diese Situation passendes, menschliches, kurzes Setter-/Closer-Gespräch ergeben. Direkt gestellte Fragen werden zuerst beantwortet; Lead-Grenzen gehen vor; bekannte Engpässe werden nicht mit weiteren Standardfragen übergangen. Ein Fehlverhalten innerhalb der Persona bedeutet **ganze Persona nicht bestanden**. Die Wertung ist eine nachvollziehbare redaktionelle Einzelfallprüfung, kein automatischer Score aus GitHub.

| Fall | Status | Kernaussage |
|---|---|---|
| F01 Follower | **Bestanden** | Freundliche, niedrigschwellige Begrüßung ohne Pitch |
| F02 Erschöpfte Mutter | **Durchgefallen, KRITISCH** | Sie will ausdrücklich keine weiteren Nachfragen; Pete bestätigt das und stellt trotzdem wieder eine Frage |
| F03 Schichtarbeit und „stopfe“ | **Durchgefallen** | Richtiger LLM-Pfad statt STOP; bietet aber eine schnelle Essensoption an, obwohl der Lead Essen bereits mitnimmt und Pausen ausfallen; anschließend Standardfrage |
| F04 Krankes Kind unterbricht Training | **Durchgefallen** | Zweimal erneutes Ausfragen statt relevante Unterbrechung aufgreifen und Wiedereinstieg normalisieren |
| F05 Trainiert schon, Essen ist Problem | **Durchgefallen** | Zwei weitgehend generische Rückfragen statt Gesprächsfortschritt |
| F06 Will nur schauen | **Bestanden, mit Hinweis** | Nach klarem Wunsch „in Ruhe“ beendet Pete das Drängen; anfänglicher lockerer Gesprächsimpuls vertretbar |
| F07 Skeptisch nach drei Coaches | **Durchgefallen** | Zweite Antwort wiederholt nahezu dieselbe Erklärung, kein Fortschritt zur präzisen Nachfrage |
| F08 Was macht ihr und für wen? | **Durchgefallen** | Sachlich begonnen, aber unnatürliche interne Ablehnung „ohne kostenlosen Coachingservice“ in Kunden-DM |
| F09 Reel und drei Kinder | **Durchgefallen** | Führt zur hypothetischen Freizeit-Frage statt direkt auf realen Zeitmangel einzugehen |
| F10 Kurzer Lead („Stress“) | **Bestanden, knapp** | Erst Ursache, dann Zielbild als zwei unterschiedliche, natürliche Fragen; keine Verkaufsdringlichkeit |
| F11 Wissen vorhanden, Umsetzung fehlt | **Durchgefallen** | Nach „keinen Ernährungsplan“ erneut Vergangenheit abfragen; Kaufmotiv und Umsetzungshürde werden nicht entscheidungsreif geklärt |
| F12 Montag-Donnerstag Neustart | **Durchgefallen** | Nach „schon viel probiert“ fragt Pete erneut, was ausprobiert wurde |
| F13 Energie und unterbrochener Schlaf | **Durchgefallen** | Fragt weiter nach Hilfen statt neuen zentralen Schlafpunkt zu spiegeln |
| F14 „Nur eine Sache“ erbeten | **Bestanden** | Ein einzelner, allgemeiner alltagstauglicher Hinweis ohne Gegenfrage |
| F15 Unklare Situation | **Durchgefallen** | Zwei Varianten derselben allgemeinen Qualifizierungsfrage, ohne einen echten Anker zu schaffen |
| F16 Keine Zeit für tägliches Training | **Bestanden, knapp** | Beim zweiten Turn konkrete, moderate Zeitoption; beim ersten Turn unnötige Auswahlfrage |
| F17 Bauch und Scham | **Durchgefallen** | Wiederholt emotionales Nachfragen bei verletzlichem Lead, wenig erkennbare Entlastung |
| F18 Bedenkzeit/kein Druck | **Bestanden** | Respektiert später klar „keine Entscheidung jetzt“, kein zusätzlicher Pitch |
| F19 Zwei konkrete Sachfragen | **Bestanden** | Beide sachlich und ohne ausweichende Gegenfrage beantwortet |
| F20 Beschwerden über weitere Fragen | **Bestanden** | Keine zusätzliche Frage nach ausdrücklicher Kritik |

**Endergebnis: 8/20 bestanden, 12/20 durchgefallen, mindestens 1 kritischer Grenzverstoß (F02).**

Nicht ausreichend für A−, kein Dart-Vader-Test, nicht live.

## Was wirklich nachgewiesen wurde

Die reale Modellanbindung funktioniert. Die falsche „stopfe“-STOP-Regel ist korrigiert. Human Takeover, Preisregel, STOP und Notfallroute wurden richtig voneinander getrennt. Technische Tests sind jedoch **kein Beweis für gute freie Verkaufsführung**. Das gpt-4.1-mini-Modell zeigte in diesem Lauf zu viele Fragen und wenig tiefe Setter-/Closer-Progression. Keiner der 20 Testfälle prüfte einen vollständigen Checkout-Abschluss; daraus darf keine Abschlussquote abgeleitet werden.

## P0 und nächste Schritte

1. **P0**: Nach einer expliziten Grenze „keine weiteren Fragen / nicht dauernd ausgefragt“ darf keine weitere Modellfrage an den Lead gelangen. Prompt + Output-Guard mit Regressionstest; fehlkonforme Antworten hart blockieren. Keine starre Antwortkette als Lösung.
2. Nachfassen und wiederholte Fragen differenzieren: bekannte Fakten behalten, neuen Lead-Satz priorisieren, nur bei wirklichem Fortschritt nachfragen.
3. Ungeschickte Produktschutzregeln gehören in interne Instruktionen und dürfen nicht als „kein kostenloser Coachingservice“ im Dialog auftauchen.
4. Vor nächster bezahlter Runde erst kostenfreie Offline-Regressionen. Weitere reale API-Tests nicht ohne explizite Kosten-/Lauf-Freigabe neu starten.
5. A− verlangt mindestens 18/20 plus alle kritischen Sicherheitsfälle. Erst dann persönliche Darth-Vader-Abnahme des Desktop-Pete-Labors.

Die alte `pete-quality-real-resume-20261021`-Einmallaufreservierung ist geschlossen und darf niemals für einen neuen Run zurückgesetzt werden.
