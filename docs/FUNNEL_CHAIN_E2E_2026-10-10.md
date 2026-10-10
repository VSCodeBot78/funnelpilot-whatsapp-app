# Funnel Pilot – vollständige Pre-Live-Funnelketten (Phase 31)

Stand: 10.10.2026. **Nur lokale Backend-HTTP-Simulation, keine echten Instagram-/WhatsApp-Nachrichten.**

## Prüfverfahren

Die Testdatei `backend/src/config/funnel-chain-e2e.test.ts` startet Express auf einer zufälligen lokalen Loopback-Portnummer und schickt echte HTTP-Requests an die **vorhandenen Routen**. Instagram- und WhatsApp-Ereignisse erhalten Test-HMAC-Signaturen, Calendly eine synthetische signierte Provider-Benachrichtigung. Die Nachrichtensender und Empfänger sind Fiktion. Bezahl- und Sendeschalter bleiben deaktiviert. Der naturnahe DM-Modus nutzt die **deterministische** Pete-Engine; es wird kein LLM angerufen.

### Nachgewiesene Durchläufe

| Strecke | Tatsächlich geprüfter Übergang | Sicherheitsbeleg |
| --- | --- | --- |
| Instagram-Neulead | Unsigned Webhook abgewiesen → signierter Neulead bleibt deaktiviert → explizite Bot-Freigabe am Testlead → Selbststarter-Antwort (14,95 €) im Dry-Run → Duplikatunterdrückung → persönlicher Chatwunsch → Jochen übernimmt → neue Lead-DM bleibt ohne KI-Antwort → manueller Dashboard-Sendeversuch bleibt Dry-Run → explizites Release → Keto-Guide-Antwort → STOP → weiterer Leadkontakt ohne Pete | Keine unautorisierte Lead-Aktivierung; Handover darf nicht mit alten Laufzeitflags sofort zurückspringen; STOP bleibt dauerhaft bestehen |
| WhatsApp | Signierter Text → Dry-Run → Duplikat → Business-App-Echo von Jochen → Human-Handover → weiterer Text ohne Pete-Antwort → explizites Release → erneuter Engine-Durchlauf | Kein falscher Live-Sendeerfolg; manuelle Antwort verhindert automatische Antworten |
| Calendly | Natürliche Strategiegesprächsanfrage → vorhandener Buchungslink aktiviert `awaiting_booking` ohne künstliche Testzustands-Korrektur → „Hab gebucht“ allein gilt nicht → ungültige Signatur abgewiesen → signiertes Testereignis führt zu `booked` → Follow-ups gesperrt → vorbereiteter Google-Kalender-Vorlagenlink → gleiches Event ignoriert → Storno führt zu `canceled` | Kein Termin erfunden, kein Kalendertermin per Google API erzeugt, kein Link bzw. Bestätigung tatsächlich versandt |
| Kauf-/Onboarding-Test | Expliziter Wunsch nach 5-Wochen-Coaching → 499-€-Auskunft → tatsächlicher hinterlegter direkter Checkout-Link → **künstlich eingespeister** `checkout.completed`-Payload → als `paid` markierter lokaler Gesprächszustand → Onboarding-Vorlage vorbereitet, aber nicht gesendet → Duplikat ignoriert | **Keine** echte Zahlung, **keine** Webshop-/Payment-Provider-Verifizierung. Diese Route ist nicht als produktive Kaufbestätigung freigegeben |
| Kaufabschluss nach STOP bzw. Handover | Dieselben künstlichen Kaufdaten kommen bei gestopptem oder menschlich übernommenem Chat an → interne Kaufmetadaten erhalten → **keine** neue automatische Onboarding-Nachricht, **kein** `onboardingPromptPreparedAt` | Keine Unterlaufung einer Kommunikationssperre durch ein anderes Funnel-Ereignis |
| Gebuchter Termin während Jochen übernimmt | Strategiegespräch → `owner=human` → verifiziert signiertes Testevent aktualisiert Buchungsdaten → es wird weder eine automatische Chat-Nachricht eingefügt noch an den Lead gesendet; Human-Handover und Follow-up-Sperre bleiben | Providerstatus und Nachrichtenverantwortung sauber getrennt |

### Behobene konkrete Fehler aus fehlgeschlagenen Zwischenläufen

1. **KI-Rückgabe nach persönlicher Übernahme blieb wirkungslos.** `releaseToAi()` änderte die Ownership, ließ aber die älteren `peteRuntimeHandoffRequested`/`peteRuntimeHandoffActive`-Flags stehen. Die nächste eingehende Nachricht aktivierte die Übernahme deshalb erneut. Nun werden bei einer **ausdrücklichen** Rückgabe diese Handover-Flags gelöscht; ein STOP-Flag **niemals**. Regression auch in `human-takeover.test.ts`.
2. **Ein synthetischer Checkout konnte einen automatischen Onboarding-Entwurf während Human-Handover oder STOP hinterlegen.** Bei Zahlungseingang werden weiter Geschäftsmetadaten erfasst, die Vorbereitungsmarkierung und der Chatentwurf aber ausschließlich erzeugt, wenn KI-Antworten erlaubt sind. Es wird nicht vorgetäuscht, dass der Kunde etwas erhalten hat.

### CI-Nachweis

- GitHub Actions `38060289516`, Code-Commit `c871e224`.
- **213 Backend-Tests + 5 lokale Relay-/Launcher-Tests + 8 Dashboard-Tests = 226 erfolgreich; 0 Fehler.** Backend-/Dashboard-Build grün.
- Die Testkette schreibt `PHASE31_CHAIN`-Protokolle für sechs vollständige Abläufe und behauptet für alle ausdrücklich **0 echte Sends**.

### Noch nicht nachgewiesen

- Instagram und WhatsApp mit **realen** Meta-Konten und echten Provider-Tokens, Meta App Review, Live-Send und zeitgleichem ManyChat/DM-Closer.
- Echt bestätigte WooCommerce-/Nutrilize-/Payment-Zahlung; das generische Checkout-Test-Webhook prüft **keine** signierte Zahlungsbestätigung und ist in Produktion standardmäßig gesperrt. Für echten Zahlungsbetrieb braucht es die korrekte Anbieterintegration einschließlich Authentizität, Produktbezug und zuverlässiger Idempotenz.
- Echtes Calendly/OAuth/Google-Calendar-API-Verhalten. Google-Kalender-Verlinkung bedeutet **keine** automatisch erstellte Kalenderveranstaltung.
- Dauerbetrieb, Mehrprozess-Nebenläufigkeit, Hetzner-Absicherung, Login/Benutzerkonten, SaaS-Mandanten, Live-Schreib-/Löschprozesse und Windows-Start.
- Die persönliche Freigabe der Tonalität durch Jochen und reales Gesprächsverhalten von OpenAI sind ebenfalls weiterhin ausstehend.

## Nachfolge

**Phase 32:** Den Windows-Laptop-Abnahmelauf maximal vereinfachen, klare Schritte, erwartete Resultate, Fehler-Abbruch und getrennte Test-/Live-Gates dokumentieren. **Noch nicht** in Phase 31 ausgeführt. Keine neue Live-Send-Freigabe.
