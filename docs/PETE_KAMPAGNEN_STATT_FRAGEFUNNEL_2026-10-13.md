# Produktentscheidung: Von Frage-Funnels zu KI-Kampagnen (13.10.2026)

Status: **Architektur- und UX-Zielbild für eine spätere Dashboard-Überarbeitung.** Noch keine UI-Migration, keine Löschung, kein produktiver Send-Betrieb und keine Kostenfreigabe.

## Unternehmerische Entscheidung

Pete soll nicht länger als klassischer WhatsApp-Fragefunnel mit A/B/C/D/E-Pflichtantworten erscheinen. Stattdessen agiert er als kontextbewusster, natürlicher **KI-Setter und bei klarer Kaufabsicht vorsichtiger Closer**. Ihm werden Gesprächsführung, sachliche Einwandbehandlung, Gesprächsfortschritt, vier situative Kommunikationsstile und respektierter Kauf- bzw. Kontaktverzicht beigebracht. Kein kostenloses individuelles Coaching.

Die vier Farben (Rot, Blau, Grün, Gelb) steuern *wie* Pete auf geäußerte Bedürfnisse antwortet, nicht *welche festgelegte Frage* als Nächstes gestellt wird. Persönlichkeit nicht aus einzelnen Stichworten definitiv zuschreiben. Die Verkaufsprinzipien aus Gereon Jörns 'Verkaufen beginnt beim Nein' dienen als **konzeptionelle Inspiration**, nicht als wörtlich kopierte Buch-/Skript-Inhalte; ein klares Nein und finanzielle Grenzen sind zu respektieren.

## Zielbild: Kampagne beschreibt Kontext, nicht Gesprächsbaum

Pro Kampagne genügt perspektivisch eine kompakte Konfiguration:
1. **Name, Kanal und Quelle**: Instagram organisch, Reels/Story, Meta Ads (IG/FB/Click-to-WhatsApp), Website/WhatsApp, jeweils Trigger/Keyword und nachweisbare Attribution (z.B. Ad-ID) optional.
2. **Versprechen und Einstiegsantwort**: Was wurde in Ad/Story/DM zugesagt? (z.B. CHECK, KETO, GUIDE). Ressource unverzüglich über die freigegebene Link-/Transaktionslogik bereitstellen; keine künstliche Vorqualifizierung davor.
3. **Absicht und Ziel**: Guide ausliefern, Check starten, Interessent einordnen, passenden Termin anbahnen, freigegebenes Einstiegsangebot anbieten. Optional Kampagnenziel als interner Schwerpunkt, nicht als Zwang zum Pitch.
4. **Angebots- und Faktenbezug**: Zentral geprüfte Produkttexte, Links, Preise, Verfügbarkeit, Onboarding/Terminpfade. Nicht pro Kampagne nochmals widersprüchliche Preise eingeben.
5. **Ton-/Sicherheitsgrenzen**: zentral konfigurierbare Pete-Persönlichkeit, situative Vier-Farben-Logik, kurze DM-Stimme; verpflichtende STOP-/Opt-out-/Human-Takeover-/Medizin-/Datenschutz-/Outbound-Regeln gelten überall.
6. **Messung**: Kampagnenquelle, ausgelieferte Ressource, qualifizierte Gespräche, ausdrückliche Unterstützungs-/Terminwünsche, providerbestätigte Termine und tatsächliche Käufe statt Anzahl beantworteter Quiz-Fragen.

## UI-Ziel

- Primärnavigation: **Inbox / Leads / Kampagnen / Angebote & Wissen / Pete / Ergebnisse / Integrationen** (Bezeichnungen sind Vorschlag, keine beauftragte aktuelle Navigation).
- Kampagnen-Editor soll maximal wenige gut benannte, einklappbare Bereiche haben: Quelle, Versprechen/Link, Ziel, optional erweiterte Einstellungen.
- Historische Schritt-Texte, A/B/C/D/E-Frageblöcke, Skalen, verpflichtende Namen-/Elternkontext-Abfragen, identische Booking-Textfelder und der klassische Flow-Builder verschwinden aus der **Standardoberfläche**.
- Falls für bestehende Kunden oder Migration nötig: Alte Konfiguration unter **Legacy/Erweitert** lesbar und reversibel belassen, bis Migration durch Tests abgesichert ist.
- **Spezielle Meta-Ad-Kampagnen bleiben ausdrücklich möglich**: Unterschiedliche Anzeigen dürfen unterschiedliche Einstiegsversprechen, Links, Quellen und Messziele haben. Pete liest diesen Kontext vor der ersten Antwort, bleibt aber im Gespräch flexibel und kann bei erkennbarem Bedarf das Ziel wechseln.
- Kein zweiter Systemprompt pro Kampagne, der zentrale Pete-, Sicherheits- oder Angebotsregeln überschreibt.

## Technischer Befund (Repo geprüft)

- `dashboard/src/campaigns/CampaignEditor.jsx` enthält umfangreiche alte Kampagnen-/Text- und Funnel-Eingaben, etwa `askNameFirst`, Fallback-Slots und WhatsApp-Einstiegsparameter.
- `backend/src/config/campaigns.ts` definiert weiterhin einen historischen `flow` mit `situation_choice`, `goal_choice`, Skala und Commitment sowie A/B/C/D-Antworten.
- `backend/src/core/conversation-engine.ts` besitzt bereits einen separaten LLM-/Natural-Pfad und die geprüfte Transaktions- und Sicherheitslogik.
- Deshalb **zuerst** den stabilen, natürlichen Pete-Pfad qualitativ freigeben, **danach** den Dashboard-Editor neu modellieren. Frontend-Felder bloß auszublenden ist noch keine sichere Abschaffung des Legacy-Backends.

## Migrationsreihenfolge / No-Gos

1. Bestand aller tatsächlich wirksamen Kampagnenfelder, abhängigen Stores und Trackingfelder aufnehmen, einschließlich neuer und alter Integrationen.
2. Schlankes Kampagnen-Datenmodell mit zentraler Faktengrundlage festlegen. Historische Datensätze unverändert lesbar und migrierbar halten.
3. Editor-UX zuerst isoliert als Entwurf/PR, Mobil- und Desktop-Ansicht testen.
4. E2E-Prüfung für organische Leads, KETO, CHECK, BULLSHIT, Meta-Ad-Attribution, Click-to-WhatsApp, Bookings, Käufe, STOP, Opt-out, Human-Handover und Race-Guard.
5. Erst nach expliziter Freigabe umstellen. **Nicht** live löschen, automatische Nachrichten aktivieren, unfreigegebene API-Kosten erzeugen oder bestehende Kampagnen-IDs/Leads verschieben.

Erfolgskriterium: Ein Coach beschreibt nur noch, **woher der Mensch kommt und was versprochen wurde**. Pete führt das eigentliche Gespräch eigenständig im freigegebenen Rahmen. Komplexität im Dashboard und unnötige Wiederholung sinken, ohne Tracking, Vertriebssteuerung oder Sicherheit zu verlieren.
