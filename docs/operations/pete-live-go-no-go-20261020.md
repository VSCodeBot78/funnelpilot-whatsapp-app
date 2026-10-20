# Pete Live-Pilot: Go / No-Go (Entwurf, 20.10.2026)

**Status:** ausschließlich Vorbereitung, keine Live-Freigabe. Ein privater Darth-Vader-Test ist nicht gleichbedeutend mit einer IG-/WA-Livefreigabe.

## Gate A: Privates Pete-Labor
- [ ] Richtiger Desktop-Testchat (nicht mobile TTD-Testoberfläche) startet im isolierten Worktree.
- [ ] Backend-/KI-/Kostenstatus geprüft; reale Providerantwort als `replySource=llm` nachgewiesen. Keine Freigabe nur aufgrund gesetzter Flags.
- [ ] Dashboard: Kampagnen speichern/neu laden, Textfelder mit Leerzeichen, Platzhalter ohne Dollarzeichen, Ghosting-Zyklen geprüft.
- [ ] Sales-Opt-out-Issue #168 regulär geklärt; keine Umgehung früherer Tool-/Review-Blockaden.
- [ ] Jedi-Blindtest >=18/20, >=90/100 und null kritische Verstöße.
- [ ] Owner-Darth-Vader-Abnahme dokumentiert.

## Gate B: Echte Instagram-/WhatsApp-Live-Schaltung
- [ ] Separate ausdrückliche Freigabe des Owners.
- [ ] Meta-Berechtigungen, App-Review, Webhook-Verifizierung und Provider-Zustellweg tatsächlich nachgewiesen.
- [ ] ManyChat-Koexistenz ohne Doppelantworten getestet; Abschalt-/Rückfallplan freigegeben.
- [ ] Human Takeover, STOP, Sales-Opt-out und Follow-up-Fenster inklusive Race Conditions bestanden.
- [ ] Outbound-Guard, Deduplizierung, Crash-/Mehrprozessverhalten, unklare Provider-Ergebnisse abgesichert.
- [ ] Secrets/Logs/Datenschutz, geschützter Admin-Zugang und Backups geprüft.
- [ ] Budgetledger, konservative Caps und Alarmierung kontrolliert; keine automatische Aufladung.
- [ ] Not-Aus/Zurückrollen und Verantwortlichkeit im Fehlerfall festgelegt.

**No-Go bei einem einzigen kritischen Verstoß** (ungewollter Live-Send, Datenleck, Nachricht nach STOP/Human Takeover, nicht eingehaltenes Sales-Opt-out, nicht autorisierte API-Kosten). Grüne CI allein ist kein Live-Nachweis.
