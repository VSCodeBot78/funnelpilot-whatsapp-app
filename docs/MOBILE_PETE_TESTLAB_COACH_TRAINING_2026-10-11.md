# M-03 – Mobiles Pete-Testlabor / späteres Coach-Trainingsstudio

**Idee und Geschäftsführerrückmeldung vom 11.10.2026.** Status: **vorgemerkt**, noch kein neuer mobiler Cloud-Dienst, kein echter Coach-SaaS-Zugang, keine Kostenfreigabe und keine Live-Nachrichten. Diese Idee ergänzt **M-02 (mobile Web-App / PWA)** und das bestehende Coach-Onboarding.

## Kernidee

Den bereits vorhandenen lokalen Pete-Testchat so weiterentwickeln, dass er zuerst für die eigene, geschützte Qualitätsabnahme auf Android nutzbar ist, später aber auch **als optionales, mandantengetrenntes Coach-Trainingsstudio** in die Coach-App übernommen werden kann.

**Gemeinsame technische Bausteine**, zwei strikt verschiedene Einsatzstufen:

### Stufe A – internes mobiles Testlabor (zuerst)

- Auf dem Smartphone per geschütztem Browserlink Testgespräche mit **synthetischen Eltern-Personas** führen; Laptop muss nicht ständig eingeschaltet sein, sofern die Testumgebung auf einem separat autorisierten Cloud-Entwicklungsrechner läuft.
- Android-Tastatur-Diktat: Sprache **lokal bzw. über die vom Handy verwendete Eingabemethode zu Text** umwandeln, vorhandenes Texteingabefeld verwenden. Eigene Sprachaufnahme-/Transkriptions-API **nicht** voraussetzen oder einkaufen.
- Jede Probe als einzelnes Gespräch speichern und fortsetzen, Szenario bei Bedarf neu starten, Pete-Antworten markieren: **gut / verbessern / kritisch**, mit kurzer Fehlernotiz und gewünschter Antwort. Prompt-/Konfigurationsänderungen gezielt vergleichen, nicht automatisch aufgrund eines Daumens hoch die KI „umtrainieren“.
- Klarer Modus-Hinweis: **nur Test, keine Instagram-/WhatsApp-Zustellung, keine echten Leads, keine Buchungen oder Käufe**. Bestehende STOP-, Human-Takeover- und Budget-Sicherheitsgrenzen bleiben bestehen.
- Die bestehende Testchat-Route `backend/src/routes/test-chat.ts` und `dashboard/src/App.chat.jsx` sind eine **Ausgangsbasis**, aber derzeit kein abgesicherter Internet-Testdienst. **Port 3001/5173 nicht öffentlich tunneln.**
- Hosting/Codespaces/privater Proxy erst nach Prüfung von sicherem Login/Zugang, zugelassenen privaten Ports, Datentrennung, Nutzungsgrenzen, Sitzungsdauer und Kosten. Ohne sichere Lösung vorerst lokal weiterarbeiten.

### Stufe B – optionales Coach-Trainingsstudio als SaaS-Funktion (später)

- Ein Coach kann auf seinem Handy **seinen eigenen** KI-Assistenten mit Testpersonen prüfen: Begrüßung, Markenstil, FAQs, Angebote, Einwände, Grenzen, Empfehlungen und Abschluss-/Handover-Verhalten.
- Rückmeldungen **gut / verbessern / kritisch**, Wunschformulierung und begrenztes Coach-spezifisches Wissen gehen in **prüfbare Konfigurationsentwürfe** ein. **„Schulen“ bedeutet zunächst Coach-spezifische Anleitung/Prompt, freigegebene Wissensbausteine und Evaluation, nicht automatisches Modell-Finetuning oder eigenständige Änderung von Modellgewichten.**
- Änderungen **versionieren, in Vorschau testen und bewusst freigeben**; optional automatische Vorschläge, aber **kein** ungenehmigtes Selbstumschreiben produktiver Prompts und **keine** Freischaltung echter Sends durch Training.
- Trainingsgespräche und Coach-Konfigurationen sind **strikt voneinander getrennt**. Account A darf weder Testdaten noch Angebote, Prompts, Kontakte oder Schlüssel von Account B lesen/ändern. Vor SaaS-Go: echtes Login, Autorisierung für alle Backend-Routen, Mandantentrennung im gesamten Datenfluss, Datenschutz/Transparenz, Aufbewahrung/Löschung, Provider-/API-Budgets je Mandant.
- Texteingabe mit Android/iOS-Diktat als Basis; native Audionachrichten, Audioarchiv und externe Transkriptionsanbieter sind **optionale spätere** Aufgaben und haben Datenschutz-/Kostenfolgen.
- Für Coaching-Wissen: keine unkontrollierten medizinischen Aussagen, Preis- und Angebotswahrheit nur aus explizit freigegebenen Daten; validierte Integrationen statt KI-Erfindungen.
- Perspektivisch Verbindung zur mobilen Inbox (M-02): Coach bewertet **eigene** reale Chats nur, wenn rechtlich und technisch zulässig und berechtigt; zunächst **synthetische Chats getrennt von produktiven Kontakten**.

## Nicht in den aktuellen Umfang hineinziehen

1. **Jetzt:** Leichte, mobile, abgesicherte interne Pete-Testoberfläche als Hilfe zur Phase-4-Qualitätsprüfung. **Priorität auf Erstfreigabe beibehalten**; keine echte Meta-Anbindung dadurch ersetzen.
2. **Später:** Stufe B als **M-03 / SaaS-Backlog**, nach nachgewiesener Login-/Tenant-Isolation und erfolgreicher eigener Pilotnutzung. Keine Coach-Abrechnung oder neue Infrastruktur aus dieser Ideennotiz.
3. Produktchance: Coaches bekommen nicht nur eine fertig konfigurierte KI, sondern ein einfaches mobiles **Test- und Qualitätssicherungswerkzeug**, um Antwortqualität vor Live-Freigabe nachvollziehbar anzupassen.

## Spätere Abnahmekriterien

- Besitzer erkennt unmissverständlich TEST vs. LIVE und kann aus dem Testchat **keine** echten DMs auslösen.
- Testchats sind gespeicherte, wiederaufnehmbare fiktive Unterhaltungen mit Feedback; Sprachdiktat funktioniert über Geräteeingabe ohne eigene Mikrofon-Speicherung.
- Feedback wird getrennt von aktiver Konfiguration versioniert; eine Freigabe benötigt eine bewusste Aktion.
- Rechte pro Coach und Testgespräch serverseitig überprüft, strikte Tenant-Isolation nachgewiesen; kein Browser-Schlüssel und keine öffentlichen Admin-Routen.
- Budget-/Laufzeitlimits, sichere Fehlerfälle, Mobilansicht und Datenschutzvorgaben vor einer SaaS-Freigabe abgenommen.
