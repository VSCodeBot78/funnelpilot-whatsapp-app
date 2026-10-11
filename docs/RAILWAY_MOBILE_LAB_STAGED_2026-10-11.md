# Mobiles Pete-Testlabor – Railway Vorbereitung vom 11.10.2026

**Nur Dokumentation des Iststands. Kein Deployment / keine Live-Bots / keine kostenpflichtige Modellnutzung.**

- Railway ChatGPT-Verbindung überprüft: privater persönlicher Workspace, Benutzer registriert, **keine vorherigen Railway-Projekte**.
- Separates **privates** Projekt `pete-testlabor-temp-2026` angelegt mit Umgebung `testlabor`.
- Leerer Service `pete-lab-private` und synthetisches Persistenzvolume `pete-lab-synthetic-only` mit 256 MB und dem Mountpfad `/data/pete-lab` **nur als nicht freigegebene Railway-Staging-Änderungen** registriert. **Kein aktives Deployment, keine öffentliche Domain, kein Start des Volume/Containers**.
- Railway API kann für den **nur vorgemerkten** Service vor der tatsächlichen Freigabe noch keine Build-/Dockerfile-Parameter übernehmen: Fehler `Service Instance not found`; deshalb keine ungesicherte Live-Erstellung als Workaround.
- Railway-Account hat aktuell noch **keine per OAuth erkannte GitHub-Repository-Verbindung**. Die bereits bekannte Quelle für eine spätere sichere Bereitstellung ist `VSCodeBot78/funnelpilot-whatsapp-app`, **Branch `funnel-pilot-current`**, Dockerfile `Dockerfile.pete-lab`. Die Verbindung muss der Nutzer in Railway autorisieren; **keine** automatische Initialbereitstellung vorher.
- Nach verifizierter kostenloser Plan-/Trial-Nutzung und GitHub-Rechteprüfung: den vorgemerkten Service nur mit freigegebener Quelle, isoliertem Datenvolume, geheimen LAB-Zugangsvariablen, geprüftem HTTPS-`LAB_PUBLIC_ORIGIN`, eingeschränkter Gateway-Route-Whitelist, erzwungenen ausgeschalteten Meta-Sende-Flags und Baseline-API-Ledger starten. Erst danach Android-Installation.
- Bestehende API-Testreserve und Provider-Guthaben bleiben getrennt. `PETE_PROJECT_PRIOR_SPEND_MICRO_USD` muss vor erster Freigabe anhand des aktuellen GitHub-Ledgers erneut geprüft werden. **Keine automatische Aufladung**.
- Weitere Gate-Prüfungen vor echter Remote-Nutzung: Hosting-Freikontingent, Umgebungs-/Docker-Build, persistente Volume-Mount- und Startfähigkeit, Gateway-Login, Security-, Rate- und Origin-Tests sowie echte Android-PWA-Installation.
- **Anforderung:** Testlabor nur ungefähr einen Monat verwenden und anschließend Service, Volume, Domain und Geheimnisse in Railway bewusst deaktivieren oder löschen. Externe Beta-Coaches nicht über dieses Ein-Personen-Testlabor einladen.

**Nächster erforderlicher Nutzer-Schritt:** In Railway die GitHub-Verbindung zu `VSCodeBot78` autorisieren und Zugriff auf das Repository `funnelpilot-whatsapp-app` gestatten. Eine kostenpflichtige Planänderung ist hierfür **nicht** freigegeben.

## Repository-Zugriff bestätigt (11.10.2026, nach Benutzerfreigabe)

Railway hat `VSCodeBot78/funnelpilot-whatsapp-app` auf Branch `funnel-pilot-current` über den `connect_service_source`-Vorgang erfolgreich **im bestehenden Staging-Entwurf** hinterlegt. `describe_environment` zeigt `source.repo` und `source.branch`; der Service ist weiterhin `staged-create`, das Volume `staged-create`, `latestDeployment=null`. Diese Verbindung ist ein nachweisbarer Repositoryzugriff, **keine Deployment-Freigabe und kein laufender Server**. Wegen `Service Instance not found` bei zusätzlicher vorgemerkter Buildkonfiguration stellt ein codebasierter `railway.json`-Eintrag den privaten Docker-Build sicher. Kein neuer Tarif gewählt und kein OpenAI-Aufruf ausgelöst.
