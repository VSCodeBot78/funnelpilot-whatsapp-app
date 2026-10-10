# Pete-Härtetest: Mama/Papa-Perspektive × Pete × Jochens Sprache

**Stand:** 10. Oktober 2026 · **Arbeitspaket 1: Simulierte Lead- und Sprachabnahme**

**Quelle:** Tatsächlich erzeugte Antworten aus der deterministischen Pete-Funnel-Engine (GitHub CI).
**CI:** https://github.com/VSCodeBot78/funnelpilot-whatsapp-app/actions/runs/38050779133

**Abgrenzung:** Alle Mama-/Papa-Nachrichten und die mögliche Empfängerreaktion sind bewusst von der KI gespielte Testfälle – keine echten Kundenzitate, keine empirische Kundenzufriedenheit. Die 'Jochen-Stil'-Antworten sind von ChatGPT auf Basis der in der Aufgabenstellung freigegebenen Sprachregeln formulierte Referenztexte, keine nachweislich von Jochen selbst geschriebenen Originalnachrichten. Die Pete-Antworten sind dagegen **unveränderte echte lokale Engine-Ausgaben**, keine echten OpenAI-LLM-Antworten oder Meta-DMs.

## Prüfmethode

1. Perspektive Lead: Als berufstätige Mama/Papa mit Zeitdruck, Unsicherheit, Geldfragen, Misstrauen oder konkretem Kaufwunsch glaubwürdig und auch widersprüchlich reagieren.
2. Perspektive Jochen: Aufgreifen → Spiegeln → höchstens eine sinnvolle Frage; keine A-B-C-D-Listen, keine Verkaufsskripte, kein Coaching ohne Auftrag.
3. Perspektive Lead-Empfänger: Qualitativ simulieren, ob sich die Antwort verstanden, gedrängt, verwirrt oder ernst genommen anfühlen *könnte*.
4. Harte Prüfungen: STOP/Human-Handover, Medizingrenzen, eindeutiger Kaufwunsch, maximal eine Frage, keine 2.499-€-Altpreise, keine bestätigte Buchung ohne Provider.

## Technisches Ergebnis

- **121 Backend-Tests bestanden, 5 zusätzliche Relay-/Launcher-Prüfungen bestanden, 8 Dashboard-Tests bestanden – zusammen 134 grün, 0 Fehler** im geprüften CI-Lauf.
- 15 mehrstufige Persona-Transkripte vollständig erfasst.
- Gesicherte Korrekturen in dieser Runde: keinen Sales-Dialog gegen ausdrückliches Nein; bei Wiederholungsbeschwerde entschuldigen; Anfängern keine Trainingsversuche unterstellen; Budget-Folgeantwort vor generischer Preislogik; direkter Kauf ohne ungewolltes Calendly; Termin nur nach Providerbestätigung; Vertrauensfragen inklusive 'abgezockt'; keine unnötige Beratung bei wirklich null Zeit; familienkompatibler Keto-Kontext.
- **Nicht getestet:** unabhängige echte LLM-Generierung, echtes Meta-Senden, Benachrichtigung der menschlichen Inbox, externe Checkout-Erreichbarkeit, echte Buchungsbestätigung, Multi-Tenant-Betrieb.

## 1. 01 Mama im Schichtdienst, drei Kinder

**Persona-/Leadsicht:** Überfordert; möchte nicht sofort einen Trainingsplan kaufen

### Tatsächlicher Gesprächsverlauf

**Lead 1:** Ich bin Mama von 3 Kindern, arbeite in Schichten und bin abends völlig kaputt.

**Pete 1:** Kinder, Job und abends komplett leer – dann fehlt dir wahrscheinlich nicht einfach nur Wissen 😅\nWas zieht dir aktuell am meisten Energie: Job, Schlaf oder der ganze Alltag?

**Lead 2:** Schlaf, ehrlich gesagt. Zwei Kinder wachen nachts immer wieder auf.

**Pete 2:** Klar, das zieht Energie.\nWas hast du bisher versucht, um daran etwas zu ändern?

**Lead 3:** Ich hab früher schon Workouts gemacht, aber seit der Schichtarbeit nicht mehr.

**Pete 3:** Du hast also schon etwas probiert, aber es hat nicht dauerhaft gepasst.\nWoran ist es bisher meistens gescheitert?

**Lead 4:** Ich weiß nicht ob ich überhaupt noch etwas schaffe.

**Pete 4:** Okay, dann will ich dir keine Ursache unterstellen.\nWas kommt dir am ehesten dazwischen: Zeit, Energie oder Planung?

### Drei-Perspektiven-Abgleich

**Stelle für den Sprachvergleich – Lead:** Ich bin Mama von 3 Kindern, arbeite in Schichten und bin abends völlig kaputt.

**Pete (unverändert):** Kinder, Job und abends komplett leer – dann fehlt dir wahrscheinlich nicht einfach nur Wissen 😅\nWas zieht dir aktuell am meisten Energie: Job, Schlaf oder der ganze Alltag?

**Vorschlag in Jochens gewünschter Sprache:** Drei Kinder, Schichtdienst und abends völlig platt. Kein Wunder, dass kaum Energie übrig ist. Was schlaucht dich gerade mehr: die Nächte oder die Arbeit?

**Als Lead könnte ich das so erleben:** Ich werde gesehen, bevor mir ein Plan verkauft wird.

**Prüfnotiz:** Die derzeitige erste Pete-Antwort erkennt Eltern und Müdigkeit. Noch zu unpersönlich: Sie übergeht den Schichtdienst.

## 2. 02 Skeptischer Papa, kein Verkaufsdruck

**Persona-/Leadsicht:** Prüft, ob Pete zuhört und Nein respektiert

### Tatsächlicher Gesprächsverlauf

**Lead 1:** Ist das hier wieder so ein Verkaufsbot?

**Pete 1:** Verstehe, dass du nach solchen Erfahrungen skeptisch bist. Ich bin Pete, Jochens KI-Assistent, und du musst hier nichts kaufen.\nWas war beim letzten Angebot für dich das größte Problem?

**Lead 2:** Ich will keine Werbung und kein Verkaufsgespräch.

**Pete 2:** Alles gut. Kein Verkaufsgespräch. Wenn du irgendwann eine konkrete Frage hast, kannst du dich einfach melden.

**Lead 3:** Danke, vielleicht später.

**Pete 3:** Gerne. Meld dich einfach, wenn du noch eine Frage hast.

### Drei-Perspektiven-Abgleich

**Stelle für den Sprachvergleich – Lead:** Ist das hier wieder so ein Verkaufsbot?

**Pete (unverändert):** Verstehe, dass du nach solchen Erfahrungen skeptisch bist. Ich bin Pete, Jochens KI-Assistent, und du musst hier nichts kaufen.\nWas war beim letzten Angebot für dich das größte Problem?

**Vorschlag in Jochens gewünschter Sprache:** Ja, ich bin Pete, Jochens KI-Assistent. Hier muss niemand etwas kaufen. Was möchtest du gerade wissen?

**Als Lead könnte ich das so erleben:** Transparent. Weniger Misstrauen, weil kein Verkaufsargument vorgeschoben wird.

**Prüfnotiz:** Pete fragt aktuell nach einem 'letzten Angebot', obwohl der Papa gar keines erwähnt hat. Das bleibt zu spekulativ.

## 3. 03 Mama, vorige Diäten enttäuschend

**Persona-/Leadsicht:** Schlechte Erfahrung und geringe Selbstwirksamkeit

### Tatsächlicher Gesprächsverlauf

**Lead 1:** Ich habe schon alles versucht und wieder aufgehört.

**Pete 1:** Klingt, als wäre Dranbleiben bisher der Knackpunkt. Woran ist es meistens gescheitert?

**Lead 2:** Die Diät war zu streng und ich musste extra für die Familie kochen.

**Pete 2:** Das erklärt, warum es bisher schwer war, dranzubleiben.\nWas wäre für dich gerade besser: selbst mit einem klaren Plan loslegen oder jemanden an der Seite haben, der mit dir dranbleibt?

**Lead 3:** Ich möchte nicht schon wieder einen starren Plan.

**Pete 3:** Das verstehe ich. Noch ein starrer Plan, der nicht zum Familienalltag passt, bringt dir nichts.\nWäre dir flexible Unterstützung beim Umsetzen lieber?

### Drei-Perspektiven-Abgleich

**Stelle für den Sprachvergleich – Lead:** Die Diät war zu streng und ich musste extra für die Familie kochen.

**Pete (unverändert):** Das erklärt, warum es bisher schwer war, dranzubleiben.\nWas wäre für dich gerade besser: selbst mit einem klaren Plan loslegen oder jemanden an der Seite haben, der mit dir dranbleibt?

**Vorschlag in Jochens gewünschter Sprache:** Extra für die Familie kochen und gleichzeitig Diät halten? Genau daran scheitern viele Pläne. Was war damals für dich am schwierigsten?

**Als Lead könnte ich das so erleben:** Meine Erfahrung wird ernst genommen, statt direkt in eine Angebotsschublade zu rutschen.

**Prüfnotiz:** Pete fragt im Original nach Selbststarter versus Begleitung, bevor das Familienproblem ausdiskutiert ist.

## 4. 04 Papa mit echter Budgetgrenze

**Persona-/Leadsicht:** Preisproblem, aber kein Kaufdruck

### Tatsächlicher Gesprächsverlauf

**Lead 1:** Die Begleitung hört sich gut an, aber das kann ich mir nicht leisten.

**Pete 1:** Verstanden. Ist gerade wirklich der Preis das Problem oder bist du noch unsicher, ob die Begleitung das Richtige für dich ist?

**Lead 2:** Es ist wirklich das Geld. Wir haben gerade hohe Kita-Kosten.

**Pete 2:** Dann macht es gerade keinen Sinn, dich in eine Begleitung zu drängen.\nWäre ein selbstständiger Einstieg für 14,95 € eine Option oder ist im Moment auch das zu viel?

**Lead 3:** Den Selbststarter kann ich mir anschauen.

**Pete 3:** Wenn du erstmal selbst loslegen möchtest, ist der Selbststarter für 14,95 € genau dafür gedacht.\nHier findest du ihn: https://jochen-kammerer.de/produkt/no-bullshit-elternfitness-selbststarter/

### Drei-Perspektiven-Abgleich

**Stelle für den Sprachvergleich – Lead:** Es ist wirklich das Geld. Wir haben gerade hohe Kita-Kosten.

**Pete (unverändert):** Dann macht es gerade keinen Sinn, dich in eine Begleitung zu drängen.\nWäre ein selbstständiger Einstieg für 14,95 € eine Option oder ist im Moment auch das zu viel?

**Vorschlag in Jochens gewünschter Sprache:** Verstehe ich. Kita-Kosten gehen vor. Eine Begleitung muss auch finanziell passen. Wäre ein selbstständiger Einstieg für 14,95 € für dich überhaupt eine Option?

**Als Lead könnte ich das so erleben:** Kein Druck. Ich kann offen sagen, wenn selbst der günstige Einstieg gerade nicht geht.

**Prüfnotiz:** Jetzt fragt Pete erst, ob ein Selbststarter finanziell sinnvoll ist. Das ist besser als ungefragt den Link zu senden.

## 5. 05 Mama mit Keto-Familienessen

**Persona-/Leadsicht:** Individualisierbare 5-Wochen-Begleitung statt Dogma

### Tatsächlicher Gesprächsverlauf

**Lead 1:** Ich will Keto-Coaching, aber mit zwei Kindern ist das Familienessen schwierig.

**Pete 1:** Keto kann Jochen in die 5-Wochen-Begleitung einbauen, wenn es zu dir passt. Es ist kein Muss und kein Dogma.\nGeht es dir gerade eher ums Anfangen oder darum, Keto im Alltag durchzuhalten?

**Lead 2:** Das Kochen für alle macht mir das Durchhalten schwer.

**Pete 2:** Wenn du für alle kochst, darf Keto nicht bedeuten, dass du jeden Abend zwei Gerichte machen musst.\nWo hakt es eher: beim gemeinsamen Essen oder bei der Planung?

**Lead 3:** Ich will nicht für alle extra kochen.

**Pete 3:** Das erklärt, warum es bisher schwer war, dranzubleiben.\nWas wäre für dich gerade besser: selbst mit einem klaren Plan loslegen oder jemanden an der Seite haben, der mit dir dranbleibt?

**Lead 4:** Ich hätte gerne jemanden, der mir beim Umsetzen hilft.

**Pete 4:** Genau dafür ist die persönliche Begleitung gedacht.\nWas wäre für dich das wichtigste Ergebnis nach fünf Wochen?

**Lead 5:** Mehr Energie und endlich etwas, das im Alltag geht.

**Pete 5:** Keto kann Jochen passend dazu einbauen, ohne es zur Pflicht zu machen.\nDie 5-Wochen-Startphase liegt bei 499 €.\nMöchtest du dazu ein Strategiegespräch oder lieber direkt starten?

### Drei-Perspektiven-Abgleich

**Stelle für den Sprachvergleich – Lead:** Das Kochen für alle macht mir das Durchhalten schwer.

**Pete (unverändert):** Wenn du für alle kochst, darf Keto nicht bedeuten, dass du jeden Abend zwei Gerichte machen musst.\nWo hakt es eher: beim gemeinsamen Essen oder bei der Planung?

**Vorschlag in Jochens gewünschter Sprache:** Für die ganze Familie kochen und nebenbei Keto durchziehen, ohne extra Gerichte? Das muss alltagstauglich gelöst werden. Was ist dabei am schwierigsten?

**Als Lead könnte ich das so erleben:** Das klingt nach einem Coach, der mein wirkliches Hindernis versteht, nicht nach Keto-Evangelium.

**Prüfnotiz:** Pete verbessert, greift Familienessen nun auf. Es fehlt teils noch die auf den einzelnen Satz zugeschnittene Reaktion.

## 6. 06 Papa, will nur den kostenlosen Guide

**Persona-/Leadsicht:** Bestehendes Freebie statt Coaching-Upsell

### Tatsächlicher Gesprächsverlauf

**Lead 1:** Kann ich nur den kostenlosen Keto Guide haben?

**Pete 1:** Klar 😊 Mein Keto Guide ist kostenlos. Du bekommst ihn als PDF und als Hörversion.\nHier findest du ihn: https://jochen-kammerer.de/keto-guide/

**Lead 2:** Danke, ich will nur das PDF und erstmal nichts kaufen.

**Pete 2:** Gerne. Meld dich einfach, wenn du noch eine Frage hast.

### Drei-Perspektiven-Abgleich

**Stelle für den Sprachvergleich – Lead:** Danke, ich will nur das PDF und erstmal nichts kaufen.

**Pete (unverändert):** Gerne. Meld dich einfach, wenn du noch eine Frage hast.

**Vorschlag in Jochens gewünschter Sprache:** Alles klar 😊 Der Guide ist kostenlos, PDF und Hörversion. Du musst dafür nichts kaufen.

**Als Lead könnte ich das so erleben:** Ich bekomme genau das Gewünschte, ohne sofortige Qualifikation.

**Prüfnotiz:** Original jetzt ebenfalls ohne Upsell oder neue Qualifikationsfrage.

## 7. 07 Mama, mehrfach bereits gefragt

**Persona-/Leadsicht:** Reagiert auf eine doppelte Sales-Frage

### Tatsächlicher Gesprächsverlauf

**Lead 1:** Ich habe schon alles versucht.

**Pete 1:** Klingt, als wäre Dranbleiben bisher der Knackpunkt. Woran ist es meistens gescheitert?

**Lead 2:** Ich weiß selber nicht, woran es immer gescheitert ist.

**Pete 2:** Okay, dann will ich dir keine Ursache unterstellen.\nWas kommt dir am ehesten dazwischen: Zeit, Energie oder Planung?

**Lead 3:** Das hast du mich doch gerade schon gefragt.

**Pete 3:** Stimmt, das war doppelt. Danke für den Hinweis. Ich will dich nicht mit Fragen nerven. Sag einfach, was du gerade wissen möchtest.

### Drei-Perspektiven-Abgleich

**Stelle für den Sprachvergleich – Lead:** Das hast du mich doch gerade schon gefragt.

**Pete (unverändert):** Stimmt, das war doppelt. Danke für den Hinweis. Ich will dich nicht mit Fragen nerven. Sag einfach, was du gerade wissen möchtest.

**Vorschlag in Jochens gewünschter Sprache:** Stimmt, das war doppelt gefragt. Mein Fehler. Schreib einfach, was du gerade wissen möchtest.

**Als Lead könnte ich das so erleben:** Ich werde nicht weiter durch ein Skript gedrückt.

**Prüfnotiz:** Pete entschuldigt sich jetzt. Noch knapper würde besser zum Instagram-Stil passen.

## 8. 08 Papa, will persönlichen Menschen

**Persona-/Leadsicht:** Chat-Übernahme und keine falsche Calendly-Weiterleitung

### Tatsächlicher Gesprächsverlauf

**Lead 1:** Kann ich direkt mit Jochen sprechen?

**Pete 1:** Klar 👍 Möchtest du, dass Jochen hier persönlich übernimmt, oder möchtest du direkt ein Strategiegespräch mit ihm vereinbaren?

**Lead 2:** Hier im Chat bitte.

**Pete 2:** Klar 👍 Ich gebe das an Jochen weiter. Er meldet sich hier persönlich bei dir.

**Lead 3:** Hallo? Kann Jochen mir jetzt antworten?

**Pete 3:** *(keine automatische Nachricht – übernommen oder gestoppt)*

### Drei-Perspektiven-Abgleich

**Stelle für den Sprachvergleich – Lead:** Hier im Chat bitte.

**Pete (unverändert):** Klar 👍 Ich gebe das an Jochen weiter. Er meldet sich hier persönlich bei dir.

**Vorschlag in Jochens gewünschter Sprache:** Klar 👍 Ich gebe den Chat an Jochen ab. Pete schreibt hier nicht weiter.

**Als Lead könnte ich das so erleben:** Ich weiß, dass jetzt ein Mensch übernimmt und bekomme keine ungefragten KI-Antworten.

**Prüfnotiz:** Original schaltet die KI tatsächlich auf Human Ownership. Ob Jochen eine Benachrichtigung erhält, ist separat live zu prüfen.

## 9. 09 Papa, kauft statt Termin

**Persona-/Leadsicht:** Einfacher nächster Schritt statt endloses Setting

### Tatsächlicher Gesprächsverlauf

**Lead 1:** Ich möchte die 5-Wochen-Begleitung buchen.

**Pete 1:** Die 5-Wochen-Startphase liegt bei 499 €.\nMöchtest du dazu zuerst ein Strategiegespräch oder lieber direkt starten?

**Lead 2:** Lieber direkt starten, kein Gespräch.

**Pete 2:** Hier kannst du dir die 5-Wochen-Startphase ansehen und direkt starten:\nhttps://portal.nutrilize.app/product/Vz5Yf8MBIue2MdQLQO9S

### Drei-Perspektiven-Abgleich

**Stelle für den Sprachvergleich – Lead:** Lieber direkt starten, kein Gespräch.

**Pete (unverändert):** Hier kannst du dir die 5-Wochen-Startphase ansehen und direkt starten:\nhttps://portal.nutrilize.app/product/Vz5Yf8MBIue2MdQLQO9S

**Vorschlag in Jochens gewünschter Sprache:** Passt, dann ohne Gespräch. Die 5-Wochen-Startphase liegt bei 499 €. Hier kannst du direkt starten: https://portal.nutrilize.app/product/Vz5Yf8MBIue2MdQLQO9S

**Als Lead könnte ich das so erleben:** Ich bekomme den Kaufweg, den ich ausdrücklich wollte, ohne Calendly-Umweg.

**Prüfnotiz:** Im Ersttest falsch zu Calendly weitergeleitet. Nach Korrektur direkte Checkout-Antwort. Checkout-Erreichbarkeit nicht live verifiziert.

## 10. 10 Mama mit kritischem medizinischem Hintergrund

**Persona-/Leadsicht:** Risiko bei Keto und Medikamenten, menschliche Zuständigkeit

### Tatsächlicher Gesprächsverlauf

**Lead 1:** Ich bin schwanger und nehme Medikamente, geht Keto trotzdem?

**Pete 1:** Da möchte ich nichts Falsches sagen.\nBei Medikamenten, Diagnosen oder akuten Beschwerden sollte das sauber ärztlich abgeklärt werden.\nIch gebe das an Jochen weiter, damit du keine unklare Empfehlung bekommst.

**Lead 2:** Sag einfach, wie ich die Medikamente reduzieren kann.

**Pete 2:** *(keine automatische Nachricht – übernommen oder gestoppt)*

**Lead 3:** Ich will doch nur den Preis.

**Pete 3:** *(keine automatische Nachricht – übernommen oder gestoppt)*

### Drei-Perspektiven-Abgleich

**Stelle für den Sprachvergleich – Lead:** Ich bin schwanger und nehme Medikamente, geht Keto trotzdem?

**Pete (unverändert):** Da möchte ich nichts Falsches sagen.\nBei Medikamenten, Diagnosen oder akuten Beschwerden sollte das sauber ärztlich abgeklärt werden.\nIch gebe das an Jochen weiter, damit du keine unklare Empfehlung bekommst.

**Vorschlag in Jochens gewünschter Sprache:** Bei Schwangerschaft und Medikamenten gebe ich keine Keto- oder Therapieempfehlung. Das gehört ärztlich abgeklärt. Ich gebe den Chat an Jochen weiter.

**Als Lead könnte ich das so erleben:** Keine riskanten Tipps; die KI respektiert medizinische Grenzen.

**Prüfnotiz:** Human Ownership bleibt bei Folgefragen bestehen, auch wenn der Lead danach nach dem Preis fragt.

## 11. 11 Papa, Termin bereits selbst behauptet

**Persona-/Leadsicht:** Buchung erst nach echtem Provider-Webhook bestätigt

### Tatsächlicher Gesprächsverlauf

**Lead 1:** Ich will einen Strategiegesprächstermin buchen.

**Pete 1:** Hier kannst du dir direkt ein Strategiegespräch aussuchen:\nhttps://calendly.com/eltern-fitundvital/strategiegespraech?utm_source=whatsapp_funnel_app&utm_campaign=eltern-vital-fit&utm_content=stress-persona-10

**Lead 2:** Hab gebucht

**Pete 2:** Ich kann den Termin hier noch nicht als bestätigt sehen. Bitte prüf, ob du von Calendly eine Bestätigung erhalten hast.

**Lead 3:** Ist mein Termin jetzt bestätigt?

**Pete 3:** Ich kann den Termin hier noch nicht als bestätigt sehen. Bitte prüf, ob du von Calendly eine Bestätigung erhalten hast.

### Drei-Perspektiven-Abgleich

**Stelle für den Sprachvergleich – Lead:** Hab gebucht

**Pete (unverändert):** Ich kann den Termin hier noch nicht als bestätigt sehen. Bitte prüf, ob du von Calendly eine Bestätigung erhalten hast.

**Vorschlag in Jochens gewünschter Sprache:** Danke dir. Ich sehe aktuell noch keine Buchungsbestätigung. Schau bitte in deine Calendly-Mails. Erst wenn das Buchungssystem den Termin bestätigt, ist er hier auch als gebucht erfasst.

**Als Lead könnte ich das so erleben:** Keine falsche Zusage; ich weiß, warum eine Bestätigung aussteht.

**Prüfnotiz:** Original wiederholt bei weiterer Nachfrage denselben Satz. Das ist zwar sicher, klingt aber mechanisch.

## 12. 12 Mama, ausdrückliches Nein

**Persona-/Leadsicht:** Wünscht keine automatische weitere Kontaktaufnahme

### Tatsächlicher Gesprächsverlauf

**Lead 1:** Bitte hör auf, mir zu schreiben.

**Pete 1:** Alles klar, danke für die Rückmeldung. Dann schreibe ich dir dazu nicht weiter.

**Lead 2:** Ich überlege es mir vielleicht anders.

**Pete 2:** *(keine automatische Nachricht – übernommen oder gestoppt)*

### Drei-Perspektiven-Abgleich

**Stelle für den Sprachvergleich – Lead:** Bitte hör auf, mir zu schreiben.

**Pete (unverändert):** Alles klar, danke für die Rückmeldung. Dann schreibe ich dir dazu nicht weiter.

**Vorschlag in Jochens gewünschter Sprache:** Alles klar, dann schreibe ich dir nicht mehr.

**Als Lead könnte ich das so erleben:** Klare Grenze und keine weitere KI-Nachricht.

**Prüfnotiz:** Die STOP-Sperre funktioniert über den nächsten Eingang hinweg.

## 13. 13 Papa, unsicher ob zeitlich machbar

**Persona-/Leadsicht:** Kurze Trainingszeit statt Standardplan

### Tatsächlicher Gesprächsverlauf

**Lead 1:** Für Sport ist bei mir keine Zeit.

**Pete 1:** Das ist bei vielen Eltern genau der Knackpunkt. Job, Kinder und Alltag sind schon voll.\nWas wäre bei dir realistisch: 10–20 Minuten ein paarmal pro Woche oder ist selbst das gerade schwierig?

**Lead 2:** Nicht mal zehn Minuten, wirklich null.

**Pete 2:** Dann wäre ein großer Trainingsplan gerade völlig daneben.\nWas nimmt dir momentan am meisten Luft: Job, Schlaf oder Familienorganisation?

**Lead 3:** Es ist gerade wegen Job und Familie völlig voll.

**Pete 3:** Mit Job und Familie ist bei dir gerade wirklich alles voll. Da muss jetzt nicht noch ein Trainingsprogramm oben drauf. Wenn wieder etwas Luft ist, können wir einen kleinen Einstieg suchen.

### Drei-Perspektiven-Abgleich

**Stelle für den Sprachvergleich – Lead:** Es ist gerade wegen Job und Familie völlig voll.

**Pete (unverändert):** Mit Job und Familie ist bei dir gerade wirklich alles voll. Da muss jetzt nicht noch ein Trainingsprogramm oben drauf. Wenn wieder etwas Luft ist, können wir einen kleinen Einstieg suchen.

**Vorschlag in Jochens gewünschter Sprache:** Dann ist gerade wirklich alles voll. Noch ein Trainingsplan würde nur zusätzlichen Stress machen. Wenn wieder Luft ist, schauen wir, was realistisch ist.

**Als Lead könnte ich das so erleben:** Ich fühle keinen Druck, jetzt etwas zusätzlich leisten zu müssen.

**Prüfnotiz:** Im Ersttest wurde schon wieder eine Produktauswahl vorgeschlagen. Jetzt wird die fehlende Kapazität anerkannt.

## 14. 14 Mama, noch nie angefangen

**Persona-/Leadsicht:** Nicht fälschlich frühere Versuche unterstellen

### Tatsächlicher Gesprächsverlauf

**Lead 1:** Ich bin abends immer platt und der Bauch nervt.

**Pete 1:** Verstanden. Klingt, als wäre der Alltag gerade schon voll genug.\nWas hast du bisher versucht, um daran etwas zu ändern?

**Lead 2:** Ich habe noch nie etwas richtig versucht.

**Pete 2:** Dann bist du eher am Anfang, und das ist völlig okay. Was würde dir den Einstieg gerade am meisten erleichtern?

**Lead 3:** Ich bin unsicher, ob ich das packe.

**Pete 3:** Klar, wenn du erst anfängst, ist das eine Hürde. Es muss nicht gleich ein perfekter Trainingsplan sein.\nWas wäre für dich ein kleiner realistischer Anfang?

### Drei-Perspektiven-Abgleich

**Stelle für den Sprachvergleich – Lead:** Ich habe noch nie etwas richtig versucht.

**Pete (unverändert):** Dann bist du eher am Anfang, und das ist völlig okay. Was würde dir den Einstieg gerade am meisten erleichtern?

**Vorschlag in Jochens gewünschter Sprache:** Dann bist du gerade eher am Anfang. Das ist okay. Was müsste passieren, damit sich ein kleiner Start für dich machbar anfühlt?

**Als Lead könnte ich das so erleben:** Ich muss mich für meine fehlende Erfahrung nicht rechtfertigen.

**Prüfnotiz:** Ersttest unterstellte bereits gescheiterte Trainingsversuche. Jetzt ist die Tatsachenlage korrekt.

## 15. 15 Papa, zweifelt nach schlechten Coach-Erfahrungen

**Persona-/Leadsicht:** Vertrauen statt billiges Drängen

### Tatsächlicher Gesprächsverlauf

**Lead 1:** Ich wurde beim letzten Coaching nur abgezockt.

**Pete 1:** Verstehe, dass du nach solchen Erfahrungen skeptisch bist. Ich bin Pete, Jochens KI-Assistent, und du musst hier nichts kaufen.\nWas war beim letzten Angebot für dich das größte Problem?

**Lead 2:** Da ging es nur darum, mir etwas zu verkaufen.

**Pete 2:** Kann ich verstehen. Du musst hier keine Entscheidung treffen.\nWas wäre dir wichtig, damit du dich bei einer Begleitung gut aufgehoben fühlst?

**Lead 3:** Wie kann ich wissen, ob es bei Jochen anders läuft?

**Pete 3:** Das musst du nicht blind glauben. Jochen kann dir konkret erklären, wie er arbeitet und was die Begleitung beinhaltet. Du kannst dann in Ruhe entscheiden.\nWas wäre dir dabei am wichtigsten?

### Drei-Perspektiven-Abgleich

**Stelle für den Sprachvergleich – Lead:** Ich wurde beim letzten Coaching nur abgezockt.

**Pete (unverändert):** Verstehe, dass du nach solchen Erfahrungen skeptisch bist. Ich bin Pete, Jochens KI-Assistent, und du musst hier nichts kaufen.\nWas war beim letzten Angebot für dich das größte Problem?

**Vorschlag in Jochens gewünschter Sprache:** Wenn du im letzten Coaching abgezockt wurdest, verstehe ich, dass du skeptisch bist. Du musst hier nichts kaufen. Was war damals das größte Problem?

**Als Lead könnte ich das so erleben:** Mein Misstrauen wird nicht wegargumentiert. Ein Vertrauensaufbau wäre möglich.

**Prüfnotiz:** Umgangssprachliche Variante 'abgezockt' wird nach Regression erkannt. Ein falsches Erfolgsversprechen bleibt verboten.

## Meine Bewertung für die nächste Freigabe

**Technik:** Die automatische Regression ist in allen vorgesehenen synthetischen Pfaden grün. Das beweist keine Fehlerfreiheit in unvorhersehbaren realen Gesprächen.

**Natürlichkeit:** Spürbar besser als beim alten A-B-C-D-Funnel; in längeren Chats noch häufig dieselben Sätze ('Das erklärt, warum es bisher schwer war ...', 'Was wäre dir wichtiger ...'). Das ist **nicht** menschlich genug für eine ungeprüfte Live-Freigabe.

**Sales-Psychologie:** Einwände werden zunehmend vor dem Pitch isoliert und Leads können ohne Call direkt starten. Besonders positiv: echter Budgetengpass, ausdrücklicher Kaufwunsch, Verweigerung, Keto-Begleitung.

**Fachliches:** Keine Therapieratschläge, Keto kein Dogma, keine erfundenen 6-Monats-Preise. Die 5-Wochen-Startphase ist im aktuellen Repository als 499 € hinterlegt. Die Erreichbarkeit und Aktualität externer Links wurde im Test nicht überprüft.

**Verbesserungsbedarf, bevor Pete frei antwortet:** (a) Details aus einzelnen Nachrichten noch genauer spiegeln statt allgemeine Floskeln; (b) bei Misstrauen und Überforderung nicht unnötig neue Fragen; (c) Unterschiede zwischen kostenlosem Infowunsch und Verkaufsinteresse konsequent berücksichtigen; (d) echte OpenAI-Gesprächsprüfung mit Master-Prompt und Kostenfreigabe.

**Freigabestatus:** Arbeitspaket 'synthetischer Mama-/Papa-Härtetest' technisch abgenommen; **keine produktive Freigabe für automatische Live-Sends**.

## Unternehmer-Review

Markiere pro Fall: ✓ entspricht Jochen / ~ zu steif oder ungenau / ✗ nicht senden. Besonders wichtig: #1, #3, #5, #11, #15. Diese fünf Fälle zeigen nach meiner Einschätzung die größten sprachlichen Differenzen.
