# SaaS-Isolation: technischer Befund und Migrationsplan (20.10.2026)

**Status:** Read-only-Codeprüfung und Architekturentwurf. Keine Schemaänderung, kein Merge/Deploy, keine Datenmigration und keine produktiven API-Aufrufe. Priorität nach dem privaten Pete-Test und dem regulären Gate #168.

## Nachweisbarer Ist-Zustand (Branch vom 20.10.)

1. `backend/src/data/campaigns.store.ts`: `CampaignRecord` enthält `offerContext`, `entryConfig` und `peteCampaign`. Speicherung über eine gemeinsame Datei `DATA_DIR/campaigns.json`; `getAllCampaigns` liest die gesamte Liste, `getCampaignById(id)` sucht ausschließlich per Kampagnen-ID, `saveCampaign` ersetzt nach Kampagnen-ID. Im geprüften Ausschnitt keine Mandanten-ID oder mandantenbezogene Abfrage.
2. `backend/src/routes/campaigns.ts`: `GET /` liefert `getAllCampaigns()` zurück. Die aktuelle Produktions-Admin-Sicherung ist kein Ersatz für eine spätere Autorisierung pro Coach.
3. `backend/src/routes/test-chat.ts`: Der Desktop-Endpunkt `POST /message` akzeptiert `leadId`, `campaignId`, `messageText`; `GET /state/:campaignId/:leadId` liest nach diesen Parametern. Die mobilen Labor-Routen sind enger begrenzt, dürfen aber nicht als allgemeines SaaS-Autorisierungskonzept übernommen werden.
4. `backend/src/services/pete-api-budget.service.ts`: gemeinsames persistentes `DATA_DIR/pete-api-budget.json` mit exklusiver Dateisperre, Reservierungen und globalen Labor-/Projektlimits. Laut Modulkommentar kein OpenAI-Account-weites Ausgabenlimit. Für SaaS später getrennte Kostenzuordnung je Coach nötig.
5. `backend/src/services/production-admin-guard.ts`: authentifizierter Reverse-Proxy-Zugang als Produktionsschutz. Eine eingeloggte Admin-Person ist nicht automatisch für die Daten anderer Coaches berechtigt.

## Zielarchitektur (Entwurf, nicht implementiert)

- Jede fachliche Ressource erhält serverseitig erzwungene `tenantId`: Kampagnen, Leads, Konversationen, Settings, Integrationen, API-Verbrauch, Versandversuche und Audit-Ereignisse.
- Identität/Autorisierung über vertrauenswürdige serverseitige Session/Token-Prüfung. `tenantId` niemals ungeprüft aus einem Browser-Request übernehmen.
- Abfragen und Mutationen werden an den autorisierten Tenant gebunden; zusammengesetzte Schlüssel `(tenantId, campaignId)` und `(tenantId, leadId, campaignId)` vermeiden Kollisionen. Keine globalen `getAllCampaigns()`-Antworten für Coach-Konten.
- Meta-Accounts, Webhook-Signaturen, Tokens und Reply-Berechtigungen pro Tenant isolieren. Sender/Empfänger müssen vor jeder Verarbeitung dem Tenant zugeordnet werden.
- Ledger zunächst weiter strikt fail-closed; erst nach fachlicher Freigabe ein Tenant-Usage-Ledger ergänzen, ohne vorhandene Budgetreservierungen, alte Ledger-Dateien oder genehmigte Limits zu löschen/überschreiben.
- Rollen: Betreiber/Admin, Coach/Owner, ggf. Mitarbeiter mit expliziter Berechtigung. Cross-Tenant-Zugriffe standardmäßig 403/404, ohne fremde Daten zu verraten.

## Reihenfolge für spätere Umsetzung

1. Dateninventar, Backups und unveränderliche Legacy-Tenant-Zuordnung definieren; Bestandsdaten nicht automatisch migrieren.
2. Mandantenidentität, Rollen und API-Autorisierung festlegen.
3. Speicher-/Schema-Migration separat planen und reversibel prüfen.
4. Backend-Abfragen, Writes, Webhooks, Outbound-Guards und Ledger tenantgebunden absichern.
5. Erst dann Coach-Onboarding, SaaS-Dashboard und Abrechnung entwickeln.

## Abnahme vor SaaS-Beta

- Coach A kann weder Kampagnen noch Leads, Chats, API-Kosten oder Integrationen von Coach B lesen oder ändern.
- Gefälschte `tenantId` in URL/Body/Header verschafft keine Berechtigung.
- Gleichnamige Kampagnen/Leads zweier Coaches kollidieren nicht.
- Human Takeover, STOP, Sales-Opt-out, Provider-Events und Versandversuche bleiben tenantgebunden.
- Neustart/Mehrprozess-Test erhält Reservierungen, Kostenhistorie und Isolation.
- Kein SaaS-Live-Go ohne unabhängige Sicherheitsprüfung.

**Bewusste Nicht-Ziele vor dem Darth-Vader-Test:** neue Tabellen/Dateiformate, Abos, Zahlungsanbieter, Login-UI, Tenant-Migration, Live-Deploy.
