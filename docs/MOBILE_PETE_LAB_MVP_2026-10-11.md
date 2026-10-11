# Pete Testlabor – mobile Ein-Tipp-App (MVP, 11.10.2026)

## Enthalten
- Android-PWA-/Startbildschirm-Eintrag mit eigener Route `/pete-test`, eigenem Icon, Manifest und einem **network-only** Service Worker ohne Zwischenspeicherung von Chat-/API-Daten.
- Mobile synthetische Pete-Dialoge über die vorhandene `/test-chat`-Engine. Fiktiver Testkontakt bleibt per zufälliger ID lokal wiederaufrufbar; Android-Tastatur-Diktat als Text, keine gespeicherten Audiodateien.
- Antworten direkt bewerten (gut / verbessern), Feedback bewusst kopieren. Bewertungen sind nur flüchtig im Browserzustand, noch **keine** serverseitige Trainingspipeline.
- Der bereits vorhandene serverseitige Pete-Budget-Ledger wird vor und nach jeder gesendeten Nachricht abgefragt. Anzeige von bestätigten und reservierten USD, verbleibender interner Grenze und Änderung seit voriger Abfrage. Bei defektem/fehlendem Zähler wird Senden in der mobilen UI verhindert. Der serverseitige Guard ist weiterhin maßgeblich.
- **Nicht identisch mit OpenAI-Prepaid-Guthaben!** Ledger ist pro `DATA_DIR`/Backend-Instanz. Bestehender GitHub-Phase-3-Testledger ist gesondert. Prepaid-Kontostand, Echtzeit-Wechselkurs, manuelles Aufladen und globaler OpenAI-Billing-Saldo werden **nicht** aus der App abgerufen. Keine automatische Aufladung.

## Ganz wichtig: noch nicht öffentlich installieren / live schalten
1. GitHub-PR-CI grün und Android-Browser-Test durchführen.
2. Vor externer Nutzung: zugangsgeschützte TLS/HTTPS-Adresse für nur diese Testoberfläche **und** die zugehörigen benötigten Testchat-/Budgetrouten, mit verifizierter Authentisierung und Session-/CSRF-/Rate-Limits sowie eigener isolierter Datenhaltung. Kein direkter Tunnel zu Port 3001 oder 5173, keine Offenlegung des restlichen Admin-Backends, keine echten Lead-Daten.
3. Private Cloud-Testinstanz mit sicher verwaltetem API-Secret und Ausgabengrenze; GitHub Codespaces schläft ein und ist deshalb nicht automatisch ein jederzeit erreichbares Ein-Tipp-Backend. Kosten/Hosting und erlaubte Modellaufrufe müssen vorher ausdrücklich freigegeben werden.
4. Nur synthetische Personas und explizite Modellbudget-Freigabe. `INSTAGRAM_SEND_ENABLED=false`, `WHATSAPP_SEND_ENABLED=false`; keine Meta-/ManyChat-Anbindung durch diesen Schritt.
5. Erst nach authentisierter Bereitstellung: Chrome auf Android → geschützte HTTPS-Test-URL → Browser-Menü **Zum Startbildschirm hinzufügen / App installieren**. Nach dem Projekt Startbildschirm-Icon entfernen. Gegebenenfalls erneute Anmeldung beim Anbieter erforderlich.

## Abnahmefälle
- Keine Kostenanzeige als „OpenAI-Guthaben“; Zählerfehler verhindert neue mobile Sendversuche.
- Budgetänderungen werden in **USD mit vier Nachkommastellen** angezeigt; parallele Testkosten sind nicht einer einzelnen Nachricht beweissicher zuzuordnen.
- Härtere Backend-Budgetgrenze bleibt bestehen, auch wenn die UI manipuliert oder offline ist. Kein Auto-Top-up.
- Refresh und Wiedereinstieg verwenden nur einen synthetischen Testkontakt. Nach „Neuer Test“ bleibt der alte Verlauf getrennt.
- Keine echten IG-/WhatsApp-Events, Anmeldedaten, Kunden- oder Admin-Schnittstellen ungeschützt auf einer öffentlichen Domain.

**Status:** Quellcode-MVP; kein Hosting, keine installierbare Remote-Adresse, keine Mobilgeräte-/Meta-Live-Abnahme in dieser Änderung.


## Separate Lab-HTTP-Schnittstelle (Absicherung vor Cloud-Bereitstellung)

- Die PWA verwendet ausschließlich `/test-chat/lab/budget`, `/test-chat/lab/message` und `/test-chat/lab/state/:leadId`.
- **Zwei explizite Freigaben** erforderlich: `PETE_MOBILE_LAB_ENABLED=true` und `PETE_MOBILE_LAB_ISOLATED_DATA=true`, dazu deaktivierte IG-/WA-Engine-/Send-/Allow-all-Schalter; sonst HTTP 404.
- Nur zufällig erzeugte `lab_`-Test-IDs, fixierte Kampagne und bis 1.000 Zeichen Text pro Nachricht. Keine frei gewählten echten Lead-IDs/Kampagnen und keine Ausgabe von internem Conversation-State, Einstellungen oder Leadprofilen. Budget-Endpoint ist read-only.
- Der Betreiber **muss** eine separate frische `DATA_DIR`/Instanz ohne Live-Kundendaten starten. Das Acknowledgement-Flag garantiert diese Trennung nicht technisch; es ist nur eine Fail-Closed-Konfigurationshürde. Proxy darf **ausschließlich** diese 3 API-Routen + statische Test-App unter authentisiertem Zugriff freigeben, niemals `/test-chat/message` oder allgemeine `/leads`, `/settings`, `/conversations`.
- Lab-API selbst ist **kein Login**, keine CSRF-Abwehr und keine Mandantenisolierung. Immer geschütztes HTTPS-Gateway mit serverseitig gesicherter Anmeldung, Session-/Origin-/Rate-Limits erforderlich. Deployment separat freigeben.


## Abgleich bisheriger Projektkosten

- GitHub `pete-phase3-budget-ledger/phase3-budget-ledger.json` am 11.10.2026 verifiziert: `spentMicroUsd=4323801`, `reservedMicroUsd=0` = **4,323801 USD bereits verbucht; 3,676199 USD bis zum internen 8-USD-Limit frei**. Kein OpenAI-Prepaid-Kontostand.
- Vor dem ersten externen Start **erneut prüfen** und den bestätigten Projektverbrauch als `PETE_PROJECT_PRIOR_SPEND_MICRO_USD` setzen. Der Wert ist eine nichtgeheime manuelle Ausgangssumme und **keine** laufende GitHub-/Billing-Synchronisierung.
- Bei `PETE_MOBILE_LAB_ENABLED=true` wird der historische Verbrauch zum lokalen Backend-Ledger addiert und gegen dasselbe 8-USD-Limit gerechnet. Neue isolierte `DATA_DIR`-Instanzen erhalten nicht erneut volle 8 USD frei.
- Nach der ersten reservierten Anfrage wird der Baseline-Wert im Ledger gespeichert. Ein späteres Ändern/Entfernen dieses Werts stoppt die Budgetfunktion und erfordert bewusste Reconciliation. Keine parallelen unabhängigen API-Ausgaben mit derselben Budgetfreigabe.

## M-LAB-02 – mobile Arbeit über mehrere kurze Sitzungen (11.10.2026)

- **Bis zu zwölf fiktive Chats** als lokale Verweisliste auf dem Android-Gerät, Auswahl „Fiktiven Chat fortsetzen“. Die eigentlichen Unterhaltungen bleiben **auf dem isolierten Testbackend**, nicht im Handy-LocalStorage.
- Pete-Antworten per „Gut“ oder „Verbessern“ bewerten, bei „Verbessern“ kurze **diktierbare Korrektur-Notiz** hinterlassen. Nur Bewertung und Notiz werden **gerätebezogen lokal** gespeichert, nicht als Promptrückkopplung oder ungeprüftes KI-Training.
- Export enthält die jeweils vorherige fiktive Eltern-Nachricht, Pete-Antwort, Bewertung und Korrekturtext. Explizites Kopieren in die Zwischenablage, **kein** automatisches Teilen/Senden an ChatGPT oder Instagram.
- Aus Sicherheits-/Kostengründen werden bei unklaren Verbindungsfehlern **keine** gesendeten Testnachrichten wiederholt. Der diktierte Eingabetext wird behalten; vor erneutem Versand bitte Verlauf/Budget prüfen.
- Code- und UI-Regressionen sind nicht gleichzusetzen mit einer Android-Geräteabnahme. **Vor Installation** fehlen weiterhin isoliertes Backend, authentisierter HTTPS-Zugang, externe Betriebskostenentscheidung und explizite Modellbudgetfreigabe. Für die mobile Test-App weiterhin **keine Hosting-Bestellung jetzt**.

## M-LAB-04 – eigene Mikrofontaste für Android-Testchat (11.10.2026)

Der Geschäftsführer möchte auch ohne aktivierte Android-Tastatur-Diktierfunktion direkt in der Pete-App sprechen können. **Eigener sichtbarer Button „🎙️ Nachricht diktieren“** im Nachrichteneditor: Tippen startet browsernative `SpeechRecognition`/`webkitSpeechRecognition` auf Deutsch (`de-DE`), nochmaliges Tippen stoppt. Erkanntes Gesprochenes ergänzt den bestehenden fiktiven Textentwurf; vor dem Senden kann er kontrolliert und bearbeitet werden. **Kein Auto-Send, kein Gesprächs-/Audio-Upload durch Funnel Pilot zum Transkribieren, keine neuen Pete-/OpenAI-Transkriptionskosten.**

Browser-Einschränkung: SpeechRecognition ist nicht in jedem Android-WebView/In-App-Browser verfügbar. Der Button zeigt dann an, dass man die App **direkt in Google Chrome öffnen** sollte. Nach dem Antippen kann Chrome eine Mikrofonfreigabe verlangen; Ablehnung/Netzwerkfehler werden verständlich angezeigt. Einige Browser verwenden bei der Spracheingabe einen **externen Spracherkennungsdienst**; keine Zusage zu lokaler Offline-Sprachverarbeitung. Keine Audioaufnahme wird durch die Test-App gespeichert. Live-Verhalten kann nur auf dem tatsächlichen Android-Gerät abschließend bestätigt werden.

Der isolierte HTTPS-Gateway erlaubt dafür `Permissions-Policy: microphone=(self)`, während Kamera und Geolocation weiter gesperrt bleiben. Separate Unit- und Gateway-Regressionstests; keine Änderung an Social-Send-Flags oder aktiver OpenAI-Kostenfreigabe.

**Betriebsgate:** Änderungen erst nach grüner CI und erfolgreichem isoliertem Railway-Testlabor-Build in den temporären Deployment-Branch übernehmen; Nutzer führt dann einen echten Android-Mikrofontest durch.
