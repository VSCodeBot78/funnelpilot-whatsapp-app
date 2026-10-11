# Pete Testlabor – mobile Ein-Tipp-App (MVP, 11.10.2026)

## Enthalten
- Android-PWA-/Startbildschirm-Eintrag mit eigener Route \`/pete-test\`, eigenem Icon, Manifest und einem **network-only** Service Worker ohne Zwischenspeicherung von Chat-/API-Daten.
- Mobile synthetische Pete-Dialoge über die vorhandene \`/test-chat\`-Engine. Fiktiver Testkontakt bleibt per zufälliger ID lokal wiederaufrufbar; Android-Tastatur-Diktat als Text, keine gespeicherten Audiodateien.
- Antworten direkt bewerten (gut / verbessern), Feedback bewusst kopieren. Bewertungen sind nur flüchtig im Browserzustand, noch **keine** serverseitige Trainingspipeline.
- Der bereits vorhandene serverseitige Pete-Budget-Ledger wird vor und nach jeder gesendeten Nachricht abgefragt. Anzeige von bestätigten und reservierten USD, verbleibender interner Grenze und Änderung seit voriger Abfrage. Bei defektem/fehlendem Zähler wird Senden in der mobilen UI verhindert. Der serverseitige Guard ist weiterhin maßgeblich.
- **Nicht identisch mit OpenAI-Prepaid-Guthaben!** Ledger ist pro \`DATA_DIR\`/Backend-Instanz. Bestehender GitHub-Phase-3-Testledger ist gesondert. Prepaid-Kontostand, Echtzeit-Wechselkurs, manuelles Aufladen und globaler OpenAI-Billing-Saldo werden **nicht** aus der App abgerufen. Keine automatische Aufladung.

## Ganz wichtig: noch nicht öffentlich installieren / live schalten
1. GitHub-PR-CI grün und Android-Browser-Test durchführen.
2. Vor externer Nutzung: zugangsgeschützte TLS/HTTPS-Adresse für nur diese Testoberfläche **und** die zugehörigen benötigten Testchat-/Budgetrouten, mit verifizierter Authentisierung und Session-/CSRF-/Rate-Limits sowie eigener isolierter Datenhaltung. Kein direkter Tunnel zu Port 3001 oder 5173, keine Offenlegung des restlichen Admin-Backends, keine echten Lead-Daten.
3. Private Cloud-Testinstanz mit sicher verwaltetem API-Secret und Ausgabengrenze; GitHub Codespaces schläft ein und ist deshalb nicht automatisch ein jederzeit erreichbares Ein-Tipp-Backend. Kosten/Hosting und erlaubte Modellaufrufe müssen vorher ausdrücklich freigegeben werden.
4. Nur synthetische Personas und explizite Modellbudget-Freigabe. \`INSTAGRAM_SEND_ENABLED=false\`, \`WHATSAPP_SEND_ENABLED=false\`; keine Meta-/ManyChat-Anbindung durch diesen Schritt.
5. Erst nach authentisierter Bereitstellung: Chrome auf Android → geschützte HTTPS-Test-URL → Browser-Menü **Zum Startbildschirm hinzufügen / App installieren**. Nach dem Projekt Startbildschirm-Icon entfernen. Gegebenenfalls erneute Anmeldung beim Anbieter erforderlich.

## Abnahmefälle
- Keine Kostenanzeige als „OpenAI-Guthaben“; Zählerfehler verhindert neue mobile Sendversuche.
- Budgetänderungen werden in **USD mit vier Nachkommastellen** angezeigt; parallele Testkosten sind nicht einer einzelnen Nachricht beweissicher zuzuordnen.
- Härtere Backend-Budgetgrenze bleibt bestehen, auch wenn die UI manipuliert oder offline ist. Kein Auto-Top-up.
- Refresh und Wiedereinstieg verwenden nur einen synthetischen Testkontakt. Nach „Neuer Test“ bleibt der alte Verlauf getrennt.
- Keine echten IG-/WhatsApp-Events, Anmeldedaten, Kunden- oder Admin-Schnittstellen ungeschützt auf einer öffentlichen Domain.

**Status:** Quellcode-MVP; kein Hosting, keine installierbare Remote-Adresse, keine Mobilgeräte-/Meta-Live-Abnahme in dieser Änderung.
