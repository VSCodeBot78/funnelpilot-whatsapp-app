# PL20 | 10.11.2026 | P1-Faktenkontinuitaet + IG-Live-Beta-Gates

## Auftrag
Owner: "Go naechste Schritte" nach lokal bestandener sechsstufiger Coach-Onboarding-Abnahme. PETE_MASTER_STATE vorab gelesen, lokaler Laptop war online, Git-Ausgangs-HEAD 1e32462fad85c9d84aae01c23573809ee18c8434, Branch feat/dashboard-v2-preview-20261023, initial sauber. Keine echten Meta-/WhatsApp-Nachrichten, keine Sol-/OpenAI-API-Aufrufe, kein OAuth-Login, keine App-/Provider-Konfigurationsaenderung, kein Merge/Push/Deploy und keine neuen Agenten.

## P1: Konkreter alter Fehler und lokaler Fix
Rekonstruktion PL28, 09.11.: Verifizierte Antwort auf "klar, kostet das was?" war "Die Terminbuchung kostet nichts und ist noch keine Coaching-Buchung". Das folgende echte Sol-Modell antwortete auf "hallo???" mit "ob fuer das Strategiegespraech Kosten anfallen, ist hier nicht verlaesslich bestaetigt". Unzulaessige Missverstaendlichkeit zwischen verifizierter gebuehrenfreier Calendly-Terminbuchung und unbestaetigten Coaching-/Gespraechsvertragsdetails.

Codeanalyse: Die qualitaetsgesicherte Strategie-Call-Kostenantwort kommt aus backend/src/core/pete-strategy-call-followup.ts und OFFER_TRUTH.strategyCall.calendlyBookingRequiresPayment=false (bestaetigt nur: Calendly verlangt keine Zahlung bei Terminbuchung). Anschliessende freie Modelleinschaetzung in backend/src/core/pete-llm-conversation.ts hatte bisher keine source-basierte Kontinuitaetspruefung fuer diesen bestaetigten Fakt.

Lokaler Fix: getPeteVerifiedBookingFeeRepair in bestehender pete-strategy-call-followup.ts. Prueft nachgewiesene Herkunft (vorherige Botantwort muss aus verified_transaction kommen), tatsächlich bestaetigte Booking-Aussage und aktuelle Owner-Faktenquelle, bevor generierte KI-Aussagen, die diese Booking-Zahlungsinformation zuruecknehmen, ersetzt werden. Liefert nur: "Fuer die Terminbuchung ... ist keine Zahlung noetig. Das ist noch keine kostenpflichtige Coaching-Buchung." Kein Claim, dass Gespraech, Coaching oder Vertragskonditionen generell kostenfrei sind. Die Pruefung setzt am Modellantwort-Ausgang vor Send/Routing an, unabhaengig vom Follower-Wortlaut. STOP, medizinische Prioritaeten, explizite Human-Uebernahme, Fragenstopp und bestehende Zahlungsgates bleiben davor bzw. unveraendert. Kein neuer Sonderfall fuer "hallo???".

Tests: neuer Backend-Fall src/config/pete-booking-fee-continuity.test.ts mit Original-Sol-Antwort und fuenf weiteren negativen Gegenbeispielen, legitimen differenzierten Antworten sowie gefaelschter/nicht vorhandener Provenienz: 4/4 PASS Exit0, TypeScript Build Exit0. Test in npm-test-Kette aufgenommen. Volle kostenfreie Backend-Regression: Exit0, Hauptblock 669/669 PASS, nachgelagert 7/7 sowie 34/34 PASS; alle vorgelagerten Teilbloecke ohne Fehler. Beleglogs C:\Users\Jo\Desktop\PL20_P1_build_2026-11-10.log und C:\Users\Jo\Desktop\PL20_P1_fulltest_2026-11-10.log. KEIN erneuter echter Sol-Test; Qualitaetsnachweis nur offline.

## META-/DATENSCHUTZ-GATES | nur lesende Abnahme

| Gate | Status | Beleg/Begrenzung |
|---|---|---|
| 1 Meta-Developer-App, Login-Typ, Rollen/Testuser, Appmodus | NICHT VERIFIZIERT | Kein authentifizierter Meta-Dashboard-/Provider-Readback. Code-Send-URL graph.instagram.com/v26.0/{IG_ID}/messages deutet lediglich auf Instagram Login. |
| 2 IG Professional @eltern_fitundvital, Konto-/Page-Zuordnung und Business | NICHT VERIFIZIERT | Keine live Meta-Kontoinventur. |
| 3 Tatsächlich genehmigte Berechtigungen/Standard-/Advanced Access | NICHT VERIFIZIERT | Fuer Instagram Login Meta Postman nennt instagram_business_basic/instagram_business_manage_messages, bei Kommentar-Nutzung separate Kommentar-Scope. Facebook-Login/Pages-Pfad nicht gleichsetzen. |
| 4 Public HTTPS Webhook GET-Challenge/Subscription | FAIL fuer aktuelle lokale Runtime | GET /health/readiness: publicBackendUrlConfigured=false, webhookBaseUrlConfigured=false, instagramVerifyTokenConfigured=false, instagramEngineEnabled=false. Implementierte GET/POST Route unter backend/src/routes/meta-instagram.ts ist nur Vorarbeit. |
| 5 POST HMAC-Signatur | PASS nur Code; FAIL aktuelle Konfiguration | x-hub-signature-256 wird anhand App-Secret pruefbar verarbeitet, aber instagramAppSecretConfigured=false. Keine echte signierte Meta-Zustellung bestaetigt. |
| 6 Inbound Event/Trigger-Recht | PASS nur technische DM-Parservorbereitung; FAIL fuer Follower-Start-Behauptung | backend/src/services/meta-instagram-webhook.service.ts verarbeitet messaging und changes.field='messages'; nicht follower oder comments private replies. Meta Send-API verlangt vor einem regulaeren DM die Initiative der IG-Nutzerin/des Nutzers. Neue Follower allein begruenden keine Sendberechtigung. Separate Comment Private-Reply-API ist weder echter Triggerbeleg noch im aktuellen Parser aktiv. |
| 7 Stop/Allowlist/Rollback | PASS aktuell AUS, Live nicht verifiziert | instagramSendEnabled=false, instagramEngineEnabled=false, localLaptopSafeMode=true. Code prueft Sender-Allowlist, Meta-Rollback und echtes Providerverhalten noch nicht abgenommen. |
| 8 Rechtliche Websites vorhanden und in App konfiguriert | Oeffentliche Webseiten erreichbar, Konfig FAIL | GET https://jochen-kammerer.de/datenschutz/ HTTP200 und https://jochen-kammerer.de/impressum/ HTTP200; Runtime privacyPolicyUrlConfigured=false, imprintUrlConfigured=false, legalLinksReady=false. Vorhandene Website allein ersetzt keine App-/Backend-Eintragung. |
| 9 Datenfluss, KI-Verarbeitung, Loeschung/DSAR | NICHT ABGENOMMEN | Oeffentliche Datenschutzerklaerung nennt allgemeine Verarbeitung, Rechte, Speicherungen, Formulare/WhatsApp sowie Meta Pixel, aber eine ausdrueckliche Funnel-Pilot/Pete-/OpenAI-gestuetzte IG-/WhatsApp-DM-Konversationsverarbeitung wurde beim Textabgleich nicht gefunden. Pflichtpruefung: Zweck, Rechtsgrundlage, Auftragsverarbeitung/Unterauftragsnehmer, KI-Provider-Transfer, Handoff/STOP, Transparenz, konkrete Aufbewahrung, Loeschen/DSAR in allen Systemen. Rechtliche Pruefung durch zustaendige Person noch offen. |
| 10 Kalender-/CRM-Verbindungen im Wizard | FAIL als eingerichtete FP-Integration | GET /integrations/oauth/status: google_calendar, calendly, hubspot = setup_required, authorizedAt=null, verifiedAt=null, syncActive=false. Extern existierender Calendly-Host ist davon getrennt. |

Meta-Quellen: https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api ; https://www.postman.com/meta/messenger-platform-api/folder/22794852-255610cd-47f5-4f4d-b3fa-71aec360be9a ; https://developers.facebook.com/docs/instagram-platform/private-replies ; https://developers.facebook.com/terms ; bereits dokumentiertes META-Issue https://github.com/VSCodeBot78/funnelpilot-whatsapp-app/issues/197 .
Lokaler Beleg: backend/src/routes/meta-instagram.ts, services/meta-instagram-webhook.service.ts, services/meta-webhook-signature.service.ts, services/meta-instagram-api.service.ts, services/instagram-automation-gate.service.ts; Readiness-Endpunkt und oauth/status GET am 10.11.

Drei priorisierte Blocker:
1. Erst Meta App/IG-Professional/Permission-/Event-Inventur im authentifizierten Owner-Dashboard beweisen. Follower-Welcome-Trigger NICHT live schalten. Erstes Beta-Szenario auf eingehende Nutzer-DMs und echte technische Allowlist begrenzen.
2. Extern erreichbare HTTPS-Webhook-Callback-/Verify-/HMAC-/Subscription-Strecke + Datenschutz-Links und App-Privacy/Deletion aufbauen und real pruefen, dann NoSend->Sende-Freigabe erst nach separater Owner-Bestätigung.
3. Verstaendliche transparente KI-DM-Datenverarbeitung/Loeschfristen/Betroffenenrechte inklusive Pete in der Datenschutzerklaerung rechtlich abnehmen und mit Runtime konfigurieren. DSGVO-Konformitaet ist nicht durch Offline-Mocks bewiesen.

Minimaler Owner-Clickpfad SPAETER (jetzt KEINE Ausfuehrung):
- Meta for Developers > Meine Apps > vorhandene App > App-Einstellungen/Grundlegendes und Instagram/Messaging-Produkt: tatsaechlichen Login-Typ, Professional-Konto und Berechtigungen lesen/screenshot-bestaetigen (keine Tokens teilen).
- Webhooks/Instagram-Subscription nur nach bereitgestelltem oeffentlichem HTTPS Callback/Verify und App Review/Freigaben pruefen. Welche Menues gelten, haengt vom verifizierten App-Typ ab.
- Datenschutzhinweis/Loeschung fuer echte IG-/WhatsApp-Pete-Chats klaeren; Meta-Privacy Policy URL und Data Deletion an der existierenden App hinterlegen, Runtime-Konfig anschliessend kontrollieren. Alle Writes/Provider-Logins/Live-Tests gesondertes Owner-GO.

## Separater oeffentlicher Shop-Check
Ein frueherer Suchmaschinen-Snapshot von /produkt/no-bullshit-elternfitness/ enthielt alte Angebotszahlen. Die DIREKT am 10.11. erneut gelesene Live-Webseite unter derselben URL lieferte HTTP200 und jetzt Selbststarter 14,95 EUR und App-Starter-Upgrade 84,05 EUR, also zusammen 99 EUR. Der alte Snapshot ist NICHT als aktueller Preisfehler gewertet. Vor Beta trotzdem echte Checkout-Werte gegen OFFER_TRUTH pruefen.

## Releasegrenzen
P1 offline-Guard technisch gruen; echter Sol-Replay/unkontrollierte Sprachvarianten nicht bestaetigt. IG-Einzelaccount-Live-Beta weiterhin NO-GO; Mehrkunden-SaaS eigene RLS/Auth-Gates separat. Kein Echtgeld-Checkout, keine reale Terminauswahl, keine neue Meta-Verbindung, keine Kosten. NAECHSTER SCHRITT: Owner-spaeter Meta-Readback der bestehenden App/Consent; vorher kann PL nur lokale NoSend-Sicherheitsgates und Datenschutzkonzept vorbereiten.
