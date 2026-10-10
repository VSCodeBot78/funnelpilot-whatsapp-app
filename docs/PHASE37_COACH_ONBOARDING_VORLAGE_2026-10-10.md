# Funnel Pilot – Phase 37 / Priorität 7: Coach-Onboarding als sichere Vorlage

**Stand: 10.10.2026.** Implementiert in GitHub für einen **lokalen Single-Workspace-Test**. Keine Coach-Konten, keine Tenant-Isolation und kein fertiges Software-as-a-Service. Eine echte Windows-/Android-Browser-Abnahme und externe Anbieter-Tests stehen noch aus.

## Ziel

Spätere Coaches sollen ohne technischen Flowbuilder die wichtigsten Daten eingeben und vorab prüfen können, ohne den laufenden Eltern-fit-&-vital-Account, Jochens Angebote oder Pete anzufassen. Deshalb speichert das System Coach-Angaben aktuell in **einer separaten Vorlage**, ausdrücklich **nicht** in den aktiven globalen Pete-Einstellungen, Kampagnen oder Checkout-Regeln.

## Bedienung

Im Dashboard unter **Verwaltung & Einrichtung → Coach-Vorlage** oder über **Einrichtung → Neue Coach-Vorlage vorbereiten**. Der geführte Bildschirm hat vier Schritte:

1. **Marke:** Markenname, Coach-Name, Nische, Zielgruppe, optionale HTTPS-Website.
2. **Pete:** Assistentenname, Sprache, Markenstimme, Regeln für die menschliche Übernahme, fachliche No-Gos und optional bis zu drei häufige Einwände.
3. **Angebote und Links:** Bis zu drei benannte Angebote mit optionalem Zielgruppentext, vom Coach exakt freigegebener **Preis-Schreibweise** und HTTPS-Zieladresse. Optional Guide-, Check-, Video- und Buchungslink. Das Speichern ist **kein Preis-Freigabenachweis**.
4. **Vorschau:** Eine **statische** Zusammenfassung plus sechs Transparenz-Checks (Marke/Coach, Nische/Zielgruppe, Assistent/Markenstimme, menschliche Übergabe/No-Gos, wenigstens ein Angebot, wenigstens ein Handlungslink). Keine erfundene KI-Antwort, kein Testlead, kein Versand.

**Wichtig:** Die sechs Checks bedeuten nur „inhaltlich ausgefüllt“, **nicht „aktiviert“ oder „für Livebetrieb zugelassen“**. Leere Preisangaben bleiben leer; kein generischer oder künstlich erzeugter Preis, Rabatt, Laufzeit oder Ratenzahlung. Die unverbindliche Vorlage darf nicht automatisch Pete-Prompt, öffentliches Angebot, Meta-Trigger, Kalender oder Bezahllink steuern.

## Technische Implementierung

- `backend/src/services/coach-onboarding-draft.ts`: Versioniertes, eindeutig als `status: draft` markiertes Datenmodell; alle Eingaben werden typisiert, getrimmt, längenbegrenzt und auf vordefinierte Felder reduziert. Zulässige optionale Links haben HTTPS, kein URL-Userinfo und keinen Fragment-Anker. Maximal drei Angebote; Preis/Link ohne Angebotsnamen wird abgewiesen.
- `backend/src/routes/coach-onboarding-draft.ts`: Nur GET und POST unter `/coach-onboarding-draft`. Die Response bestätigt ausschließlich einen Entwurf. Kein POST an Meta, OpenAI, Calendly, Checkout oder bestehende Einstellungen.
- `backend/src/app.ts`: Admin-Router montiert. Der **Produktions-Admin-Guard aus Phase 36** greift vor dem neuen Router. Lokaler Test nur über Loopback bzw. spätere authentisierte Reverse-Proxy-Konfiguration.
- `backend/data/coach-onboarding-draft.json` innerhalb des konfigurierten `DATA_DIR`: Ein separater **atomar und privat** geschriebener Speicher. Er enthält nur **eine** Vorlage, **kein** Team-/Tenant-Datenmodell. Wird die vorhandene Vorlage beschädigt, gibt GET/POST einen Fehler zurück und überschreibt die bestehende Datei nicht stillschweigend. Keine Credentials und keine Lead-DMs in diesem Modell.
- `dashboard/src/onboarding/CoachDraftView.jsx`: Vier-Schritt-Formular, sichtbarer **Entwurf/nicht aktiv**-Status, Speichern/Laden, Validierungsfehler, Vorschau. Beim Lesefehler wird das Schreiben in der Oberfläche blockiert.
- `dashboard/src/onboarding/coachDraftPresentation.js`: Reine clientseitige Anzeige-/Vorschau-Helfer; überträgt keine Felder auf die laufende Pete-Einstellung.
- `dashboard/src/navigation/dashboardNavigation.js` und `dashboard/src/App.dashboard.jsx`: Coach-Vorlage im Verwaltungsteil, keine Vergrößerung der täglichen Hauptnavigation; auch im bisherigen Wizard über einen eigenen Einstieg erreichbar.
- Responsive, tastaturfokussierbare Bedienung über `dashboard/src/workspace.css`.

## Tests und überprüfbare Abgrenzungen

- Backend-HTTP-Test erstellt synthetisches Coach-Profil, speichert und lädt es wieder, prüft exakte Preistext-Persistenz und **unveränderte globale aktiven Einstellungen**.
- Validierungstests verbieten `workspaceId`, `status=active`, `apiKey`, `aiEnabled`, `webhookVerifyToken`, verschachtelte fremde Felder, fehlende Angebotsnamen, mehr als drei Angebote, ungültige/unsichere Links, falsche Modellversion und zu lange Texte.
- Test mit beschädigter gespeicherter Vorlage prüft den **Fail-Closed-Verlauf**, ohne Datenverlust durch automatische Neuerzeugung.
- Dashboard-Tests prüfen Leerstand ohne Jochen-Vorausfüllung, sechs rein fachliche Vorschau-Checks, Filterung unerlaubter technischer Felder und getrennte Anbindung von der aktiven App.
- Das bestehende Test- und CI-Sicherheitsregime gilt weiter; alle Tests verwenden synthetische Daten und keine realen API-Aufrufe oder Verkäufe.

## Was vor der ersten Nutzung mit echten fremden Coaches fehlt

1. **Echte Identität und Berechtigungen:** Nutzer-Login, sichere Sessions, Rollen und Workspace-Beziehungen, serverseitiger Schutz **jedes** GET/POST gegen Cross-Tenant-Zugriffe. Bisher existiert **ein** lokaler Entwurf. Die UI ist **kein** SaaS-Onboarding für registrierte Fremdkonten.
2. **Mandantenbezogene Datenbank:** Eindeutige, nicht aus dem Browser frei wählbare `workspace_id` an Profile, Angebote, Kanäle, Konversationen und Lead-Daten binden; Isolationstests mit mindestens zwei synthetischen Coaches; keine Cross-Tenant-Lese-/Schreibrechte.
3. **Sichere, explizite Aktivierung:** Verifizierbare Freigabe von Angeboten/Preisen, Link-Validierung durch Betreiber, von Coaches freigegebene Pete-Stimme, klare Human-Handover-/STOP-Standards; niemals beim bloßen Speichern der Vorlage aktivieren.
4. **SaaS-Betrieb:** Hetzner-/HTTPS-Gateway mit Authentisierung, verschlüsselte und erfolgreich wiederhergestellte Backups, Datenschutz/DSGVO-Prüfung, Rechte und technische Protokollierung, echte Browserabnahme, echte Meta-/Provider-Freigaben.
5. **Produkt-Nachläufer:** Native ManyChat-Miniflows (M-01) und installierbare mobile Coach-Web-App (M-02) sind bereits im Backlog, **nicht** durch Phase 37 realisiert.

**Abnahme auf dem Laptop später:** Menüeintrag öffnen, ein vollkommen neues synthetisches Coaching-Unternehmen erfassen, Angebot mit und ohne Preis speichern, Seite neu laden, Vorschau prüfen, absichtlich unsicheren Link verwerfen, danach zum alten Pete-Testchat und Kampagneneditor wechseln und belegen, dass die Angaben von Eltern fit & vital **nicht** ersetzt wurden. Bei abgekoppeltem Backend Entwurf nicht überschreiben.

**Nächste echte Produktmeilensteine nach Prioritäten 1–7:** Gesonderte Windows-Browser-Abnahme, Auth/Workspace-Datenbank, Backend-Sicherheit/Backup-Restore, echte IG-/WhatsApp-Testkontakte in kontrolliertem Setup und erst danach Beta-Coaches. Der aktuelle Abschluss von sieben Entwicklungsprioritäten ist **nicht** die Fertigstellung des SaaS-Produkts.
