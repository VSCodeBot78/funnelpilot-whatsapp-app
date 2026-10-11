# SaaS-Vorplanung – 2–5 Beta-Coaches: Ein-Server-Kapazität, Kosten und Testmodell

**CEO-Entscheidungsnotiz vom 11.10.2026.** Dies ist **nur eine Vormerkung**, kein Hosting-Auftrag, keine Beta-Einladung, kein API-/Meta-Send und keine Preisfreigabe.

## Nutzerentscheidungen (festgehalten)

- Das **temporäre mobile Pete-Testlabor** dient ausschließlich der **eigenen** Phase-4-Gesprächsprüfung während voraussichtlich **höchstens eines Monats**. Möglichst ein kostenloses Kontingent; **jetzt keine Einrichtung und keinen neuen Hostingdienst aktivieren**. Bei späterer Umsetzung bevorzugt kleine geschützte, fiktive Testinstanz. Die eigentliche mobile Coach-App bleibt davon getrennt.
- Für die **spätere SaaS-Beta** werden **2 bis 5 externe Coach-Tester** erwogen. Teilnehmer können **kostenlos** mittesten oder **eine noch festzulegende Aufwandsentschädigung** zahlen. Kein verbindlicher Preis, kein Abomodell, keine automatische Verlängerung oder Zahlungseinrichtung beschlossen.
- Ziel: **Ein gemeinsamer preisgünstiger Server mit strikt getrennter sicherer Datenhaltung je Coach**, nicht ein Server pro Beta-Tester. Hosting-/API-Budgets vorher transparent und begrenzt.

## Hetzner-Kandidat (Stand 11.10.2026, keine Bestellung)

**CX23:** laut Hetzner 2 Shared-vCPU, 4 GB RAM, 40 GB NVMe, 20 TB Traffic in EU. Listenpreis seit 15.06.2026 **5,49 € netto/Monat** ohne IPv4. Öffentliche primäre IPv4 **0,50 € netto/Monat** bei Bedarf; optionale automatische Hetzner-Backups ca. **20 % des Serverpreises** (1,098 € netto/Monat). Daraus **5,99 € netto bzw. ca. 7,13 € brutto mit IPv4 ohne Backup**, **7,088 € netto bzw. ca. 8,43 € brutto mit IPv4 und Backup** bei 19 % deutscher Umsatzsteuer. Snapshot-/externe Offsite-Backups, Zusatztokens, weitere Services und potenzieller Steuerstatus sind darin **nicht** enthalten.

**Wichtiger Verfügbarkeitsvorbehalt:** Die offizielle Hetzner-Produktseite kennzeichnet den **CX23 aktuell als „not available“**. Listenpreis ist **kein garantiert buchbarer Beta-Server**. Falls CX23 später fehlt: andere verfügbare Hetzner-Modelle/Regionen oder einen anderen Anbieter nach aktuellen Preisen und tatsächlicher Konto-Verfügbarkeit prüfen; **keine** implizite automatische Hochstufung. Eine **CAX11** wäre laut Listenpreis 5,99 € netto/Monat (ARM-Kompatibilität gesondert prüfen); auch diese ist auf der Produktseite teilweise als nicht verfügbar markiert. **CPX22** hat derzeit einen Listenpreis von **19,49 € netto/Monat ohne IPv4** (2 vCPU, 4 GB RAM), aktuell laut Webseite ebenfalls nicht verfügbar. Keine Preis-/Verfügbarkeitsgarantie.

**Aktuelle Primärquellen:**
- https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/
- https://www.hetzner.com/cloud/cost-optimized/
- https://www.hetzner.com/cloud/regular-performance/
- https://docs.hetzner.com/cloud/servers/overview/
- https://docs.hetzner.com/cloud/billing/faq/
- https://docs.hetzner.com/de/general/billing-and-account-management/billing-at-hetzner/value-added-tax/

## Technische Kapazitätsannahme, noch kein Lasttest

Ein **kleiner Server mit 2 vCPU / 4 GB RAM ist für 2–5 Coaches als STARTKANDIDAT plausibel**, wenn Pete seine Modellberechnung per externer OpenAI-API ausführt, die Zahl tatsächlich zeitgleicher Dialoge begrenzt bleibt, Webhooks und Jobs kurz laufen und Datenspeicherung/Backups klein bleiben. **2–5 Coach-Konten sind nicht gleichbedeutend mit nur fünf Chats:** Ein Coach kann zahlreiche IG-/WA-Leads gleichzeitig haben, daher ist die Zahl der Nachrichten, Webhooks, Jobs und simultanen Requests maßgeblich. Bei vielen gleichzeitigen Chats, Dateianhängen, Metriken, großen Prompts oder hoher Queue-Last braucht es früher mehr CPU/RAM/Storage.

**Vor Beta:** reproduzierbare synthetische Lasttests für niedrige/mittlere/höhere Anzahl paralleler Nachrichten, Meta-Webhook-Bursts, Queue-Neustart, Rate-Limits, Persistenz, Antwortlatenz und Budgetgrenzen; Observability/Monitoring; Upgrade-Plan ohne Datenverlust. Keine Zusage, dass CX23 sicher für Live-Leads genügt.

## Fixe vs. variable Kosten / pro-Coach-Kontrolle

- **Geteilter Server:** 1x Infrastrukturpreis für mehrere Coaches, nicht 5x, solange Ressourcen ausreichen.
- **Speicherung, Datensicherungen und Betrieb:** lokale Datenbank/Persistent-Disk zunächst auf Server; offsite verschlüsselte Backups mit Restore-Test nicht allein durch optionales Hetzner-Backup als vollständig abgesichert betrachten. Logs, Monitor, TLS (z. B. Let's Encrypt kostenfrei) und bestehende Domain ggf. ohne eigene Monatsgebühr; optionale Zusatzdienste nach Angebot.
- **OpenAI-API ist davon unabhängig:** Nach tatsächlich verbrauchten Tokens/Modell pro Coach; persönliche ChatGPT-Abos decken diese API-Aufrufe nicht. Pro Tenant getrennte **Ausgabengrenze, Verbrauchs-/Token-Zähler, Warnungen, harte Sperre und manuelle Freigabe von Erhöhungen**. Gesamtprojektlimit zusätzlich zentral. Keine automatische Kontoaufladung aufgrund einer Coach-Anmeldung.
- **Instagram/WhatsApp/Kalender/CRM:** Anbindung, mögliche WhatsApp-Templategebühren oder andere Providerkosten separat prüfen; kein Versprechen „kostenlos pro Nachricht“ für alle Kanäle. Jede Integrationsberechtigung/Provider-Identität dem jeweiligen Workspace zuordnen.
- **Beispiel für Beta-Finanzierung:** 2 Coaches gratis und 3 gegen optionale Aufwandsentschädigung denkbar, **ohne** festgelegte Euro-Preise. Vorher klare Testdauer, Nutzungs-/API-Limits, Erhebung echter Feedbackdaten nur mit Einwilligung/Datenschutz und ausdrückliche Regeln, ob/wann Kosten entstehen.

## Beta-Freigabe-Gates (keine Abkürzung aufgrund eines günstigen Servers)

Der derzeitige Code hat **noch keinen live angebundenen Multi-Tenant-Betrieb**. Phase 43 liefert nur das isolierte Sandbox-Modul `backend/src/data/workspace-isolation-sandbox.ts`; `docs/PHASE43_COACH_WORKSPACE_ISOLATION_2026-10-10.md` dokumentiert explizit, dass reale Inbox/Pete/Meta/Settings-/Booking-Routen weiterhin auf globale Stores gehen.

**P0 vor externen Coach-Zugängen:**
1. Benutzeranmeldung, sichere Sessions, Rollen und serverseitige überprüfte Workspace-Memberships.
2. **End-to-End-Mandantentrennung** für alle aktiven Daten/Prompts/Preise, API-Routen, Provider-Secrets, Meta-Webhooks, Queues, Follow-ups, Ghosting, Einkauf/Buchung und Logs; zwei externe Test-Coaches dürfen **niemals** Daten, Nachrichten oder Keys des anderen sehen.
3. Datenbank-/Migrationskonzept, Server-Hardening, HTTPS/authentisierter Reverse Proxy, Rate-Limits, verschlüsselte Backups mit Restore, Überwachung/Ausfallsignal, Aufbewahrung/Löschen, AVV/DSGVO- und Provider-Prüfung.
4. STOP/DNC, Human Takeover, ManyChat-Koexistenz, nächtliche Pause/Queue und Meta-Antwortfenster sowie echte Providerzustellung getrennt vom synthetischen Test nachweisen.
5. Pro Coach und insgesamt API-Budget mit Hard-Cap, Freigabe neuer Modelle, Kosten pro Gespräch und Abbruch bei ausgeschöpften Limits.
6. Erst **synthetische Einladungstests**, dann eng begrenzte echte Coach-Beta mit ausdrücklicher Geschäfts-/Sicherheitsfreigabe.

**Leitentscheidung:** Die **Anzahl der Beta-Coaches darf keinen zu frühen SaaS-Live-Start erzwingen.** Server zunächst klein kalkulieren, aber Sicherheits-/Datenisolations-Aufwand nicht durch vermeintlich günstiges Hosting unterschätzen.

## Nächster Zeitpunkt zur Entscheidung

**Nicht jetzt bestellen oder einrichten.** Nach erfolgreicher **eigener** Pete-/Instagram-Pilotabnahme entscheiden, ob 2–5 externe Coaches tatsächlich eingeladen werden sollen, ob es eine kostenlose oder kostenbeteiligte Beta wird, wie viel KI-Testvolumen je Coach freigegeben wird und welcher Cloud-Tarif dann tatsächlich verfügbar ist.

**Status:** reines, unverbindliches Protokoll. Keine Kosten entstanden.
