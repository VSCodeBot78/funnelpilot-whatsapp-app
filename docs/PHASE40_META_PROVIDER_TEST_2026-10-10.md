# Funnel Pilot – Phase 40: isolierter IG-/WA-Provider-Test vorbereitet

Stand 10.10.2026. **Code und synthetische Tests**, KEINE echte Instagram-/WhatsApp-
Nachricht, KEIN Meta-/ManyChat-Eingriff, KEIN Live-Cutover. Die vorhandenen
Phase-29-/31-/32-/39-Gates werden wiederverwendet.

## Warum Phase 40 nötig ist

Instagram schützt neue Leads bereits mit `botEnabled=false`, einer
Sender-Allowlist, deaktivierter Engine und STOP/Human-Ownership. WhatsApp
hatte zwar einen Sendeschalter und Lead-Owner-Prüfungen, aber **keine
kanalweite Recipient-Allowlist**. Wäre `WHATSAPP_SEND_ENABLED=true`
versehentlich gesetzt worden, hätte ein erlaubter Lead grundsätzlich
eine echte Antwort erhalten können.

## Was implementiert ist

- `WHATSAPP_ALLOWED_RECIPIENT_IDS` (CSV; default **leer**) und
  `WHATSAPP_ALLOW_ALL_RECIPIENTS` (default **false**).
  Die WhatsApp-Transportfunktion prüft JEDE ausgehende Nachricht **vor
  jedem Meta-Aufruf**. Nicht freigegebene Nummern liefern
  `dryRun=true`, `sendSkipped=true`,
  `reason=recipient_not_allowlisted`; kein API-Request. Das gilt
  für Bot-Antworten und manuelle Dashboard-Sendewege.
- Unterstützt vollständige E.164-Nummern mit optional führendem
  Plus, verhindert ungültige/fehlende Empfänger. Sobald eine Liste
  gefüllt ist, gilt sie auch bei versehentlich aktivem Allow-All.
- `/health/readiness` zeigt nur Anzahl und globalen Schalterstatus,
  **keine Telefonnummern**.
- Phase-39-Laptop-Start, Startup-Lock, Readiness-Preflight und Relay-Gate
  sperren nun zusätzlich WhatsApp-Allow-All und die WhatsApp-Allowlist.
- Synthetische Negative/Positive Tests mocken `fetch` vollständig;
  kein Meta-Aufruf findet in GitHub CI statt.

## Bestehende Sicherheit statt Neuentwicklung

- Signaturprüfung und Duplicate-/Echo-Behandlung in beiden Meta-Routen;
- Instagram-Handoff zu Jochen via Outbound-Echo, STOP bleibt dauerhaft;
- WhatsApp-Business-App-Echo übernimmt auf `owner=human`;
- Im Sendepfad erneute Prüfung der aktuellen Lead-/Conversation-Ownership;
- `prepared` und `sent` sind unterschiedliche Zustände;
- die bestehenden Phase-31-End-to-End-Tests simulieren Leadwechsel,
  Duplikate, STOP, menschliche Übernahme und Release bereits.

**Wichtig:** Die neue WhatsApp-Allowlist verhindert unerwünschten echten
Versand, nicht das rein lokale Vorbereiten eines Bot-Antwortentwurfs.
Auch kann ein bereits abgeschickter Meta-Request nicht zurückgezogen werden.

## Kontrollierter manueller Test – erst mit neuer ausdrücklicher Freigabe

1. **Nur sicherer Laptop-Dry-Run**: Phase-32-/-39-Preflight grün, keine
   aktiven Meta-Sends, kein öffentlicher Admin-Zugriff. Reale Windows-
   Ausführung und Smartphone-Ansicht gesondert prüfen.
2. Je **einen eigens kontrollierten Test-IG-Account (IGSID)** und eine
   eigene **WhatsApp-Testnummer** wählen. Keine echte Kundennummer.
   IDs/Telefonnummern niemals in GitHub oder Chat veröffentlichen.
3. Für **diesen** Testkontakt prüfen, ob ManyChat, externe DM-Closer,
   Meta-Automationen und WA Business App parallel senden könnten.
   Den betreffenden Fremd-Flow nachweislich anhalten bzw. Testkontakt
   ausnehmen. **Funnel Pilot kann externe ManyChat-Sperren nicht selbst
   kontrollieren oder bestätigen.**
4. Vor einem separaten Live-Test: Meta-App-/Webhook-/Berechtigungsstand,
   Webhook-HMAC, Testkontakt-Einwilligung, Datenschutz, sichere
   HTTPS-Callback-Adresse und korrekten Datenspeicher überprüfen.
   Admin-API niemals über den Relay veröffentlichen.
5. Live-Testschalter, Sender-Allowlist und ggf. Bot-Freigabe nur in
   einem **gesondert entworfenen, explizit genehmigten Testablauf**
   aktivieren. **Nicht** den Phase-39-Local-Laptop-Lock umgehen oder
   improvisiert als Live-Modus verwenden.
6. Im **einen** Testchat nacheinander prüfen: signierte Nachricht,
   Duplikat-ID, ungültige Signatur, normaler Dry-Run, ein bewusst
   freigegebener Versand, Human-Echo und anschließende Stille, STOP
   ohne spätere Nachrichten, kein Ghosting nach STOP/Handover.
   Zustellung nicht aus HTTP-200 allein ableiten: Providerstatus
   und tatsächlichen Empfang am Testgerät getrennt prüfen.
7. Bei fremder Nachricht, Doppelantwort, unsicherem Routing, fehlerhaftem
   Stoppverhalten oder Datenzugriff: **sofort abschalten**; keine
   automatische Massenfreigabe.

## Noch offen / keinesfalls als erledigt melden

Externer ManyChat-Cutover, verifizierte Meta-Test-IDs, tatsächlicher
Windows-/Android-Test, ein dafür abgenommener HTTPS-Webhook-Weg,
gültige Meta-/WA-Berechtigungen, echte Meta-Delivery-/Receipt-Events
und ein sicherer separater Live-Test-Modus. Das aktuell sichere
Windows-Profil **verbietet** absichtlich Live-Versand.
