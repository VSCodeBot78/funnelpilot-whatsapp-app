# Pete Phase 3 Qualitätsdiagnose und Ausgabegrenzen, Phase 51

Vorgänger: PR #81 (Kontextrouting), #82 (GPT-5.4 Vergleich). Der reale GPT-5.4 Vergleich (GitHub Actions 38119956778) zeigte deutlich bessere inhaltliche Antworten, aber 28/100 echte Modellantworten; viele Folgemeldungen blieben nach frühem Handover stumm. Eine grüne GitHub Action ist nicht gleich Dialogqualität.

Neu: Für GPT-5.4 werden höchstens 800 statt 400 Ausgabe-Tokens vorgesehen, bei reasoning.effort none; das Modell unterstützt diese Einstellung laut offizieller Dokumentation. Um die vorher geprüfte USD-Reservierung strikt einzuhalten, ist die Anfragegröße nun auf 18 KB begrenzt (18k + 6k reservierte Eingabetokens bei 2,50 USD/M, 800 Ausgabetokens bei 15 USD/M = 0,072 USD pro Aufruf, maximal 20 = 1,44 USD unter der GitHub-Blockreservierung 1,50 USD). GPT-4.1-mini bleibt bei 400 Ausgabe-Tokens.

Bei ungültigen Antworten werden ausschließlich ungefährliche Fehlerkategorien (Leerausgabe, Tokenlimit, falsche Struktur, Preis-/URL-Erfindung, mehr als eine Frage, falsche Personalbehauptung usw.) dokumentiert, nie Rohantworten oder Lead-Inhalte in Logs. Der nächste synthetische Nachtest soll klären, **weshalb** das Handover tatsächlich passiert (API-Ausgabegrenze, Parser, Sicherheitsvalidator oder needsHuman). Eine hypothetische Ursache wird nicht als nachgewiesen bezeichnet.

Verifizierte Transaktions-Antworten beantworten nun auch Kostenangst ohne falsche Garantie. Ein behaupteter Kauf mit fehlendem Zugang wird zur sicheren Prüfung an Jochen übergeben. Hard STOP, medical safety, Human Takeover und IG/WA-NoSend bleiben erhalten.

Jede Änderung läuft durch Offline-CI. Echter Phase-3-Test mit 10 synthetischen Fällen nur unter bestehendem kumulativem 8-USD-Pete-Limit, ohne echten Meta-/WhatsApp-Versand. Noch kein Phase-4-GO.
