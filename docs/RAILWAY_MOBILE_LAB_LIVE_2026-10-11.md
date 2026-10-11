# Railway – temporäres Pete-Testlabor online (11.10.2026)

**Betriebsprotokoll; keine Produktions- oder Meta-Live-Freigabe.** Der Geschäftsführer autorisierte den kostenlosen Trial-Start mit „Go“.

## Tatsächlich belegter Betriebsstand

- Privates Railway-Projekt `pete-testlabor-temp-2026`, Umgebung `testlabor`, Service `pete-lab-private`.
- Private isolierte Test-App: https://pete-lab-private-testlabor.up.railway.app/pete-test
- Service-ID `7a6efd7e-6cc6-4df0-b2b4-5a99844bd208`; Projekt-ID `9ec8042e-9e49-412e-b0a6-ce7f20d9b9cf`; Environment-ID `d29ac464-83d0-40be-bf26-e15a2f3348f7`.
- Quelle: Repo `VSCodeBot78/funnelpilot-whatsapp-app` **eigener temporärer Deployment-Branch** `deploy-pete-testlabor-temp-20261011`, fixierter Commit `598a93bc198a87502c0cc54ec45f23c2c6d41b67`. Dieser Branch hat zusätzlich nur für Railway einen Root-`Dockerfile`. Produktiver `main` und Integrationsbranch wurden für den Deployment-Build nicht umgestellt.
- Railway meldet für Deployment `c483934c-42b4-4f1d-9041-bd41b5452355`: **SUCCESS**, Container-Healthcheck `GET /healthz` grün, Backend ausschließlich lokal `127.0.0.1:3011`, privates Test-Gateway außen auf Port 8080.
- Railway-eigene TLS-Domain erzeugt; Railway `domain_status` bestätigt verwaltete Domain. Unautorisierter externer Test über Railway-Webhooks an `POST /lab-login` ergab HTTP **403** (korrekte Same-Origin-Sperre). **Browser-Login, GET-/Session-Schutz und echter Android-PWA-Ablauf stehen noch zur Nutzerabnahme aus**.
- Isoliertes 256-MB-Volume `pete-lab-synthetic-only`, Mount `/data/pete-lab` mit frischer Lab-Markierung. Build-Fix: `.dockerignore` darf `backend/src/data` nicht ausschließen; Volume-Schutz akzeptiert nur das **leere** ext4-`lost+found` als Systemordner. Reale fremde Dateien bleiben ein Boot-Blocker.
- Trial-Nutzung: Railway-UI zeigte 30 Tage oder 5 USD Guthaben. **Kein kostenpflichtiger Plan** eingerichtet. Für den Dienst Ressourcenlimit **0,5 vCPU / 0,5 GB RAM**, Sleeping-Modus. Railway-Verbrauch kann das Trial-Guthaben reduzieren; nicht als „0 Hostingverbrauch“ bezeichnen.
- Serverseitige Geheimnisse `LAB_ACCESS_PASSWORD`, `LAB_SESSION_SECRET`, `FUNNELPILOT_ADMIN_INGRESS_SECRET` sind nur in Railway-Variablen gesetzt; **keine Secretwerte in GitHub**. `LAB_PUBLIC_ORIGIN` stimmt mit Domain überein.
- Modellfreigabe `PETE_LLM_API_CALLS_APPROVED=false`, `PETE_LLM_CONVERSATION_ENABLED=false`, Instagram/WhatsApp deaktiviert. **Keine** echten IG-/WA-Nachrichten, keine neuen billablen LLM-Aufrufe bei der Bereitstellung.
- Historisches Pete-Testbudget `PETE_PROJECT_PRIOR_SPEND_MICRO_USD=4323801`, entspricht 4,323801 USD bisherigem Projektverbrauch und 3,676199 USD rechnerischer interner Testrestreserve gegen 8 USD Hard-Cap; **nicht** dem echten OpenAI-Prepaid-Saldo. Bei neu autorisiertem LLM-Test zuerst Baseline und Kontoguthaben erneut prüfen, ausdrücklich Freigabe einholen.

## Nächste Schritte für die temporäre Ein-Personen-Phase

1. Besitzer öffnet die HTTPS-Adresse auf **Chrome Android**, meldet sich mit dem temporären Testlaborpasswort an, verifiziert fiktiven Chat und den internen Dollarzähler, teilt bei Fehlern den Screenshot **ohne Zugangsdaten**.
2. Browser-Menü „App installieren“ / „Zum Startbildschirm hinzufügen“. Chat-Simulation ausschließlich mit synthetischen Mama-/Papa-Profilen, keine echten Instagram-Leads.
3. Echte OpenAI-Pete-Qualitätsantworten **erst nach** gesonderter Freigabe und sicherer serverseitiger Hinterlegung eines API-Keys aktivieren. Aktuell darf die UI für technische Tests deterministische Antworten zeigen.
4. Trial-Kontingent/Status regelmäßig überwachen. **Spätestens innerhalb eines Monats** das temporäre Deployment, Domain, Volume und Secrets bewusst entfernen/deaktivieren; keine kostenpflichtige Planänderung ohne ausdrücklichen Auftrag.
5. Noch offener E2E-Check: reales Android, Login, Logout, Budget nach Session, kein Zugriff auf reguläre Adminrouten. Erfolgreicher GitHub-CI-Test ersetzt diesen Test nicht.

**Keine SaaS-/Beta-Coach-Freigabe aus dieser temporären Umgebung.** Coach-Landingpage und 2–5 Beta-Coaches bleiben eigene spätere Arbeitspakete.
