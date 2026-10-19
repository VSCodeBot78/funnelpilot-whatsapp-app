# Desktop-Rückmeldung vom 18.10.2026: ManyChat, Calendly, HubSpot, Hilfen

**Verbindliches Ziel:** Erst vollständiges, einfach bedienbares Desktop-Dashboard,
danach dieselbe Bedienlogik für Mobile. Keine Kopie des ManyChat-Quellcodes oder
der grafischen Oberfläche; bewährte Bedienmuster übernehmen.

## Direkt am Desktop geprüft

- Nutzer hat lokales Dashboard unter `127.0.0.1:5173` geöffnet. Auf
  Übersicht erscheint **Backend HTTP 500 / Backend nicht erreichbar**.
  Folglich konnte echtes Speichern / Lesen der Vorschau noch **nicht**
  akzeptiert werden. Das offene Browser-Onboarding ist bei wiederkehrenden
  Browsern absichtlich per Seen-Status unterdrückt; Einrichtung bleibt im Menü.
- Arbeitskopie des Nutzer-Laptops nutzt eigenständigen Worktree
  `FunnelPilot-Desktop-Test`, zum Zeitpunkt des Feedbacks noch HEAD
  `5806021`. Der GitHub-PR-Draft hat sich anschließend weiterentwickelt.
  **Kein automatischer Austausch der lokalen Worktree-Dateien**.
- Bestehende Mama-Papa- und Dummy-Kampagnen bleiben unverändert.
- Bestehende Einstellungshilfen (`FieldLabelWithInfo` / `InfoHint`) sollen auch
  die Kampagnen erklären. Bei Nachfassaktionen keine automatische
  Meta-Regelkonformität behaupten.

## ManyChat-Abbildung, getrennte Stufen

1. Auslöser für Instagram-Reel-Kommentar. Auswahl: alle Reels, bestimmte
   Reels, perspektivisch das nächste Reel. Bei Letzterem brauchen wir
   autorisierte Meta-Mediendaten und eine stabile Definition, welches Reel
   als 'nächstes' gilt. **Nicht als vorhandene Runtime-Funktion vortäuschen.**
2. Wortfilter: spezifische Keywords (z.B. CHECK, KETO, BULLSHIT);
   perspektivisch jedes Wort. 'Any word' kann hohe Versandmengen erzeugen
   und braucht eigene Konfliktprüfung, Anti-Duplikat- und Opt-out-Gates.
3. Öffentliche Antwort unter dem Reel optional, bis zu drei Textvarianten.
4. Erste DM optional mit editierbarer Nachricht und Antwortbutton.
5. Getrennte Folge-DM mit Einleitungstext, Linkbutton und URL;
   bei vorgeschaltetem DM-Button nur nach bestätigtem Benutzerklick.
6. Weitere Chat-Knoten, Verzweigungen, smarte Wartezeiten (z. B. 23 h) und
   Follow-ups erst nach Bestätigung der Meta-Fenster und Einwilligungslage.
   Human Takeover, Opt-out, #168 und Deduplizierung haben Vorrang.

**Umgesetzt in PR #184 als Entwurfseditor:** Quellen, Keywords, alle/bestimmte
Reels, nur bestätigte numerische Media-IDs, eigene editierbare öffentliche
Kommentarantworten, erste DM/optionaler Button, getrennte Link-DM,
Pete-Handoff-Entwurf, Hilfetexte und inerte Chat-Darstellung. Kein Live-Send
oder echtes Warten auf Button-Klick. Das nächste Reel/Any-Word ist momentan
nur als noch nicht verfügbare Funktion beschrieben.

## Weitere Produktentscheidungen

- **Onboarding**: im Erstlauf sichtbar, danach über Einrichtung erneut
  aufrufbar. Test-Reset nur in lokaler QA, nicht Kontodaten löschen.
- **Leads/CRM**: schnelle Inbox und Konversationskontext lokal halten;
  HubSpot später als führendes CRM, inklusive Idempotenz und datensparsamer
  Übertragung. Keine Behauptung, dass externe CRM-Anbindung schon steht.
- **Termine**: Calendly soll führende Verfügbarkeits- und Buchungsquelle sein;
  Dashboard höchstens Übersicht bestätigter Buchungen/Status. Die vorhandene
  lokale Vorschlags-Terminverwaltung ist Legacy. Der aktuell auswählbare
  Calendly-Provider ist **kein Beweis** für erfolgreich geprüfte Echtzeit-Slots.
  Pete darf keine erfundenen Slots vorschlagen.
- **Nachfassen**: Opt-in/Schalter, Meta-Window-Checks, Stop-Keywords,
  Human-Takeover- und Opt-out-Schutz vor Runtime-Verbindung testen.
- **SaaS**: Produktname, Funnel Pilot Copyright und globale rechtliche
  Produktangaben nur Plattform-Owner ändern; Coach-eigene
  Impressum/Datenschutzlinks und Coach-/Pete-Ansprache dürfen pro Mandant
  editierbar sein. **Serverseitige Authentisierung und Rollenprüfung**
  erforderlich; bloß deaktiviertes HTML-Feld zählt nicht als Schutz.
  Branding/Setup-Video später. Untergeordnete Coaches erhalten nur eigene Daten.

## Priorisierte verbleibende 5 Arbeitsblöcke

1. Sicheres lokales Backend-Testlabor bereitstellen und HTTP-500-Ursache
   eingrenzen (keine Live-Webhooks oder OpenAI-Sends).
2. Desktop ManyChat-Flows als bedienbare Vorlagen, Speichern, Buttons und
   read-only Vorschau mit Negativfällen abnehmen; echte Provider-Aktionen erst
   mit separatem Architektur-/Meta-Gate.
3. Calendly: Events und tatsächlich verfügbare Slots lesen, Datenherkunft
   zeigen, bestehende Terminseite zur gebuchten Terminübersicht entschlacken.
4. SaaS-Rechte und Settings: Plattform-Copyright/Branding serverseitig
   schützen; Coach-Pete/Provider/Datenschutz pro Workspace trennen;
   später HubSpot CRM-Sync.
5. Quality/Safety: Opt-out #168, Doppelantworten, Meta-Fenster,
   Yoda v4 mindestens 18/20, Qualitätswert mindestens 90/100 ohne kritische
   Fehler; Darth-Vader-Laptop-Endtest; erst danach Release/Mobile-Portierung.

Kein Merge, Deployment, neue API-/Abo-Kosten oder Liveversand aus dieser
Rückmeldung autorisiert.
