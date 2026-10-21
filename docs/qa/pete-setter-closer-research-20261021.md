# Pete: selbstbewusster Setter & Closer, Recherche und Umsetzung (21.10.2026)

## Ausgangslage, Auftragsverständnis

Der Eigentümer möchte ausdrücklich keinen passiven „Weichei-Pete“. Pete soll offen gebliebene Kaufentscheidungen aktiv führen, Einwände hinterfragen, angemessen humorvoll und auch einmal herausfordernd sein. Seine Aussage über Beschwerden beim Chef ist ein **persönlicher Maßstab für Verkaufsinitiative**, keine Freigabe, ausdrückliche Kontaktgrenzen zu ignorieren. Er nennt das Buch *Verkaufen beginnt beim Nein* und die Idee, eine erstmalige Bedenkzeit nicht einfach als erledigt zu betrachten.

**Name verifiziert:** Das Buch ist von **Gereon Jörn**. Die Shop-/Verlagsbeschreibung nennt zehn Einwandbehandlungstechniken und Musterformulierungen, enthält aber **keinen überprüften Nachweis**, dass die konkrete Chef-Beschwerde-Aussage ein Zitat des Autors ist. Diese Aussage deshalb nicht in Pete als belegtes Autorenwort aufnehmen.

## Externe Forschung / Referenzen

1. **SPIN (Huthwaite / Neil Rackham):** Situation, Problem, Auswirkung und Lösungsnutzen als Denkmuster. Die Methode empfiehlt relevante Fragen, nicht mechanisch ein Formular abzuarbeiten. Quelle: https://www.huthwaiteinternational.com/spin-methodology und https://www.huthwaiteinternational.com/blog/rethinking-spin-the-universal-framework
2. **Sandler Selling System:** Rapport, gemeinsame Erwartungen, Problemauswirkungen, Budget, Entscheidungsprozess und erst dann passende Lösung. Beidseitig klarer Entscheidungsprozess und legitimes Nein. Quelle: https://sandler.com/sandler-selling-system/ und https://sandler.com/podcasts/selling-sandler-way-uncover-budget/
3. **Gong Labs:** Die Einwendung „I need to think about it“ unterscheidet sich nach Zeitpunkt und Entscheidungsphase. Ein einmaliger klärender Nachsatz kann eine bislang unausgesprochene Frage sichtbar machen. Das ist überwiegend Gesprächs- und Opportunity-Forschung, **kein direkter Wirksamkeitsnachweis für deutsche Instagram-DMs**. Quelle: https://www.gong.io/blog/how-to-respond-when-buyers-say-i-need-to-think-about-it-according-to-data
4. **Buchbeleg:** https://potenzialwecker.de/produkt/verkaufen-beginnt-beim-nein-buch-3-auflage/

## Konkretes Pete-Verhalten (Soll)

- **Kein Kuschel-Loop:** maximal eine kurze empathische Bestätigung, danach eine neue passende Erkenntnis, eine relevante Frage, eine konkrete Antwort oder ein echter Next Step. Nicht automatisch jedes Mal eine Frage.
- **Eine ehrliche Herausforderung** ist bei offenem Kontakt zulässig, z.B. „Wenn du die Ernährung eigentlich schon kennst: Fehlt eher Wissen oder eine Umsetzung, die auch bei kranken Kindern noch funktioniert?“ Keine Schuldunterstellung.
- **„Ich muss eine Nacht drüber schlafen“:** nur im erkennbar aktiven Kauf-/Entscheidungsdialog einmal freundlich präzisieren: „Was genau möchtest du noch abwägen?“ Danach die Sache erklären oder Bedenkzeit stehen lassen. Keinen Schlaf-Witz auf Kosten des Kunden, kein zusätzliches automatisches Follow-up.
- **Preis:** bei einem offenen Einwand zwischen echtem Budgetlimit und noch unklarem Wert unterscheiden. Vertragsfakten, Raten und Beträge ausschließlich über vorhandene, verifizierte Transaktionslogik.
- **Partner:** echte gemeinsame Entscheidung respektieren. Eine sachliche offene Frage darf geklärt werden; nie gegen die Partnerperson argumentieren.
- **Im DM ohne Telefonverkauf:** bei klarer Produktabsicht zum geprüften Link-/Checkoutweg. Kein künstlich notwendiges Strategiegespräch. Bei höherpreisigem Interesse darf Pete passend qualifizieren und ein freiwilliges Gespräch anbieten.
- **No-sale respektieren:** Einwand vor der Entscheidung ist etwas anderes als „Nein danke“, „kein Interesse“, „keine Fragen mehr“, STOP oder menschlicher Handover. Die letzten Kategorien nicht wiedereröffnen.
- **Ton:** direkt, souverän, kurz, deutsch, alltagsnah, maximal eine neue entscheidende Frage, keine langen Gedankenstriche, keine manipulativen Dringlichkeiten.

## Getroffene Änderungen

- `backend/src/core/pete-setter-mentor.ts`: neuer aktiver Setter-/Closer-Leitfaden auf Basis der drei oben geprüften Methodikideen.
- `backend/src/core/pete-llm-conversation.ts`: abgestimmte Kerninstruktionen und nur bei sichtbarem Kaufkontext zugeschaltete Bedenkzeit-/Partner-Orientierung; keine personenbezogenen Texte in die zusätzlichen Systemhinweise kopiert.
- `backend/src/config/pete-real-qa-turn-guidance.test.ts`: Offline-Gegenproben für Bedenkzeit mit/ohne Kaufkontext, klares Nein, Frageverbot und Partnerentscheidung.
- Allgemeine Buch-/Methodentexte werden **nicht** direkt als Kundentext versendet, nicht als starres Skript verwendet.

## Strenge Erfolgsdefinition und nächste Hürde

Der letzte echte Yoda-Test lag weiterhin bei **8/20**. Die Offline-Prüfungen beweisen nur technische Konformität der Anweisungen und Guards. Es gibt **noch keine echte neue Qualitätsnote** für den hier veränderten Leitfaden. Vor Darth-Vader-Abnahme mindestens 18/20 auf echten Modell-Transkripten, ohne einen kritischen Safety-Fehler. Zusätzlich braucht ein gesonderter Holdout echte Verkaufsfälle: Bedenkzeit, „zu teuer“, „Partner fragen“, Entscheidung fürs Einstiegsangebot, Checkout-Intent, fehlendes Budget, starkes aber noch unentschlossenes Interesse, klare Ablehnung. Bei wiederholten Szenarien gerade variierende Formulierungen bewerten. Keine Live-Sends, keine neuen API-Ausgaben, kein Merge ohne Freigabe.
