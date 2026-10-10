# Funnel Pilot – STATE SNAPSHOT

Stand: 2026-10-10

## Quelle der Wahrheit

- Arbeitsbranch: `funnel-pilot-current`
- letzter technischer Stand vor diesem Snapshot: `f7710643a7375f5421a8ced434dc6a4804f5f1e3`
- CI: Backend Build grün, Dashboard Build grün
- Regressionen: 57 bestanden, 0 fehlgeschlagen

## Funktioniert

- gemeinsame Conversation Engine für Instagram und WhatsApp
- Human Takeover mit `owner=human`, `aiPaused=true` und explizitem Release
- Lead-Antworten werden während Human Ownership gespeichert, KI bleibt still
- Ghosting und Provider-Booking respektieren Human Ownership
- Instagram-Webhook Verify, HMAC, Duplicate-/Echo-Schutz und aktuelles `changes/messages`-Format
- WhatsApp signierter Webhook-Dry-Run
- Instagram und WhatsApp prüfen Ownership erneut direkt vor Outbound-Send
- Instagram Test-Allowlist und fail-closed Coexistence-Gate
- leere Instagram-Allowlist bleibt still; alle Sender nur nach explizitem `INSTAGRAM_ALLOW_ALL_SENDERS=true`
- Offer Truth: Selfstarter 14,95 €, 5-Wochen-Coaching 499 €, 6 Monate 2.499 € / 2.000 € Rest nach Anrechnung
- adaptive Qualifizierung mit Freitext statt starrem a/b/c/d
- Elternstatus Mama/Papa/Elternteil früh im Flow
- Dashboard: vier editierbare Runtime-Links (Eltern Vital Methode, Selfstarter, Elterncheck, Keto Guide)
- editierbarer 499-€-Checkout wird zur Laufzeit verwendet

## Bewusst noch nicht live

- `INSTAGRAM_SEND_ENABLED=false`
- `WHATSAPP_SEND_ENABLED=false`
- Instagram App noch nicht öffentlich / Review noch nicht eingereicht
- kein Hetzner-Deployment
- ManyChat wurde nicht verändert

## Offene Blocker / Entscheidungen

1. Meta liefert echte Instagram-DMs im aktuellen App-Status nicht zuverlässig an den lokalen Test. App-Review/Veröffentlichung erst nach internem Pre-Live-Abschluss.
2. ManyChat → Funnel Pilot braucht später ein explizites Handoff-Signal. Solange das nicht definiert ist, bleibt Funnel Pilot fail-closed statt parallel zu antworten.
3. Manuelle Human-Nachrichten werden im Dashboard/Conversation State gespeichert, externer Human-Send ist noch bewusst nicht verdrahtet.
4. Echte Instagram- und WhatsApp-Outbound-Sends müssen später kontrolliert mit Testaccount/Testnummer geprüft werden.

## Nächster exakter Schritt

Interne Pre-Live-QA ohne externe Sends:
- realistische Gesprächsmatrix gegen Pete/Conversation Engine testen
- Preis, Selfstarter, 499-€-Coaching, Elterncheck, Keto Guide, Termin, Einwände, Human Request, Stop, Nicht-Eltern
- prüfen, ob Next Best Action jeweils fachlich korrekt ist
- nur konkrete Fehler korrigieren

Danach:
- kontrollierter Instagram-Testaccount-Livegang
- ManyChat-Handoff festlegen
- Meta Review erst wenn der interne Stand abnahmefähig ist
- anschließend Server/Hetzner
