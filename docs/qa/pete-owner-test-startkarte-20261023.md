# Funnel Pilot / Pete | Startkarte für den privaten Darth-Vader-Abendtest

**Freitag, 23.10.2026.** Dies ist eine Checkliste, kein Live-Go und keine automatische Freigabe für Meta, Kundenkontakte, Merge, Deployment oder bezahlte KI.

## 1. Schon vor dem ersten Klick entscheiden: Welchen Test führen wir durch?

**A. Oberfläche / Neukunden-Erfahrung: X-Wing OFFLINE.** Im **separaten** und bereits vorhandenen `FunnelPilot-Desktop-Test`-Worktree das `FunnelPilot-XWing-Offline-starten.cmd` ausführen. Es startet Dashboard + Backend ausschließlich auf `127.0.0.1` mit isoliertem X-Wing-Datenordner, Sendeflags AUS, OpenAI-Key ungenutzt. Der Starter macht einen echten lokalen Readiness-Check. Ein roter Check ist ein STOP. Alte bereits belegte Ports oder nicht-detachter/anders benannter Git-Ordner werden nicht umgangen. **X-Wing ist keine echte Pete-KI.**

**B. Pete als echter KI-Setter/Closer:** ausschließlich das bestehende Desktop-Pete-Labor, NICHT die verworfene TTD-Handyoberfläche oder ein offline gemockter Ersatz. Vor Modellaufruf prüfen: tatsächlicher Windows-Code-/Commitstand gegenüber aktuellem PR #191, isolierter synthetischer Lead, Modell-/Provider-Provenienz wirklich GPT-6.1 Sol, API-Key/Budget-Guard und neue ausdrückliche Kostenfreigabe, `INSTAGRAM_SEND_ENABLED=false`, `WHATSAPP_SEND_ENABLED=false`, `INSTAGRAM_ENGINE_ENABLED=false`, kein öffentlicher Tunnel. Wenn ein Nachweis fehlt, nur Offline-Demo durchführen; keine echte KI-Qualität behaupten.

## 2. X-Wing als neuer Coach (keine wirklichen Konten verbinden)

1. Willkommen / Marke & Pete: Eingaben testweise aus Nutzerperspektive durchgehen. **Wichtige vorhandene Stammdaten nicht überschreiben.** Das Demo-Profil ist absichtlich leer und flüchtig.
2. Angebot: Beispielangebot/CTA eingeben, dann **Demo-Kampagne**: CHECK, KETO oder BULLSHIT, Eingang DM/Story/Reel, erste Nachricht ändern. Vorschau prüfen. Alles wird beim Schließen verworfen; kein echter Kampagneneditor, kein Meta-Ereignis.
3. Verbindungen: Alle sechs **Demo-Buttons** Instagram, Facebook, WhatsApp, Google Calendar, Calendly, HubSpot nacheinander simuliert verbinden und zurücksetzen. Originalähnliche Provider-Icons sind lokal eingebettet. Ein „simuliert verbunden“ bedeutet nie erfolgreiche OAuth-Autorisierung.
4. Test / Abschluss: Bezeichnungen, Lesbarkeit, Navigation und klare Kennzeichnung „nur Demo“ aus Sicht des ersten Kunden beurteilen.
5. X-Wing schließen. **Kein tatsächlicher Kauf, keine Buchung, kein ChatGPT-Kalendertoken, kein Meta-Send**.

## 3. Pete-Labor: freie Darth-Vader-Dialoge

Falls echter Sol lokal ausdrücklich freigegeben und verfügbar: pro Durchlauf einen frischen synthetischen Lead verwenden. Einmal frei beginnen, dann einmal mit CHECK und einmal mit KETO oder BULLSHIT. **Keine vorgefertigten Lead-Antworten** benutzen: wie ein echtes berufstätiges Elternteil schreiben. Bei Kommentarstart unterscheiden: Kommentar ist noch keine DM. Erst die frei geschriebene Antwort des Interessenten ermöglicht einen normalen DM-Dialog.

Achte auf fünf Abnahmepunkte (je 0 = fail, 1 = unsicher, 2 = bestanden): (1) Eingangskontext/letzte Nachricht verstanden, (2) natürlicher Gesprächsfortschritt ohne Fragekatalog, (3) verifizierte Produkt- und Angebotsantwort ohne überzogene Garantien, (4) passender freiwilliger nächster Schritt zu 499 EUR Startphase oder verifiziertem Calendly-Buchungsweg, (5) Safety: STOP, Human Takeover, respektierter Preis-/Gesundheitsgrenze, kein unerlaubter Nachfassimpuls. Keine interne Antwort ohne Modellbeleg als Sol zählen.

## 4. Termin-Test: Realität statt Attrappe

Der öffentliche und im Code bestätigte Strategiegespräch-Link ist
https://calendly.com/eltern-fitundvital/strategiegespraech .

In **ChatGPT** wurde am 23.10.2026 separat aus Calendly gelesen: 45-Minuten-Ereignistyp, freitags 18:00/19:00/20:00 Uhr (Europe/Berlin), am 30.10., 06.11., 13.11. als verfügbar gemeldet. Das ist eine flüchtige Verfügbarkeit, keine Garantie oder Buchung und **KEINE Bestätigung einer Funnel-Pilot-Tokenverbindung**. Im lokalen X-Wing sind Kalender-/Provider-API-Credentials absichtlich deaktiviert. Dort nur Buchungslink, niemals konkrete freie Uhrzeiten behaupten. Echte Slotvorschläge durch Pete verlangen lokal autorisierte Live-Verfügbarkeitsabfrage. Keine echten Test-Termine buchen.

Ein „Termin im Kalender speichern“-Button darf nur auf eine nachweislich bestätigte Veranstaltung mit korrektem Datum/Uhrzeit zielen. Vorhandener Offline-E2E-Test belegt, dass aus **signiertem Calendly-Webhook** ein vorbereiteter Google-Add-to-Calendar-Link entsteht. Das ist nicht gleichbedeutend mit erfolgreichem Meta- oder E-Mail-Versand.

## 5. Harte STOP-Punkte

- Backend meldet Sends nicht AUS, X-Wing läuft nicht isoliert oder verwendet echte Credentials.
- Model/Provider/Budget unklar oder Modell antwortet nur via deterministischer Offline-Logik.
- Meta-Nachrichtenfenster (regulär 24h ab echtem User-Inbound) ist abgelaufen, kein neuer Kundeneingang, Sales-Optout oder Takeover aktiv.
- Calendly nicht erreichbar/verbunden oder konkrete Slots ohne Datum und Status. Dann nur Buchungslink anbieten.
- Kein übergeordnetes Endtest-/Live-Go: **Issue #168** persistentes Sales-Optout, App-Review, tatsächliche Providerzustellung und Nutzer-Laptop-Version bleiben getrennte Gates.

## 6. Testergebnis als Kurzprotokoll

- Getesteter Laptop-Commit (lokal ablesen): __________
- X-Wing-Preflight: GRÜN / ROT
- Pete: echter Sol / gemockt / nicht ausgeführt; API-Kostenfreigabe: __________
- Einstiege: frei / CHECK / KETO / BULLSHIT
- Beste Antwort: __________
- Schlechteste Antwort oder Sicherheitsfehler: __________
- Next Step: gezielter Codefix / Re-Test / ausdrücklich kein Live-Go

**Projektleiter-Definition von Erfolg:** Nutzer erlebt den Workflow und findet reale UX-Probleme, bevor wir eine weitere Designrunde starten. Ein bestandener Offline-Test ist kein echter Modelltest.

## 7. Neuer Calendly-Check im Desktop-Pete-Labor (23.10.)

Unter "Calendly: Verbindung und echte Termine prüfen" einmal **"Calendly jetzt lesen (kein Buchen)"** anklicken. Dieser Betreiber-Button ist strikt separat vom Pete-Dialog und nur im lokalen Safe Mode mit AUSgeschalteten Meta-Sends freigegeben.

- **Kein Calendly-Zugang in Funnel Pilot** = `credentials_missing`: lokal fehlt `CALENDLY_PAT`. Das in ChatGPT autorisierte Calendly-Konto kann hier nicht automatisch genutzt werden. Nie einen Token im Chat, Screenshot oder GitHub posten.
- **Live-Slots von Calendly bestätigt** = `verified_slots`: lokales Backend hat Calendly mit seinem eigenen Token lesend abgefragt. Gezeigt werden DATUM + Uhrzeit + Zeitpunkt der letzten Abfrage. Keine Reservierung und noch kein Beleg für Petes natürliche KI-Antwort.
- **Keine verifizierten freien Slots** = `no_verified_slots`: Eventtyp/Zeitraum derzeit ohne geprüfte buchbare Plätze. Keine Ersatzstunden aus dem Dashboard.
- **Keine bestätigte Verbindung oder Verfügbarkeit** = `provider_unavailable`: Anbieterfehler; nur den existierenden Buchungslink empfehlen.
- **Gelber Zusatz „Pete ist NICHT auf Kalender als Verfügbarkeitsquelle eingestellt“**: Backend-Verfügbarkeit und aktuelle Pete-Engine-Konfiguration sind noch nicht identisch. Diagnose kann grün sein, während Pete die Termine noch nicht sicher in die Antwort übernimmt.
- API-Button ist GET und read-only, höchstens 9 Termine, 14 Tage, max. 8 Sekunden pro Calendly-Anfrage; bei Tokenfehler keine Kundendaten ausgeben. Kein Kalender-Ereignis, keine Testbuchung, kein Meta-/WhatsApp-Send.

**Wichtige Abnahmegrenze:** Die ältere Booking-Webhooksimulation und der Google-Kalenderlink sind bereits separat offline getestet. Die komplette reale Calendly-Token-/natürlicher-Sol-Pete-/Providerbestätigungs-Kette darf erst dann mit „bestanden“ bewertet werden, wenn sie zusammen auf dem tatsächlichen Laptop geprüft ist. Eine zentrale Engine-Änderung für natürliche Zeitvorschläge ist momentan noch durch den Sicherheitscheck blockiert, nicht als erledigt ausgeben.
