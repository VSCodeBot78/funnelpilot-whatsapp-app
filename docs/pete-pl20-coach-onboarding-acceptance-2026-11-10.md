# PL20 | 10.11.2026 | Coach-Onboarding-Abnahme im sicheren Offline-Labor

## Auftrag und Grenzen
Owner kann den persönlichen Erstkunden-Check derzeit nicht selbst durchführen und delegiert die technisch mögliche Abnahme. Ziel: sechsstufiges Coach-Onboarding prüfen, echte Grenzen der Provider-Verbindungen und Live-Beta sauber dokumentieren, ohne vorhandene Einstellungen zu verändern.
Master vorher gelesen. Besitzer-Laptop erreichbar. Keine Live-Sends, kein Meta-/OAuth-Login, kein Push/Merge/Deployment, keine kostenpflichtigen Sol-/OpenAI-Aufrufe. Nur synthetische Mustercoach-Daten in einer separaten, kurzlebigen Headless-Chrome-Session.

## Ausgangslage
- Ausgangs-HEAD 749a0dfa9f910f98f041334223188f177c0c15b8, Branch feat/dashboard-v2-preview-20261023.
- Backend /health/readiness ready, localLaptopSafeMode=true, instagramSendEnabled=false, whatsappSendEnabled=false, peteLlmCostGateApproved=false, legalLinksReady=false.
- GET /integrations/oauth/status: google_calendar, calendly, hubspot jeweils setup_required, authorizedAt=null, verifiedAt=null, syncActive=false.
- Meta: instagram requires_meta_app_setup/liveVerified=false; facebook requires_meta_app_setup/liveVerified=false; whatsapp requires_meta_embedded_signup/liveVerified=false. Diese Runtime-Befunde beweisen nicht, dass externe Konten nicht existieren; sie beweisen fehlende Funnel-Pilot-Verbindung.

## Abnahmeergebnisse
- Dashboard npm test: 102/102 PASS, Exit 0.
- Dashboard npm run build (inklusive Tests, Vite-Build und Lab-Build): Exit 0. Eine Vite-Warnung betrifft Bundlegröße, kein Build-Fehler.
- Dashboard-V2 Unit-Test: 18/18 PASS, Exit 0.
- Sechs Backend-Testdateien für Coach-Draft, Onboarding-Persistenz, OAuth-Grundlagen, Kaufvorbereitung und Produktions-Sicherheitsgates: 15/15 PASS, Exit 0. Dabei sind Provider-Antworten gemockt/synthetisch, keine echte Verbindung.
- Browser-E2E mit Headless Chrome auf http://127.0.0.1:5173/: nach lokalem UX-Fix 26/26 PASS, Exit 0. Der Durchlauf benutzt echte Browserklicks, keine DOM-Erzwingung; alle HTTP-Mutationen/externen Anbieteranfragen werden im Testkontext blockiert. Zähler: 0 angeforderte POST/PUT/PATCH/DELETE, 0 externe Anfragen, 0 Browser-Exceptions.
- Sechs Wizard-Stufen besucht: Willkommen; Marke & Pete (Pflichtnamen, leeres Testprofil); Angebote (Entwurf, Preis-/Buchungs-/Checkout-Musterwerte, Angebot, FAQ, Vorschau und temporäres Speichern); Verbindungen (alle 6 Demo-Anbieter explizit nur simuliert); Test (keine echten Kauf-/Pete-Aktionen); Fertig (nur Übungsabschluss, keine Live-Freigabe).
- Wiederholter X-Wing-Test startet nach Verlassen immer frisch auf Stufe 1 mit leeren Identitätsdaten; erfolgreicher Trockenlauf ändert lokalen echten Onboarding-Abschluss-Flag nicht.

## Aufgedeckter UX-Fail und lokaler Minimal-Fix
Vor dem Patch: Der X-Wing-Button lag in der Dashboard-V2-Ansicht hinter dem ersten Einrichtungsdialog und war im tatsächlichen Browser nicht anklickbar (1 expliziter Browser-FAIL bei 22 übrigen PASS). Schließen des Einrichtungsdialogs führte in die Kommandozentrale ohne erreichbaren X-Wing-Start. Daher zunächst kein echter Erstkunden-PASS.
Patch, ohne neues Subsystem: SetupWizardModal zeigt im REALEN Dialog den zusätzlichen sichtbaren Button "X-Wing: Erststart offline testen"; App.dashboard übergibt onStartDryRun in beiden Layoutvarianten und setzt React-key nach echtem vs. flüchtigem Setup, damit auch ein Wechsel aus einem späteren Schritt auf Stufe 1 und leere Probeidentität zurücksetzt. Browser mit normalem Click danach 26/26 PASS.
Die Änderungen werden lokal versioniert und NICHT gepusht.

## Release-Gate
PASS nur für lokale Wizard-/NoSend-/synthetische Datenabnahme. ECHTER COACH-KUNDENSTART und MEHRMANDANTEN-SAAS weiterhin NO-GO: Noch keine nachgewiesene, authentifizierte Coach-Tenant-Registrierung, getrennten Credentials/Provider-Bindings, echte Postgres-RLS-Mandantenprüfung. Eine flüchtige Coach-Vorschau ersetzt keine produktive Isolation.
Jochen-EINZELACCOUNT-IG-LIVE-BETA weiterhin NO-GO: Meta-App-/IG-Scopes/Rollen/Trigger-Legitimität, öffentlicher HTTPS-Webhook/Verify/HMAC, Datenschutz/Deletion, reale Send-Allowlist/Kill-Switch und persönliches Owner-Go fehlen. Calendly-Konto mag außerhalb von Funnel Pilot existieren; der OAuth-Provider ist laut Runtime setup_required. Kein echter Kauf, kein echter Termin, keine echte Nachricht wurde geprüft oder ausgelöst.
Der 499-EUR-Coaching-Checkout bleibt wie bereits entschieden ohne Strategiegespräch und serverseitige Owner-Freigabe deaktiviert. P1 'hallo???' Kostenfakten-Kontinuität bleibt separat offen.

## Nachweise
- Browser-Skript: dashboard/qa/coach-onboarding-wizard-smoke.cjs
- Rohlog: C:\Users\Jo\Desktop\PL20_CoachWizard_BrowserQA_2026-11-10.log
- Dashboard-Buildlog: C:\Users\Jo\Desktop\PL20_CoachWizard_DashboardBuild_2026-11-10.log
- Dashboard-V2-Testlog: C:\Users\Jo\Desktop\PL20_CoachWizard_V2tests_2026-11-10.log
- Github nicht gepusht; kein Provider-Schreibzugriff.
- Nächster Schritt ohne Owner: P1-Gesprächskonsistenz offline isolieren und Meta-/Onboarding-P0-Checks nur lesend vorbereiten. Echte Kontoverknüpfung, Bezahl- und Instagram-Live-Freigabe erfordern separate Owner-Interaktion/-GO.
