# Phase 2: Pete KI-Gesprächsarchitektur, Sicherheitsprüfung

Datum: 10. Oktober 2026
Stand: PR #76, auf GitHub vorbereitet, Tests durch CI

## Ausgangslage

Der erste reale Laptop-Dialog (#73) scheiterte an starren Fragebausteinen. Phase 1 (#75) legte einen optionalen LLM-Pfad an, aber ohne echte KI-Qualitätsnachweise. Phase 2 soll genau diese technische Trennung absichern. Alle Modellantworten in dieser Phase sind künstlich und offline gemockt.

## Umsetzung

- Vier unabhängige Voraussetzungen vor API-Datenverkehr: Auswahl des Pete-LLM-Pfads, zusätzliche explizite API-Kostenfreigabe, vorhandener API-Schlüssel sowie gespeicherte Admin-Einstellung aiEnabled. Der neue Kosten-Schalter PETE_LLM_API_CALLS_APPROVED bleibt standardmäßig false. Vorhandene Schlüssel oder ein Dashboard-Häkchen alleine verursachen dadurch keine neuen Pete-Modellanfragen.
- Nach einer ausstehenden KI-Anfrage wird der aktuelle Gesprächszustand frisch geladen: STOP, menschliche Übernahme, AI-Pause oder eine jüngere Nachricht verhindern das spätere Einfügen einer alten Antwort.
- Eine explizite Bitte um Übernahme durch Jochen führt zu echter Human-Ownership und nicht zur Terminbuchung. Coaching-Begleitung ist nicht automatisch ein Wunsch nach sofortiger Chatübernahme.
- Mehr Preisfragen, Zahlungsbehauptungen, Buchungsangaben, Ressourcen und Bot-Identitätsfragen werden an die deterministische Quelle verwiesen. Die Identität beantwortet Pete faktisch und ohne KI.
- Anbieter-Kontext wird auf 36 Nachrichten und maximal ungefähr 12 KB begrenzt. Bekannte E-Mail-, Telefon- und API-Schlüsselmuster werden vor der Übergabe ausgeblendet. Das ist ausdrücklich kein vollständiger Datenschutzfilter und ersetzt weder Einwilligung noch AVV oder juristische Prüfung.
- Der lokale Testchat weist die Antwortquelle und Unterdrückungsgründe aus. Die geschützte Admin-Readiness zeigt Featureauswahl, Kostenfreigabe und Konfigurationsbereitschaft, aber keine Geheimnisse.
- Fehlerhafte oder nicht freigegebene Modellantworten führen zur menschlichen Übernahme, nicht zum bereits gescheiterten automatischen Fragebogen.

## Umfang der Offline-Tests

- Kein externer API-Zugriff bei vorhandenen alten Schlüsseln ohne zusätzliche Kostenfreigabe.
- Korrekte Trennung zwischen deterministischen Transaktionsantworten und freien LLM-Antworten.
- Echte Human-Ownership bei ausdrücklich gewünschter Chatübernahme.
- Asynchroner Konflikt während Modellwartezeit: persönliches Handover, STOP, neuere Lead-Nachricht.
- Anbieter-Datenminimierung und verifizierte Output-Schranken (keine Preis-, Buchungs- oder Bestätigungsphantasien).
- Vorhandene Sicherheits-, Meta-/WhatsApp- und Dashboard-Tests bleiben in der regulären CI.

## Noch nicht freigegeben

Phase 2 bestätigt technische Eigenschaften mit simulierten Modellausgaben. Es hat keine 50 echten KI-Chats gegeben und keine Modellqualität wurde bewiesen.

Vor Phase 3 braucht es eine ausdrücklich genehmigte kleine API-Kostengrenze sowie eine Prüfung und Freigabe des Umgangs mit Chatinhalten. Bis dahin keine kostenpflichtigen KI-Aufrufe.

Die bisherigen Regeln und Textbausteine können bei geprüften Produkt-, Preis- oder Terminwegen weiterhin mechanisch wirken. Das bleibt ein Qualitätsrisiko für Phase 3.

Bei Human-Handover kann der bestehende Outbound-Guard die vorbereitete Bestätigungsnachricht zurückhalten; im Dashboard muss die menschliche Übernahme dennoch sichtbar bleiben. Vor produktivem Versand ist die tatsächliche Zustellung gesondert zu prüfen.

Phase 4 ist die persönliche Laptop-Abnahme erst nach bestandenem Phase-3-Härtetest.

Kein Cloud-Tunnel. Keine Instagram- oder WhatsApp-Live-Schaltung. Keine Konfigurations- oder API-Kostenfreigabe in Phase 2.
