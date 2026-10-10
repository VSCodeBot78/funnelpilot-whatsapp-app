# Funnel Pilot – Priorität 4: Dashboard auf tägliche Arbeit reduzieren

**Stand: 10.10.2026.** Implementierte UI-Änderungen ohne echten Windows-/Android-Browsertest, ohne Live-Meta und ohne zahlungspflichtige API-Aufrufe.

## Motivation

Die Startoberfläche hatte bisher neun gleichrangige Seiten in der Sidebar, zwei zusätzliche globale Tabs „Dashboard / Testchat“ und eine dominante Einrichtungssektion über den Kontakten. Das verlangt für Alltagsarbeit unnötige Entscheidungen. Die frühere Darstellung hatte außerdem fiktive Sarah/Bianca/Timo/Dummy-Leads als Fallback bei Backend-Ausfall, was wie reale Pipeline-Daten aussehen konnte.

## Neue tägliche Bedienung

- **Fünf Arbeitsbereiche sofort sichtbar:** Übersicht, Inbox, Leads, Termine, Nachfassaktionen. Zusätzlich **Pete testen**.
- **Vier Verwaltungsbereiche unter einem aufklappbaren Eintrag:** Kampagnen, Einstellungen, Einrichtung und Buchungsprotokoll. Die alten internen Section-Keys/Backend-Routen wurden nicht umbenannt. Die Einrichtung über den vorhandenen Wizard bleibt möglich.
- **Keine zusätzliche globale Testchat-Tab-Leiste:** Pete testen ist aus Sidebar/Übersicht erreichbar, der Testchat bietet eine „Zurück zum Arbeitsplatz“-Aktion. Ein Testchat ist kein echter Meta-Send.
- **Übersicht statt Einrichtungszentrale:** Drei konkrete Aktionen (Inbox, Leads, Pete testen), echte Lead-Metadaten-Kennzahlen und maximal fünf priorisierte Kontakte mit direktem Chat-Einstieg. Einrichtung/Verbindungen stehen in einem ausklappbaren Bereich.
- **Keine erfundenen Inbox-Prioritäten:** Die Zahlen beruhen auf den gespeicherten Readiness-, Tag- und Booked-Feldern. „Heiß“ und „im Gespräch“ bedeuten weder eine ungelesene Nachricht noch sicher bestätigten Sales-Bedarf. Ausgeschlossene und nur als Entwurf angelegte Kontakte werden nicht gezählt.
- **Lead-Suche nur dort sichtbar, wo sie wirkt:** Übersicht, Leads und Inbox. Die vorhandene gemeinsame Kontaktfilterung verarbeitet den Suchtext.
- **Offline-Status korrekt:** Kein Rückfall mehr auf erfundene Demo-Kontakte. Bei fehlgeschlagenem Backend-Ladevorgang weist die Oberfläche auf den Ladefehler hin.
- **Responsive Darstellung:** Auf schmalen Bildschirmen wandert die Navigation nach oben. Die Inbox ordnet Leadliste, Chat und Kontext untereinander statt in drei festen breiten Spalten an.

## Technischer Nachweis

- Eine einzige Navigationsquelle und reine Zusammenfassungslogik im Modul dashboard/src/navigation/dashboardNavigation.js.
- Vier neue Regressionstests im Modul dashboard/src/navigation/dashboardNavigation.test.js: Alle ursprünglichen Seiten erhalten, Aktionen und Testchat vorhanden, Lead-Zahlen ehrlich, keine Dummy-Leads und mobile CSS-/Inbox-Anbindung.
- Die bestehenden Backend-Dienste, Human-Handover-, Buchungs-, Versand- und Preiswahrheitsregeln wurden in dieser Phase nicht verändert.
- Die Standard-CI baut Backend und Dashboard und führt alle Backend-/Dashboard-/Sicherheitsprüfungen aus.

## Abnahme auf Windows später

1. Sicherheitsstart aus docs/PHASE32_SICHERER_LAPTOP_TEST.md; vorher Branch aktualisieren. Keinen Live-Send freigeben.
2. Übersicht: Drei Aktionen erreichbar. Keine Dummy-Kontakte bei Backend-Ausfall, reale Kontakte bei verbundenem Backend. Suche prüfen.
3. Inbox: Namen/Nummern filtern, Chat öffnen, Human-Übernahme und „An KI zurückgeben“ prüfen. Auf schmaler Breite alle drei Panels erreichen.
4. Pete testen: Chat und „Zurück zum Arbeitsplatz“ öffnen. Keine echten DMs.
5. Verwaltung & Einrichtung: Vier bisherige Seiten aufrufbar, Wizard/Verbindungen bleiben erhalten und werden nicht automatisch zurückgesetzt.
6. Hell-/Dunkel-Ansicht prüfen. Null Kontakte bei Ausfall ist kein Beweis für Null echte Leads; Fehlermeldung beachten.

**Noch nicht geprüft:** tatsächliche Android-/Windows-Browseransicht, Screenreader/Tastatur in einem echten Browser, Produktivbetrieb, ManyChat-/DM-Closer-Koexistenz. Keine echte UI-Nutzerabnahme behaupten.

**Nächste Arbeitspriorität:** 5 – Startdiagnose verständlicher machen. Die native ManyChat-Button-/Link-Ablösung bleibt gesonderter späterer Backlogpunkt M-01 und wurde hier nicht vorgezogen.
