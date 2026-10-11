# CEO-Feedback – Funnel Pilot / WhatsApp Funnel App (11.10.2026)

**Quelle:** persönliche Produkt- und Geschäftsführerrückmeldung. **Status:** als Backlog und Abnahmekriterien erfasst; noch **keine** UI- oder Live-Implementierung beauftragt oder freigegeben.

## Leitlinien
- Entwicklungsfortschritt und parallele Entlastung im Tagesgeschäft werden sehr positiv bewertet: technische Arbeiten möglichst delegiert, damit Content, Sales und manuelle Lead-Arbeit weiterlaufen.
- Qualität hat Vorrang vor einer künstlichen schnellen Live-Freigabe. Pete soll den aktuell getesteten externen DM-Closer hinsichtlich Verständlichkeit, natürlichem Ton, steuerbarer Übernahme und messbaren Sales-Ergebnissen übertreffen.
- Externen DM-Closer nach der Testphase **nicht** automatisch kostenpflichtig verlängern; keine Abo-Aktion durch KI. ManyChat-Koexistenz bis zur sicheren Umschaltung beachten.

## UI-01 – Doppelte Einstellungen gegenüber dem jederzeit wiederöffnbaren Onboarding reduzieren

**Beobachtung:** Unter `dashboard/src/settings/SettingsView.jsx` sind umfangreiche Allgemein-, Pete-, Termin- und Integrations-Panels enthalten. Im wiederaufrufbaren `dashboard/src/onboarding/SetupWizardModal.jsx` können wesentliche Profil-, Pete-, Angebots- und Verbindungsdaten bereits gepflegt werden. Doppelte Eingabeorte verwirren.

**Zielbild:** Der Setup-Wizard ist der bevorzugte Einstieg für Grundkonfiguration, Markenidentität, Pete-Stimme, Angebote und Verbindungen. Die alltäglichen Einstellungen zeigen nur Betrieb, erforderliche Experten-/Sicherheitsparameter und Funktionen, die im Wizard nicht sinnvoll aufgehoben sind. Deutlich sichtbare Aktion **„Onboarding / Einrichtung erneut öffnen“**.

**Abnahmekriterien:**
1. Feld-/Wahrheitstabellen-Audit: welche Daten werden in Wizard, Coach-Draft und Settings bearbeitet und welche sind tatsächlich produktiv wirksam? Coach-Entwurf ist keine produktive Pete-Konfiguration.
2. Doppelte Eingabeflächen verstecken/zusammenführen, **nicht** Backend-Schlüssel, produktive Vorgaben, Sicherheits- und Rechtsfelder ohne Migration löschen. Keine stille Datenüberschreibung.
3. Gleiche Werte an beiden sichtbaren Zugängen, zuverlässiges Speichern/Neuöffnen, Rückwärtskompatibilität mit bestehenden Einstellungen; kein paralleler zweiter Konfigurationsspeicher.
4. UI-Regressionen für Desktop und Mobil, Wizard jederzeit aufrufbar, essentielle Admin-/Sicherheitseinstellungen weiterhin auffindbar.
5. Nicht im ersten Live-Sicherheitsblock eine unkontrollierte große UI-Neustrukturierung erzwingen; gezielt in separatem PR umsetzen.

## UI-02 – Zu helle, schlecht lesbare Dashboard-Schrift (bestehendes Feedback)

**Beobachtung:** Nutzer meldet zu schwache Schrift/Kontraste auf Teilen des Dashboards, besonders bei Sekundärtext. Der hier gezeigte Screenshot bildet die Fortschrittsanzeige in ChatGPT ab, **nicht** die betroffenen Dashboard-Bereiche; konkrete Stellen daher per Geräteansicht bestimmen.

**Abnahmekriterien:**
1. Lesbarkeit von Hilfetext, Feldbeschriftungen, Platzhaltern, Leadlisten, Inbox, Einstellungen und Wizard in Dark/Light-Mode überprüfen.
2. Mindestens WCAG-AA-Kontrastziel bei normalem Text 4,5:1; größere Schrift 3:1; deaktivierte Zustände separat verständlich.
3. Auf Android und Windows visuell prüfen; keine reine CSS-Behauptung als Geräteabnahme.

## PETE-01 – Kein typischer KI-Gedankenstrich

**Stand Codeprüfung:** `normalizePeteReplyStyle` in `backend/src/core/pete-conversation-quality.ts` ersetzt die langen Unicode-Zeichen `–` und `—` in validierten LLM-Antworten; die LLM-Systeminstruktion fordert schon „keine langen Gedankenstriche“.

**Offen:** Noch nicht nachgewiesen, dass **sämtliche** deterministischen/Transaktions-/Handoff-Antwortpfade sowie Vorlagen keine unerwünschten KI-Gedankenstriche oder künstliche Aufzählungssprache mehr ausgeben. Gewöhnliche Bindestriche in „KI-Assistent“ oder Produktnamen bleiben korrekt.

**Abnahme:** Repräsentative Pete-End-to-End-Ausgaben durch alle Quellen auf `–` und `—` prüfen; Stiltests auf 1–3 kurze Sätze, keine Phrasen-Schleifen, keine wiederholten Fragen, keine frei erfundenen Gesundheitsursachen; Sonderzeichen in URLs/Produktnamen nicht blind entfernen.

## LIVE-01 – Qualitätsgeführte Pilotfreigabe und echte Lead-Wirkung

- Drei Fortschrittsstände **getrennt** lassen (95 % lokaler Pete-Test, 60 % eigene IG/WA-Inbetriebnahme, 40 % SaaS-Beta); ausdrücklich **Schätzwerte, nicht mathematische Testabdeckung**. Fortschritt zusätzlich über **erfüllte/fehlende Freigabekriterien** darstellen. Prozentwerte nicht allein wegen zusätzlicher CI-Commits erhöhen.
- Phase-4-Abnahme: Windows-Lauf, sichere Testaccount-Providerzustellung, Meta-Rechte, STOP/DNC, Human-Takeover mit Race-Schutz, ManyChat-Doppelantworten, Follow-up-Sperren und sauberer Rückweg bei Defekten. Kein unbeaufsichtigter Sendebetrieb.
- Danach kontrollierte echte Instagram-Pilotgespräche mit laufender manueller Freigabe und sicherer Speicherung/Auswertung im rechtlichen Rahmen.
- Pro Gespräch qualitativ bewerten: natürlich, empathisch, Kontext gemerkt, beantwortet tatsächliche Frage, Lead-Temperatur/Kaufmotiv erkannt, sinnvoller Next Step, keine Sales-Belästigung, Human-Handover richtig.
- Umsatzwirklichkeit separat messen: qualifizierte Leads, passende Klicks, Terminwünsche, **providerverifizierte** Termine und **tatsächliche** bestätigte Käufe. Keine Conversion-Erfolgsbehauptung aus einem Chattext.
- Laufende gezielte Nachbesserung gegen den externen DM-Closer vergleichen. P0-Issue #80 bleibt offen, bis menschliche semantische Qualitätsabnahme nachgewiesen ist.

## OPTIONAL-01 – Einmonatige Claude-Code-Zweitprüfung

**CEO-Idee, keine Kaufentscheidung:** Falls sinnvoll, einen Monat Claude Pro / Claude Code parallel für unabhängigen Qualitäts-/Code-Review, UI-Korrekturen oder gezielte Entwickler-Skills testen.

**Grenzen:** Nur messbarer zusätzlicher Nutzen; keine unbeauftragten Claude-Abos, keine extra API-Ausgaben, keine eigenständige Freigabe/Merge, keine echten Lead-/Gesundheitsdaten ungeprüft an weitere Anbieter. Claude und ChatGPT können **über GitHub-Issues/PRs und Reviews** indirekt zusammenarbeiten; direkte autonome KI-zu-KI-Integration ist hier nicht eingerichtet. Eine Claude-Pro-Chat-Subscription und Claude-API-Abrechnung sind getrennt.

**Vergleich für Testmonat:** Eine klar eingegrenzte Aufgabe an Claude Code geben, einen **separaten PR** liefern lassen; unabhängige GitHub-/CI-/Sicherheitsprüfung und Review durch ChatGPT. Zählen: echte Fehler gefunden, Codequalität, Aufräumarbeit vermieden, Kosten und Zeitersparnis. Erst wenn relevant, weitere Integration priorisieren.

## Reihenfolge und Schutz
1. **P0:** Pete-Abnahmekriterien, STOP/Human/Race, IG-Testaccount und Meta-Berechtigungen; nichts live schalten ohne explizite Freigabe.
2. **P1:** Text-Kontrast und doppelte Einstellungen in separatem UI-PR, ohne Änderung bestehender Daten oder aktiver Kanäle.
3. **P2:** Claude-Code-Zweitmeinung nur optional nach Nutzenbeleg; SaaS-Tenant-Isolation erst später als eigenständiges Produkt-Gate.

**Keine tatsächliche Windows-/Android-/Meta-Freigabe, kein SaaS-GO, kein kostenpflichtiger Auftrag mit diesem Dokument.**
