# Funnel Pilot – Arbeitsprioritäten 4–7 und spätere ManyChat-Ablösung

**Strategieentscheidung am 10.10.2026 – vorgemerkt, keine Freigabe für Live-Betrieb.**

## Kanal- und Kostenstrategie

1. Der **externe DM-Closer** ist nur noch ungefähr eine Woche als Benchmark im Test. **Keine Verlängerung geplant**. Die Kündigung/Abschaltung ist eine **noch auszuführende Nutzeraktion**, kein hier ausgeführter Kündigungsnachweis.
2. **ManyChat bleibt vorerst aktiv**, insbesondere für vorhandene kurze Instagram-Strecken wie Keyword KETO/Guide, Check, Story-Reaktion, Linkversand und einfache Antwortauswahl. Diese laufenden Flows werden **nicht ungeprüft abgeschaltet**.
3. **Funnel Pilot soll ManyChat perspektivisch ersetzen** und dabei **wesentlich einfacher** sein: keine aufgeblähten Flowbuilder und keine mehrfachen Werkzeuge. Ein Klick auf eine kurze Antwort-/Link-Schaltfläche soll unmittelbar zum passenden nächsten Schritt führen, während Pete den freien Dialog übernehmen kann.
4. Geschäftsziel: **ManyChat-Abokosten künftig einsparen** und Budget eher für einen eigenen **Hetzner-Server** einsetzen. Drittanbieter-/Meta-Messaging, KI-API, Betrieb, Hosting, Datenschutz und Support sind dadurch nicht automatisch kostenlos. Kosten-/Nutzenrechnung erst vor späterem Wechsel.
5. Bei parallelem Betrieb darf **immer nur ein Bot denselben Lead-/Kanal-Abschnitt bedienen**. Viele bestehende Facebook-/Instagram-/WhatsApp-Buttons unterscheiden sich technisch: Die tatsächlich unterstützten Quick-Reply-, Postback- und URL-CTA-Typen sind vor Implementation **je Kanal an den dann gültigen offiziellen Meta-APIs zu prüfen**. Keine Zusage, dass jede ManyChat-Buttonart identisch unterstützt wird.

## Aktuelle Reihenfolge: Vier **ohne Laptop** sinnvolle Prioritäten

| Reihenfolge | Thema | Umfang / messbares Ergebnis | Einschränkung |
| --- | --- | --- | --- |
| **4 – Dashboard vereinfachen** | Aufgeräumte tägliche Oberfläche für Inbox, Leads, Pete, Handover, Kanäle; Quick-Start/Status sichtbar, seltene Funktionen separat. Einfachheit bewusst gegen überladenen externen DM-Closer abgrenzen. | Minimaler UI-Ablauf, klare Beschriftungen, mobile Lesbarkeit, Frontend-Tests; keine neue komplexe Flowbuilder-Oberfläche. | Keine echten Benutzertests auf Windows möglich. |
| **5 – Startdiagnose verbessern** | Bestehenden Phase-32-Preflight und Setup-Diagnosen verständlicher machen, Fehler „was tun?“ und sichere Zustände sichtbar halten; keine technischen Rätsel. | Fail-Closed, klare Diagnose für Dashboard/Backend/Relay/Meta-Flags und lokales Schnelltest-Feedback. | Kein ungetesteter Auto-Fix und keine Live-Freischaltung. |
| **6 – Datenschutz und Betrieb vorbereiten** | Bestandsaufnahme Auth, Zugriff, gespeicherte Daten, Geheimnisse, Lösch-/Export-/Backup-Konzept, Protokollierung, Produktions-/Hetzner-Risiken. | Durchgängige Betriebs- und Sicherheitsspezifikation mit konkreten offenen Blockern/Abnahmetests. | Konzept oder sichere Regressionen ≠ gehärtetes SaaS/Produktivhosting. |
| **7 – Coach-Onboarding vorbereiten** | Spätere Coaches sollen Zielgruppe, Marke, Stimme, Angebote, erlaubte Preise, Kontaktwege, FAQs und Eskalationsregeln einfach eintragen können. | Schlankes v1-Onboarding mit plausiblen Pflichtfeldern, Vorschau/Testchat und Konfigurations-Persistenztests. | Aktuell Single-Workspace; echte Multi-Tenant-Freigabe erst nach Isolation/Authentifizierung. |

**Arbeitsmodus:** Prioritäten 4 → 5 → 6 → 7 unabhängig voneinander bearbeiten, jeweils GitHub-PR/CI prüfen und in **funnel-pilot-current** integrieren; nur synthetische Tests; null externe Sends. Diese Roadmap-Notiz startet keine Implementierung dieser vier Punkte.

## Produkt-Backlog M-01: Native kurze Button-/Link-Automationen (später, bewusst NICHT Priorität 4–7)

**Minimum statt ManyChat-Klon:**

- Eingangsregeln mit wenigen Triggern: Keyword (z. B. KETO, CHECK, GUIDE), Story-/Kommentar-Einstieg soweit offizielle APIs dies zulassen, optional Willkommen/Erstkontakt.
- Einfache **„Auswahl → Aktion“**-Bausteine: kurze Antwortauswahl, Link zu Guide/Check/Video/Checkout, gezielte Nachricht oder **Pete übernehmen**. Die UI zeigt nur **Trigger → 1–3 Optionen → Zielaktion**, kein komplexes Drag-and-drop als Voraussetzung.
- Aktionen werden an die bestehenden geprüften Angebots-/URL-Daten, Kampagnenkonfiguration und Sprachen gebunden. Keine erfundenen Konditionen, keine freien Zahlungszusagen.
- Ein Kontakt erhält eine eindeutige Zuständigkeit für jeden Schritt: **ManyChat ODER Funnel Pilot**, niemals bewusst beide. Idempotenz und Trigger-Deduplizierung, STOP/Opt-out, Human-Handover, Rate Limits, Messaging-Fenster, Sicherheitsprotokoll.
- Klein starten: zunächst **KETO → Guide**, **CHECK → Elternfitness-Check**, **VIDEO → Mini-Webinar**; Einzelflow testen, dann auf weitere Trigger und echte Kanalinteraktionen erweitern.
- Aufbaureihenfolge für spätere Umsetzung: (a) offizielle Plattformfähigkeiten & Berechtigungen je Kanal prüfen; (b) interne Flow-Datenstruktur und synthetische Ablauf-/Deduplizierungstests; (c) kompakte UI-Editorform und Vorschau; (d) jeweils EINEN echten Testlead auf offizieller Schnittstelle ohne parallel antwortenden ManyChat-Flow; (e) Trigger einzeln migrieren und abnehmen; (f) ManyChat erst kündigen, **wenn alle tatsächlich genutzten Strecken gleichwertig getestet funktionieren**.

**Keine unbelegten Plattformversprechen:** Chat-„Buttons“, IG-Quick-Replies, WhatsApp-Interaktivnachrichten und klickbare externe URLs haben je nach Kanal unterschiedliche Vorgaben. Ebenso können Metas Berechtigungen, Versandfenster, genehmigte Nachrichtentemplates und APIs Kosten/Restriktionen verursachen. Erst verifizieren, dann anbieten.

**Konkrete Abnahmekriterien für ManyChat-Abschaltung später:** Alle relevanten aktuellen Keyword-, Story-, Link- und CTA-Strecken durch echte Kanalevents nachgewiesen; keine Doppelantworten; zugestellte Buttons/Links von Testleads bestätigt; sauberes Opt-out und Human-Handover; aussagefähige Betriebsdiagnose; bewusst freigegebener Abschalt-/Rollbackplan. 

## Einschätzung zum Projektfortschritt (keine objektiven Fertigstellungs-Messwerte)

Die Prozentangaben sind grobe **Arbeits-/Reifegrade**, nicht der Anteil von „Produktiv-Reife ohne Restrisiko“. Die Bereiche sind unterschiedlich groß, daher **kein arithmetischer Durchschnitt** als Gesamtstand.

- **Lokale Codebasis und Testvorbereitung:** ca. **95 %** (230 CI-Tests bestanden, 0 echter Windows-Laptop-Abnahmelauf).
- **Eigene produktive IG-/WhatsApp-Nutzung:** ca. **60 %** (Transport-/Engine-/Sicherheitswege simuliert, echte Meta-/ManyChat-Koexistenz und Zustellung nicht freigegeben).
- **Coaches als eigenständige SaaS-Kunden:** ca. **40 %** (Onboarding-Basis vorhanden, Tenant-Isolation, Login, Betrieb, Freigaben und echte Integrationen fehlen).
- **Gesamtziel einschließlich späterer SaaS-Bereitstellung:** ca. **40 %** (Gewichtung durch fehlende Live- und Betriebsnachweise, kein rechnerischer Mittelwert).
- **Native ManyChat-Ablösung:** nur **vorgemerkt; fachliche Konzeption begonnen**, noch **keine** validierte native Button-/Link-Engine. Eine exakte Fertigstellungszahl wäre irreführend.

**Wichtig:** Phase 30 (Pete synthetisch), Phase 31 (Funnelketten synthetisch) und Phase 32 (lokaler Teststart vorbereitet) sind abgeschlossen; echte Windows-, Meta-, Calendly-/Payment- und Multi-Tenant-Abnahmen **sind weiterhin offen**.

## Umsetzung nach Roadmap-Freigabe – 10.10.2026

- **Priorität 4 (Dashboard vereinfachen): im GitHub-Code umgesetzt.** Fokussierte tägliche Navigation und Startseite, zugänglicher Pete-Testchat, mobile Inbox und kein irreführender Dummy-Lead-Fallback. Technischer Bericht: `docs/PHASE34_DASHBOARD_FOKUS_2026-10-10.md`. Echte Geräteabnahme steht aus.
- **Als Nächstes offen:** Priorität 5 Startdiagnose, Priorität 6 Datenschutz/Betrieb, Priorität 7 Coach-Onboarding.
- ManyChat-Ersatz M-01 bleibt später; in dieser Phase weder Buttons noch API-Trigger neu aktiviert.
