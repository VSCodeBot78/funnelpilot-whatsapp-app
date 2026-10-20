# Pete-Labor: echter KI-Vortest (20.10.2026)

Status: Vorbereitung, KEINE Freigabe für Live-Sends oder bezahlte API-Aufrufe.

## Eindeutige Oberfläche
- Desktop-Dashboard: `dashboard/src/App.jsx` -> `view === "chat"` -> `App.chat.jsx`.
- Der Desktop-Testchat ruft `POST /test-chat/message` auf.
- `/pete-test` zeigt dagegen `MobilePeteLab` und ist **nicht** die für den heutigen Test vorgesehene Oberfläche. Die mobile TTD-Testoberfläche bleibt zurückgestellt.

## Vorbedingung für einen echten KI-Test
- Lokales Backend erreichbar: `GET http://127.0.0.1:3001/health`.
- `GET http://127.0.0.1:3001/health/readiness` zeigt die vorhandenen Felder `openAiApiKeyConfigured`, `peteLlmConversationSelected`, `peteLlmCostGateApproved`, `peteLlmProviderReady`, `peteLlmTestBudget`.
- Alle vier KI-Readiness-Flags müssen für einen **explizit freigegebenen** echten Provider-Test passend gesetzt sein. `peteLlmProviderReady` ist lediglich Konfigurations-Readiness, kein Nachweis für eine erfolgreiche OpenAI-Antwort.
- Eine echte Provider-Antwort und die Herkunft der Antwort (z. B. `peteReplySource=llm`) müssen im Testchat-Ergebnis nachweisbar sein. Deterministische Fallbacks zählen **nicht** als KI-Test.
- Niemals API-Key im Chat, Screenshot, Commit oder Log zeigen. Keine automatische Aufladung; bestehende Kostenfreigaben nicht stillschweigend erweitern.

## Strikte lokale Sicherheitsbedingungen
- `nodeEnv=development`, `localLaptopSafeMode=true`, `destructiveRoutesDisabled=true`.
- `instagramEngineEnabled=false`, `instagramSendEnabled=false`, `whatsappSendEnabled=false`.
- `genericWebhooksEnabled=false`, `instagramAllowAllSenders=false`, `instagramAutoEnableNewLeads=false`, `whatsappAllowAllRecipients=false`, Allowlist-Zähler jeweils 0.
- Keine Meta-Review, echten Sends, Buchungen, Deploys, PR-Merges oder Änderungen an ManyChat.
- Niemals die bestehende Windows-Originalkopie überschreiben; nur den isolierten Desktop-Testordner verwenden.

## Kurzer Owner-Ablauf (ein Schritt pro Rückmeldung)
1. Vorhandenen Ein-Klick-Starter im isolierten Testordner öffnen.
2. Dashboard: `$1/$2/$3` verschwunden? Leerzeichen in Buttontexten möglich? Speichern und erneut öffnen? Ghosting-Zyklen editierbar?
3. Desktop-Testchat über **Pete testen** öffnen, nicht über `/pete-test`.
4. Erst nach positivem Readiness- und Kostengate drei Eltern-Dialoge mit echter OpenAI-KI durchführen.
5. Qualität prüfen: kontextbezogene Fragen, kein repetitives Pitching, korrekte Preise/Links, Human Takeover, persistenter Opt-out (Issue #168). Bei Sales-Opt-out-Kritikalität: kein Live-Go.

## Akzeptanz
- Automatisierte Tests sind notwendige, aber keine hinreichende Bedingung.
- Ein echter KI-Vortest ist nur bestanden, wenn die Antwort nachweisbar aus dem Provider kam und keine kritische Sicherheitsverletzung auftritt.
- Vollständiges Jedi-Gate: >=18/20 Fälle, >=90/100 Qualität, 0 kritische Verstöße; danach Owner-Darth-Vader-Test.
