# PL20 | 10.11.2026 | Instagram-Beta – synthetische Lösch-/Replay-Reparatur

## Umfang und Grenzen

Owner-GO zur nächsten sicheren Aufgabe nach P0-Audit in PETE_MASTER_STATE. Kein Zugriff auf echte Kundendaten, keine Meta-OAuth-Verbindung, kein Meta-/Instagram-Send, keine OpenAI-Kosten, keine neuen Agenten, kein Deployment/Merge/Push. Ausschließlich lokale Backend-Codeänderungen und Tests mit selbst erzeugten Daten im temporären Testverzeichnis; keine echten Leads gelöscht.

## Quellcode-Befund und Reparatur

**Vorher:** DELETE `/leads/:id` in `backend/src/routes/leads.ts` entfernte Lead und zugeordnete ConversationStates, aber nicht die getrennten Instagram-Ereignisse in `message-events.json`, deren `from`/ `raw.recipientId` noch eine IGSID und deren `messageId` noch einen Provider-Identifier enthalten konnte. Ein schlichtes Entfernen aller Ereignisse hätte den bestehenden Schutz gegen wiederholt zugestellte signierte Meta-Webhook-Ereignisse geschwächt.

**Jetzt:**
1. `backend/src/data/message-events.store.ts`: `redactInstagramEventsForSender` gleicht **exakt** `meta_instagram` plus `from === IGSID` oder `raw.recipientId === IGSID` ab. Speichert zuerst atomar das minimierte Event-Array und ersetzt erst danach den In-Memory-Stand. Für betroffene Einträge entfallen `from`, `raw`, alte ID und Klartext-`messageId`; verbleiben `provider`, gekürztes `receivedAt`, ein auf SHA-256 reduzierter ID-/Message-ID-Wert und `status:processed` als Replay-Sperrvermerk. Unbeteiligte Events bleiben unverändert.
2. `getMessageEventByMessageId` erkennt auch die pseudonymisierten Sperrvermerke; die vorhandene `meta-instagram.ts`-Route unterbindet für deren Duplikate **auch das erneute Protokollieren der Original-IGSID**. Andernfalls würde ein Replay die bereinigte Kennung wieder in `message-events.json` schreiben.
3. `backend/src/routes/leads.ts` bereinigt bei existierendem Instagram-Lead die relevanten Event-Metadaten **vor** `deleteLead`. Bei Schreibfehlern erfolgt keine irreführende erfolgreiche Lead-Löschung. Bei einem zugeordneten Buchungsereignis oder `booked`-/bestimmten strukturierten Buchungsstatus erfolgt **HTTP 409** für individuelle rechtliche Aufbewahrungsprüfung. Kein pauschales Löschen von Buchungsunterlagen. Bestehende übrige Lead-/Conversation-Bereinigung bleibt unverändert.

**Bewusste Grenzen:** Der SHA-256-Sperrvermerk ist **pseudonym und potenziell personenbezogen**, keine verifizierte Anonymisierung. Die fachlich/rechtlich festzulegende Frist und eine ggf. getrennte Dedupe-Retention sind noch offen; `MAX_EVENTS=1000` ist ein Mengencap, kein Zeitkonzept. Nach Verdrängung eines Tombstones ist eine spätere Replay-Sperre nicht mehr nachgewiesen. Es gibt noch keinen nachgewiesenen generellen DSAR-/Provider-/Backup-/KI-/Hosting-Log-Löschprozess. Löschen kann interne Systeme mehrstufig betreffen und ist nicht durchgehend transaktional; produktive E2E-Abnahme weiterhin nötig. Die Buchungsprüfung erkennt ausdrücklich mit dem Lead verknüpfte Logs, nicht nachweislos beliebige externe und unstrukturierte Records. **Deshalb kein vollständiges DSGVO- oder Live-GO.**

## Tests und Nachweise

`backend/src/config/instagram-erasure-retention.test.ts` mit temp `DATA_DIR`, lokalem Express-Server, generierten Fake-IGSIDs, Dummy-Buchungsdatensatz und fiktivem Meta-HMAC-Schlüssel. Keine Drittanbieter-Requests oder realen Kontakte:
- Lead, Conversation, eingehendes Event und Echo-Event künstlich erzeugt; DELETE `/leads/instagram:...` HTTP200, danach kein Fake-Absender oder Original-Message-ID mehr in `leads.json`, `conversations.json`, `message-events.json`. Das Event eines anderen Senders bleibt bestehen.
- Dedupe-Information im gespeicherten pseudonymen Sperrvermerk erhalten; danach **derselbe korrekt signierte synthetische Webhook** erneut an die lokale Meta-Route: `duplicates=1`, kein gelöschter Lead wiederhergestellt, keine Identität erneut in Ereignislog geschrieben.
- Getrennter Dummy-Kalendereintrag mit Lead-Referenz: DELETE verweigert HTTP409 ohne Datenverlust. Ebenfalls HTTP409 bei `booked=true`/strukturiertem gebuchten Lead, selbst ohne Event-Log.
- Fokustest **2/2 PASS, Exit0**; `npm run build` TypeScript **Exit0**; vollständiger `npm test` **Exit0** einschließlich **669/669** Hauptblock, **7/7** Learning, **34/34** Relay, übrige Vorblöcke ohne Fehler. Test dauerhaft als erster Schritt der regulären `backend/package.json`-Testsuite aufgenommen.
- Original-Logs: `C:\Users\Jo\Desktop\PL20_IG_ERASURE_BUILD_2026-11-10.log`, `C:\Users\Jo\Desktop\PL20_IG_ERASURE_FULLTEST_2026-11-10.log`.

## Nächste Freigabe-Gates

1. Rechtssichere Frist und Zweck der pseudonymisierten Wiederholungssperre, konkrete Auskunfts-/Löschprozesse samt Berechtigungen; spätere automatisierte Fristprüfung.
2. Weitere Speicher und Aufbewahrungsgründe in Buchungs-/Provider-/Backup-/Server-/KI-/Host-Logs inventarisieren und echte Testverifikation planen. Bisherige Entwickler-Mocks gelten nicht als Komplettnachweis.
3. Meta-App/Scope/Professional-/Webhook-/HMAC-/Allowlist-Readback über tatsächlich autorisiertes Meta-Developer-Konto sowie Privacy/Deletion-Hinweis; erste IG-Live-Beta weiter **NO-GO**. Auch nach dem lokalen Patch kein echter Send ohne gesonderte Owner-Freigabe.
