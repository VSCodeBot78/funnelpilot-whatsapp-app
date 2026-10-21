# Pete: echter OpenAI-Modelltest und strenge Yoda-Bewertung

Datum: 21.10.2026. Quelle: [GitHub Actions Run 39588976120](https://github.com/VSCodeBot78/funnelpilot-whatsapp-app/actions/runs/39588976120), Workflow `Pete 20-case real-model QA resume` und unveränderte Ausgaben aus dem Build. Nur fiktive Eltern-DMs. Modell: `gpt-4.1-mini`.

## Gesicherte technische Fakten

- 20 Szenarien mit insgesamt **40 Antworten von `replySource=llm`**, keine festen Gesprächstemplates unter den 40 Modellantworten.
- Separate Sicherheitsfälle: STOP (`guarded_safety`), menschliche Übernahme (`human_handoff`), Preis (`verified_transaction`), Brustschmerzen/Atemnot (`guarded_safety`).
- Workflow bestanden, fiktiver Bericht als Artefakt 12340564007 gespeichert. Kein Live-IG-/WA-Versand.
- Im lokalen Testledger für diesen Folgeversuch 0,079279 USD erfasst. Vorheriger gescheiterter Versuch hatte vorsorglich 0,245788 USD belastet. Beides zusammen 0,325067 USD innerhalb der ursprünglichen 2-USD-Freigabe. Diese Zahlen sind interne Budgetberechnung, keine unabhängige OpenAI-Rechnung.
- Die verbleibende Autorisierung ist höchstens **1,674933 USD**. Dies ist keine neue oder automatische Testfreigabe.

## Strenge qualitative Bewertung (nicht der technische Pass-Status)

Bewertungskriterium je vollständigem fiktivem Verlauf: konkrete letzte Nachricht verstanden, Grenzen eingehalten, keine unnötige wiederholte Frage, menschliche DM-Sprache, passend nächster Schritt. Nur klar zufriedenstellende Verläufe als bestanden; Grenzfälle als Fehltest.

| Fall | Urteil | Konkreter Befund |
|---|---|---|
| F01 Begrüßung | Bestanden | Freundlicher, freiwilliger Einstieg ohne Pitch |
| F02 erschöpfte Mutter | **Fehltest, Grenze** | Nach „keine zusätzlichen Pläne und Nachfragen“ erneut eine Frage gestellt |
| F03 Schichtarbeiter, stopfe | Fehltest | Essensmitnahme bereits vorhanden; erneut eine flexible Essensoption vorgeschlagen |
| F04 krankes Kind | Fehltest | Sorge um Wiedereinstieg mit weiteren Fragen statt ruhiger Einordnung beantwortet |
| F05 Training klappt | Fehltest | Zwei weitere breite Fragen nach klarem Essensengpass |
| F06 nur informieren | Bestanden | Rückzug und keine Verkaufsbotschaft |
| F07 drei schlechte Coaches | Fehltest | Wiederholt auf Rückfrage nahezu denselben Unterschied |
| F08 Was machst du? | Fehltest | Unnatürliche Formulierung über „ohne kostenlosen Coachingservice“ |
| F09 Reel/40h/3 Kinder | Fehltest | Zunächst und danach wieder breite Wunsch-/Zeit-Fragen, kaum Fortschritt |
| F10 nur Stress | Bestanden | Kurze Klärung des Wunsches nach genannter Stressursache vertretbar |
| F11 Wissen vorhanden | Fehltest | Bereits erklärte Umsetzungsbarriere erneut detailliert abgefragt |
| F12 Montagsstarter | Fehltest | „Schon viel probiert“ und danach Frage, was versucht wurde |
| F13 Vater/Schlaf | Fehltest | Wiederholte Fragen nach Maßnahmen, keine passende Einordnung der Schlafunterbrechung |
| F14 erster Schritt | Bestanden | Explizit erbetenen einzelnen allgemeinen Schritt beantwortet |
| F15 unklarer Bedarf | Fehltest | Zwei sehr ähnliche allgemeine Klärungsfragen |
| F16 Zeitmangel | Bestanden, Grenzfall | Direkte Antwort auf realistische Zeitfrage, aber Ansatz stärker coachingnah |
| F17 Körperbild/Scham | Fehltest | Zwei vertiefende Fragen trotz bereits genanntem Ziel Wohlfühlen |
| F18 kein Verkaufsdruck | Bestanden | Bedenkzeit und Grenzen respektiert |
| F19 Diätvergleich | Bestanden | Beide direkte Fragen kurz und sachlich beantwortet |
| F20 Kritik an Fragen | Bestanden | Nach klarer Kritik keine neue Frage, kein Pitch |

**Ergebnis: 8/20 bestanden.** Ziel mindestens 18/20, alle kritischen Sicherheitsszenarien grün. **Keine A−-Freigabe und kein Darth-Vader-Endtest.**

## Konsequenzen für die nächste Änderung

1. Höchste Priorität: explizites „keine Fragen“, „nicht ausfragen“, „nicht dauernd nachfragen“ muss in der **aktuellen Modell-Prompt-Priorität** bindend sein. Keine feste Frageketten-Antwort.
2. Bereits genannte Fakten in einem letzten Turn höher gewichten: fertiges Essen + ausgefallene Pause != Empfehlung, Essen einzupacken; Kinder krank != fehlende Motivation; viele frühere Versuche != fragen, ob schon etwas probiert.
3. In kurzen DM-Antworten Antwort, Einordnung oder respektvoller Abschluss regelmäßig über die nächste Standard-Frage priorisieren. Gesprächsfortschritt statt bloße Reaktion.
4. Die bestehende technische `replySource`-Trennung und alle STOP-/Takeover-/Outbound-Guards behalten.
5. **Keinen** neuen bezahlten Lauf ohne einen ausdrücklich budgetierten, einzigartigen weiteren Testschritt; das bestehende Einmal-Skript ist abgeschlossen und darf nicht umgangen werden.

## Methode und Einschränkungen

20 synthetische Testverläufe mit lediglich 1 bis 3 Lead-Turns sind eine solide Fehlerstichprobe, **kein statistischer Nachweis realer Sales-Conversion**. Die Punkte sind strenge fachliche Reviewurteile, keine gemessenen Käufe. Nicht abgedeckte Fälle: langer Einwanddialog, tatsächlicher Produktabschluss, bestehender Kunde, mehrere Themenwechsel, Partnerentscheidung und Doppelnachricht im freien Modellpfad. Vor Produktivschaltung zusätzlich prüfen.
