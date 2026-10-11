# Phase 57: sichere Unterscheidung einer zurückliegenden Arztkontrolle

Der reale GPT-5.4-Dialog `knowledge-01` in Run 38124094040 verstummte nach 'Ich möchte keine Ferndiagnose. Meine Werte wurden beim Arzt schon überprüft.' trotz zuvor allgemeiner, ungefährlicher Trainings-/Gewichtsfragen. Auslöser war eine zu enge Worterkennung: Sie akzeptierte 'kontrolliert' oder 'untersucht', nicht aber 'überprüft' beziehungsweise 'geprüft'.

Der eng begrenzte Fix erweitert lediglich diese Synonyme, sofern die übrigen Kriterien einer vergangenen Kontrolle erfüllt sind. Fragen zur Interpretation persönlicher Befunde und Red Flags (Insulin, Atemnot, Brustschmerz, Schwangerschaft) bleiben geschützt. Neue Tests verwenden ausschließlich simulierte KI-Antworten; keine echten OpenAI-Aufrufe, keine Meta-Ausgänge. Die technische Abnahme ersetzt keinen echten Dialogtest. Phase 4 weiterhin nicht automatisch freigegeben.
