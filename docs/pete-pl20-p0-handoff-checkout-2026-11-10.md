# PL20 | 10.11.2026 | Zwei P0-Gates im lokalen NoSend-Labor

## Auftrag und Grenze
Owner-GO: Zwei im Dashboard-Readback bestätigte P0-Fehler korrigieren: expliziter Human-Takeover im KI-AUS-Desktop-Labor sowie ein automatischer 499-EUR-Checkout ohne vorheriges Strategiegespräch. Keine Meta-/WhatsApp-Nachricht, kein kostenpflichtiger Modellaufruf, kein Push/Merge/Deployment.

## Ausgangslage
Branch: feat/dashboard-v2-preview-20261023; Ausgangs-HEAD 5fe6d589f1444a1360b5331683df1f14e7e2e403; zu Beginn Git clean, Backend und Dashboard nicht gestartet.

## P0-1 persönliche Chatübernahme
Ursache: Im Offline-/Legacy-Pfad konnten Standard-Antworten vor dem bislang zu spät ausgeführten Handoff greifen. Fix: ausdrücklich erkannte Übernahme-Wünsche unmittelbar nach Status-/Owner-/akutem Brustschmerz-Schutz und vor dem Einstieg in Natural-/Legacy-Routing behandeln. Vorherige STOP-, Medizin-, Krisen- und Datenschutz-Klassifizierung behalten Vorrang. Persistenter Zustand owner=human, Folgeantworten unterdrückt. Negierte Übernahme getrennt geprüft.

## P0-2 499-EUR-Checkout
Ursache: mehrere historische Produktpfade (Legacy, Natural, VerifiedTransaction, Wiederholungslink, Kampagnentext) boten den 499-EUR-Kauf direkt an. Fix: diese automatischen Ausgabewege auf bestätigbare 499-EUR-Preisaussage + Strategiegespräch/Calendly statt Nutrilize-Checkout umgestellt; OFFER_TRUTH.coachingEntry.requiresHumanDecision=true. Da keine authentifizierte, serverseitig prüfbare Strategiegespräch-/Owner-Freigabe für automatische Checkout-Freischaltung existiert, bleibt die automatische 499-EUR-Linkfreigabe vorerst fail-closed. Selbststarter-Link bleibt davon unberührt. Historische Solltests wurden entsprechend der Owner-Entscheidung aktualisiert.

## Tests
- Backend TypeScript Build: Exit 0.
- Backend npm test: Exit 0, Hauptblock 669/669 PASS, zusätzlich nachgelagerte 7/7 und 34/34 PASS, alle vorgelagerten Teilblöcke ohne Fehler.
- Neuer gezielter Direktbuy-/Handoff-Testblock: 6/6 PASS (ältere Doppelroute, Ratenkauf, expliziter Human-Takeover KI-AUS im Natural-Modus, persistenter Human-Besitz, verneinter Takeover, Natural-Directbuy ohne Checkout).
- Besitzer-Laptop Safe-Starter scripts/start-owner-laptop.ps1: START OK, Dashboard 127.0.0.1:5173 und Backend 127.0.0.1:3001; sichere Session Cookie/CSRF; KI=false, Send=false.
- Authentifizierter Desktop-HTTP-POST /test-chat/desktop/message mit synthetischem Kontakt, ursprünglichem Wortlaut „Jochen soll den Chat persönlich übernehmen.“ per korrekt UTF-8-kodiertem Payload: reply=null, replySource=human_handoff, suppressed=human_owned, Folgeturn weiter human_owned: PASS.
- Separater synthetischer HTTP-Fall „Ich will das 5-Wochen-Coaching direkt kaufen.“ / „Direkt starten, ich will die 5 Wochen kaufen.“: KEIN portal.nutrilize.app in beiden Antworten, Strategiegespräch-Link vorhanden: PASS.
- HTTP-Budget-Gates vor/nach: budget.enabled=false, sendsEnabled=false, requestsStarted-Delta=0. Keine echten Modellaufrufe und keine Meta-Sends.
- Erster lokaler PowerShell-HTTP-Probelauf der Umlautformulierung war aufgrund der Shell-Zeichenkodierung nicht aussagefähig und ergab eine Botantwort. Mit expliziter UTF-8-Übertragung und dem originalen Umlautwortlaut wurde der Human-Handoff erfolgreich reproduziert. Die negative Probe wird nicht als bestätigter Produktfehler gewertet, weil der Text nicht identisch übermittelt wurde.

## Noch offen / Freigabegrenze
Die oben genannten PASS gelten für die lokale Code-/Offline-HTTP-Strecke, nicht für Meta, Facebook, WhatsApp oder echtes SaaS. Keinerlei verifizierter Provider-Webhook, Privacy/Deletion-/OAuth- oder Live-Send-GO. Reale Coach-Owner-Freigabe und serverseitiges Checkout-Approval fehlen; automatische 499-EUR-Checkout-Ausgabe bleibt deshalb AUS. P1 aus PL28 bleibt: inkonsistente Aussage zur kostenlosen Strategiegesprächsbuchung beim Folgeturn „hallo???“ (noch kein weiterer Sol-Nachtest). Persönlicher freier Owner-Human-Test und komplettes Coach-Onboarding E2E weiterhin offen.

## Nächster Schritt
Owner kann das sichere sechsstufige Coach-Onboarding und spontane Dialoge im geöffneten NoSend-Labor durchgehen. Danach P1-Faktenkontinuität gezielt offline untersuchen; für jede neue kostenpflichtige Sol-Runde eine gesonderte Freigabe einholen. Für die echte Einzelaccount-Instagram-Beta Meta-App, Scopes, Triggerrecht, öffentliche Webhooks/HMAC, Datenschutz/Deletion und Rollback separat abnehmen.
