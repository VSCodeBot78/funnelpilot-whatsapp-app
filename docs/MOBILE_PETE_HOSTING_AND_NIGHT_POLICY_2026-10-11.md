# Pete Testlabor / späterer Livebetrieb – Kostenfreie Infrastruktur und Nachtmodus

**Stand: 11.10.2026.** Recherche und technische Bestandsaufnahme, **kein** Deployment, keine Hosting-/API-Zahlung, keine Live-Nachrichten. Basiert auf Code-Stand `funnel-pilot-current` nach PR #97/#98. Zeitlich befristetes mobiles Testlabor und späteres IG/WA-Live-System getrennt betrachten.

## Entscheidungsvorlage: mobiler Zugang ohne Windows-Laptop

| Weg | Preisstand und Grenzen | Für unser Ziel |
| --- | --- | --- |
| **Railway Free / 30-Tage-Trial** | Neue Accounts bis zu **5 USD einmalig für 30 Tage**; danach Free **1 USD Nutzungsguthaben/Monat**, kein Karten-Zwang beim Trial laut Anbieter. Resource/Volume-Quoten prüfen; Mehrverbrauch kann Freikontingent übersteigen. Offizielle Quellen: https://docs.railway.com/pricing/free-trial und https://railway.com/pricing | **Favorit für isolierten 1-Monat-Mobiltest**, vorbehaltlich sicherer Authentisierung und bestätigter Kostenlimit-/Volume-Funktion. |
| **Google Cloud Always Free e2-micro** | Eine e2-micro-VM, 30 GB Standard Persistent Disk, 1 GB ausgehender Transfer/Monat in US-Regionen; andere Ressourcen z. B. öffentliche IPv4/Netzwerk können Kosten verursachen; Billing-Einrichtung und technischer Aufwand. Quelle: https://docs.cloud.google.com/free/docs/free-cloud-features | **Dauerbetriebs-Null-Euro-Kandidat**, aber aufwendiger und Null-Euro-Garantie ohne vollständige Konto-/Billing-Konfiguration nicht gegeben. |
| **Render Free** | Gratis Node-Webservice, schläft nach 15 Minuten Inaktivität ein; **lokale Dateidaten gehen bei Neustart/Spin-down verloren**. Free-Postgres läuft nach 30 Tagen ab. Quelle: https://render.com/docs/free | **Nicht** für bestehenden dateibasierten Pete-Ledger oder dauerhafte Nachrichtenwarteschlange; höchstens statische Demo ohne persistenten State. |
| **Bestehender Windows-Laptop + Cloudflare Access/Tunnel** | Möglicherweise **0 EUR zusätzliche Cloud-Hostinggebühr**; Strom/WLAN/Windows laufen aber kontinuierlich. HTTPS + Cloudflare Access vor restriktivem Gateway nötig; **niemals Ports 3001/5173 öffentlich exponieren**. Quelle: https://developers.cloudflare.com/cloudflare-one/setup/secure-private-apps/private-web-app/ | Nur falls Laptop ohnehin 24/7 läuft. Bei Strom/Netz/Standby kein zuverlässiger Webhook-Empfang. |
| **Railway Hobby** | **5 USD/Monat Mindestbetrag**, inklusive 5 USD Nutzungsbudget; Ressourcen oberhalb dieser Summe zusätzlich; separates Infrastruktur-Hard-Limit ist einstellbar. Quellen: https://docs.railway.com/pricing/plans und https://docs.railway.com/pricing/cost-control | Bezahlfallback für 1–2 Monate nach ausdrücklicher Bestätigung; vorab harte Ausgabenobergrenze und Shutdown-Risiko festlegen. |
| **Hetzner CX23** | Seit 15.06.2026 **5,49 EUR/Monat netto ohne IPv4**; zzgl. Umsatzsteuer und ggf. weiterer Optionen. Quelle: https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/ | Später robustere eigene Infrastruktur, aber mehr Administration und nicht der einfachste temporäre Handyzugang. |

**Fazit:** Jetzt **nur kostenlose Nutzung** anstreben; Railway Free/Trial zuerst fachlich prüfen. Bei echter Nutzung zählt zusätzlich, ob Filesystem, Auth, HTTPS und Neustartfähigkeit vorhanden sind. **Keine** ungesicherte Gratis-Demo, die falsche Kosten- oder Chatdaten zeigt. Nach max. 30 Tagen aktive Entscheidung, kein stilles Upgrade.

## Wichtiger technischer Blocker vor Remote-Installation

- Der produktive Backend-Einstieg `backend/src/index.ts` bindet bewusst **127.0.0.1**; dies ist eine Schutzvorgabe. Ein Railway/Render-Prozess lässt sich nicht einfach als ungeschützter Express-Port öffentlich freigeben.
- Ein ausdrücklich konfigurierter HTTPS-/Auth-Gateway/Reverse Proxy muss die statische `/pete-test`-Oberfläche und **nur** `/test-chat/lab/budget`, `/test-chat/lab/message`, `/test-chat/lab/state/:leadId` erreichbar machen. Andere Admin-, DM-, Kampagnen- und Leads-Routen bleiben unzugänglich.
- **Frische isolierte `DATA_DIR` mit persistenter Storage**, verbrauchsbasierter Hard-Cap (Phase-3-historische Kosten `PETE_PROJECT_PRIOR_SPEND_MICRO_USD` nochmals prüfen), geheime OpenAI-Keys nur serverseitig, sichere Session/CSRF-/Rate-Limits. Nie lokale JSON-Kundendaten aus dem echten Projekt kopieren.
- PWA-Startbildschirm-Icon ist nur eine Verknüpfung, **kein** Ersatz für Authentisierung. Nur HTTPS über Zugangskontrolle (z. B. Cloudflare Access) und gesonderte Android-Prüfung; nicht automatisch verfügbar durch PR-Merge.
- Unbeaufsichtigte API-Kosten bleiben ausgeschaltet bis zur ausdrücklichen Budgetfreigabe. Separate Railway-Infrastrukturausgaben **nicht** mit OpenAI-API-Testkosten verwechseln.

## Laptop zugeklappt vs. Android-Handy als Host

**Windows-Laptop:** Beim Zuklappen kann „Nichts unternehmen“ eingestellt werden. Windows muss wach, mit Strom/Internet verbunden bleiben. Updates, Neustarts, Stromausfälle und Netzverbindungsabbrüche verhindern einen garantierten Webhook-Dauerbetrieb. Nur im kontrollierten Test mit Monitoring und sicherer Domain/Proxy. Kein automatischer Produktions-Go.

**Android-Handy:** Technisch wären Node/Termux-artige Prozesse möglich, aber Android-Stromsparregeln, Prozessabschuss, Flugmodus, wechselnde IP/NAT, Neustarts und privater Webhook-Zugang machen einen zuverlässigen 24/7-Meta-Server unpraktisch. Als PWA-/Testclient ideal. **Bei Cloud-Hosting sind Pete und Webhooks unabhängig davon online, ob das eigene Handy Flugmodus hat.**

## NIGHT-01 – gewünschte Nachtpause für IG/WA (noch nicht implementiert)

**Produktanforderung:** Nachts keine ungefragten, sofortigen automatischen Pete-Antworten; eingehende Nachrichten möglichst sicher registrieren und **erst am folgenden Morgen** sinnvoll beantworten. Lokale Zeit für diesen Business-Workspace: `Europe/Berlin`; Ruhezeiten erst durch Betreiber konkret festlegen, nicht ungefragt 22–08 Uhr erzwingen.

**Iststand Code:** Instagram `backend/src/routes/meta-instagram.ts` verarbeitet erlaubte Webhooks heute **direkt** via `processIncomingMessage` und kann danach bei freigegebenen Flags sofort an Meta senden. `backend/src/services/ai-outbound-guard.service.ts` kennt STOP, Human-Owner, AI-Pause und Sales-Follow-up-Opt-out, aber **noch keine Nachtpause/Queue/Meta-24h-Window-Freigabe**. Die vorhandenen Ghosting-Sendezeiten gelten nicht automatisch für direkte Antworten.

**Soll-Ablauf:**
1. Externer Webhook-Empfänger läuft auch nachts, prüft Signatur und Duplikat-IDs und speichert den Eingang persistent. **Server nachts komplett auszuschalten ist keine sichere Nachrichtenwarteschlange**; auf unbegrenzte Provider-Retries nicht verlassen.
2. In Ruhezeiten nur Eingang speichern, mit Uhrzeit/Lead/Kanal und ausdrücklich vorgegebener Reaktionsfreigabe in eine **durable Queue** übernehmen; **keine** Pete-Nachricht erzeugen oder über IG/WA absenden, wenn dadurch Budget oder Vorabfreigabe umgangen wird.
3. Beim Morgenlauf je Lead den **neuesten gesamten Kontext** und weitere nachts eingegangene Nachrichten ansehen, einmalig passenden nächsten Schritt ermitteln. Kein Versand veralteter vorbereiteter Antworten.
4. Vor **jeder** morgendlichen Sendung erneut prüfen: expliziter STOP/DNC, kein-Verkaufsnachfassen, human/aiPaused, erlaubter Empfänger, ManyChat-/DM-Closer-Koexistenz, keine Doppelantwort, Provider-Zustellberechtigung und aktuelles 24h-Nachrichtenfenster.
5. Meta erlaubt für automatische Antwort in Instagram-/WhatsApp-Gesprächen grundsätzlich nur ein an Kundennachrichten gebundenes **24-Stunden-Zeitfenster**. Wird es überschritten, **keine** verspätete automatische Standardantwort; gesondert menschlich bearbeiten bzw. kanal- und policykonforme Alternative. Instagram-Quelle: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api ; ergänzende Policy: https://help.manychat.com/hc/en-us/articles/23358636027932-Understanding-messaging-windows
6. Bei Webhook-/Provider-Fehler, Queue-Neustart und Budget-/Netzausfall **fail-closed**, sichere Wiederholung ohne Duplikate. Zustände `received/queued/ready/blocked/sent/failed` unterscheidbar; keine behaupteten Sends nur wegen vorbereitetem Text.
7. Uhrzeit und Erfolg zuerst in **synthetischen Tests** prüfen (Sommer-/Winterzeit, letzte Nachtmessage, STOP während Warteschlange, Human Takeover, 24h-Ablauf); später nur kontrollierter Meta-Testaccount.

**Nicht jetzt:** Live-Nachtmodus aktivieren, Scheduler mit echten Meta-Nachrichten starten, externe Webhooks auf Handy/Laptop publizieren, automations/ManyChat verändern oder Echtkunden anschreiben. Die vorgeschlagene Morgenautomatik ist **separates Sicherheits-/Qualitäts-Arbeitspaket vor IG-Live-Go**, nicht Voraussetzung für ein rein fiktives mobiles Pete-Testlabor.

## Nächste konkrete Schritte
1. Kostenlosen Railway-Account / Trial vom Nutzer verbinden/freigeben; Ressourcen- und Volume-Quota sowie Hard-Cap ansehen **ohne** kostenpflichtige Planänderung.
2. Sicheren minimalen Server-Adapter und Auth-Gateway nur für synthetisches Testlabor vorbereiten, CI/Ratelimits/CSP testen, persistenten Budget- und Chat-Speicher verifizieren; keine reale DM-Anbindung.
3. Erst nach Kosten- und Zugangsprüfung isolierte Testumgebung bereitstellen; Installation als Android-Startbildschirm-App mit authentisierter HTTPS-Domain abnehmen.
4. NIGHT-01 erst vor kontrolliertem IG/WA-Livebetrieb als eigenständige Code-Änderung mit Tests priorisieren.
