# Funnel Pilot | Meta Pre-Live- und Owner-Test-Matrix (23.10.2026)

## Status
**Private Entwicklung, NICHT Meta-zertifiziert, NICHT live freigegeben.**
Bezieht sich auf Draft PR #191. Maßgeblich sind die jeweils aktuelle Meta Platform Policy,
die WhatsApp Business Messaging Policy und reale, neu geprüfte Konfigurationen.
Das hier ist ein technischer Kontrollplan und kein juristisches Gutachten.

## Kanäle und erlaubte Test-Einstiege
| Einstieg | Private Demo im Desktop-Pete-Labor | Realer Live-Pfad |
| --- | --- | --- |
| Instagram-DM: CHECK/KETO/BULLSHIT | Geskriptete Begrüßung, nach User-Antwort Pete. | Nur nach nachgewiesenem User-Inbound, gültigem Fenster, erlaubten Webhooks/Permissions |
| Instagram-Story-Antwort | Geskriptete Begrüßung, nach User-Antwort Pete. | User-Nachricht und Plattformfreigaben verifizieren |
| Instagram-Reel-Kommentar | Eine geskriptete private Erstantwort; KEIN DM-Inbound allein durch Kommentar. | Kommentarbezogene *Private Reply*: in der Regel 1 Antwort je Kommentar, Frist max. 7 Tage. Weitere DM erst nach echter eingehender DM/Interaktion |
| Neuer Instagram-Follower | Keine automatische Erst-DM freigegeben. | Follower allein ist kein erlaubter DM-Auslöser |
| WhatsApp eingehende Nachricht | Simulierter Kanaleinstieg, keine WhatsApp-Sendung. | Normale Freitextantwort nur im 24h-Kundenfenster |
| Facebook/Messenger | Nur Connect-Kachel im X-Wing. | Kein behaupteter echter Login/Message-Support aus der Demonstration |

## 24h, Nachfassen und Sicherheit
- Neues reguläres **24h-Service-Fenster** beginnt bei tatsächlichem eingehendem
  User-Message-Event; wird nur von erneutem User-Inbound erneuert, NICHT durch Bot-Send.
- Normale WhatsApp-Freitextnachrichten außerhalb des Fensters gesperrt.
  Zugelassene WhatsApp-Templates sind ein eigener, hier NICHT freigeschalteter
  Sonderweg mit zusätzlichen Opt-in-, Kosten- und Meta-Qualitätsregeln.
- Instagram automatische Messages nach Ablauf des regulären Message-Fensters
  nicht als normale Verkaufs-DM freigeben.
- Standard-Ghosting in Draft auf nur eine zurückhaltende Nachfrage nach 6h
  begrenzt; zusätzliche Prüfung direkt bei Outbound und keine veralteten
  24-/48-/72h-Standardnachrichten. Ein User-STOP oder Sales-Optout hat Vorrang.
- Bei Human Takeover, geblocktem Lead, fehlender Berechtigung oder fehlender
  gültiger Sender-Identität kein AI-Send.
- Weiteres Gate vor Live: Verifizieren, dass **auch verzögerte/replayed Inbound-Events**
  das 24h-Fenster nicht irrtümlich aus neuer Verarbeitungszeit öffnen.
  Es reicht NICHT, nur die älteste generische Followup-Zeit zu testen.
- Aktuell noch separat zu schließen: GitHub Issue #168 (persistentes Sales-Optout),
  Meta Permissions/App-Review, endgültiges Provider-Onboarding, Datenschutz
  und vollständiger end-to-end Test mit echten Meta-Eventformen.

## Datumsechte Termine und Kalendereintrag
- Backend Kalenderquelle `calendar` fragt das konfigurierte Calendly-Event
  bei vorhandener lokaler Berechtigung ab. Neue 14-Tage-Suche enthält den
  nächsten Freitag auch dann, wenn er knapp über 7 Tage entfernt liegt.
- Kalender-Slots bleiben **datumsgebunden**; bei fehlender oder leerer
  Providerantwort KEIN Fallback zu bloßen Wochenstunden. Lieber nur
  öffentlich bestätigten Buchungslink anbieten, als Uhrzeiten erfinden.
- Die in ChatGPT verbundene Calendly-/Google-Kalender-App überträgt **keine
  Tokens** an Funnel Pilot. `CALENDLY_PAT` oder Funnel-Pilot-OAuth müssen lokal
  separat autorisiert und verifiziert werden. Keine Credentials in GitHub.
- Vor jeder konkreten Einladung Slots erneut bestätigen, vor fester
  Buchungsbehauptung Provider-Bestätigung abwarten. Bestätigter
  Calendly-Webhook bereitet laut Offline-E2E-Test einen Google-Add-to-calendar
  Link vor, jedoch wird im Test nichts an Kunden versendet. Weitere
  Kalenderformate (ICS) nur mit bestätigter Eventzeit.

## Sicherer Owner-Test (Reihenfolge)
1. Lokale Draft-SHA, Backend, `NODE_ENV`, isoliertes `DATA_DIR`, Sol-Modell,
   API-Budget und ausgeschaltete Meta-Send-/Engine-Flags vor Ort verifizieren.
2. `FunnelPilot-XWing-Offline-starten.cmd`: Marke/Pete/Angebote als flüchtigen
   Dummy bearbeiten; Connect-Kacheln (IG, Facebook, WA, Calendly, Google Kalender,
   HubSpot) und Demo-Kampagne CHECK/KETO/BULLSHIT testen. **Keine** echten Konten.
3. Desktop-Pete-Labor: neuer synthetischer Kontakt, DM/Story/Reel-Einstieg
   simulieren, danach frei als Elternteil antworten; Quelle jeder Pete-Antwort
   kennzeichnen (geskriptet vs. echte Sol KI).
4. Termintest: ohne lokal autorisierte Calendly-API keine konkreten
   zeitgebundenen Verfügbarkeitszusagen; bei autorisierter API nur zuletzt
   verifizierte, echte Datums-Slots vorlesen. Ein Event ist erst mit
   Providernachweis gebucht. Google-Kalender-Link nur nach Beleg.
5. STOP, Human-Takeover und kein Follow-up >24h separat im Offline-Labor
   testen. Keine Live-Sends, echten Buchungen oder weiteren kostenpflichtigen
   Sol-Tests ohne neue explizite Zustimmung.

## Nachweisbasis
- GitHub: Draft PR #191, Dateien `dashboard/src/onboarding/SetupWizardModal.jsx`,
  `ProviderBrandIcon.jsx`, `backend/src/services/availability-source.service.ts`,
  `calendly-availability.service.ts`, `ai-outbound-guard.service.ts`,
  `ghosting.service.ts`, `backend/src/config/booking-e2e.test.ts`
- Kostenlose CI: GitHub Actions `Pete desktop QA - offline only` Run 39948011618,
  Backend 518/518 + 25/25 Launcher/Relay + 10/10 Budget, Dashboard 99/99.
  Das belegt Offline-Regression, NICHT neue echte Sol-Antwortqualität.
- Meta WhatsApp Business Messaging Policy:
  https://whatsappbusiness.com/policy/
- Meta Instagram Platform Messaging:
  https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/
- Meta Instagram Private Replies:
  https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/private-replies/
