# Open-Source-Bausteine: Evaluationsprotokoll (20.10.2026)

Status: vorgemerkt, nicht implementiert. Keine Installation, keine neuen Laufzeitabhaengigkeiten, kein Merge oder Deployment.

## Ziel
Bewaehrte Open-Source-Bausteine gezielt einsetzen, um Testqualitaet, Entwicklungszeit und Zuverlaessigkeit von Funnel Pilot / Pete zu verbessern, ohne die eigene Conversation Engine, Sales-Regeln, Human Takeover oder Sicherheitsgates zu ersetzen.

## Reihenfolge
1. Zuerst den bestehenden isolierten Desktop-Dashboard- und Pete-Test durchfuehren. Kritisches Sales-Opt-out-Gate #168 bleibt separat BLOCKED, bis regulaer nachgewiesen.
2. Danach **Playwright** (https://github.com/microsoft/playwright) als kleinen, isolierten UI-Regressionstest-Pilot bewerten: Kampagnen anlegen/speichern/neu laden, Antwortvarianten ohne Dollarzeichen, Leerzeichen in Buttonbeschriftungen, Ghosting 1-3 Zyklen, Pete-Testchat-Navigation. Kein echter Provider-Send.
3. **Zod** (https://github.com/colinhacks/zod) nur bei konkretem Bedarf fuer gemeinsam validierte Kampagnen-/Einstellungsdaten zwischen Dashboard und Backend pruefen.
4. **Mock Service Worker** (https://github.com/mswjs/msw) bei Bedarf fuer API-Fehler-, Timeout- und Offline-Simulation ohne echte OpenAI-/Meta-Sends pruefen.
5. **BullMQ** (https://github.com/taskforcesh/bullmq) erst bei spaeterem Bedarf an einer robusten, dauerhaften Job-Queue und nach Infrastruktur-/Betriebskostenpruefung betrachten.
6. **Vitest** (https://github.com/vitest-dev/vitest) derzeit zurueckstellen: Node-Testsystem ist bereits vorhanden.

## Bewertungsregeln vor Integration
- Bestehende Loesung und konkreten Fehler-/Zeitgewinn dokumentieren.
- Lizenz, Wartungsstatus, transitive Abhaengigkeiten, Sicherheits- und Betriebsrisiken vor Installation pruefen.
- Kleine isolierte Pilot-Aenderung mit Rueckfallmoeglichkeit, keine neue KI-Engine oder doppelte Architektur.
- Kein Ersatz fuer die bestehende Sales-Opt-out-Regression oder deren blockierten Schreib-/Deploy-Freigabeprozess.
- Keine Live-IG-/WA-Nachrichten, keine kostenpflichtigen Provideraufrufe ohne separate Freigabe.

## Entscheidung
Prioritaet 1: Playwright nach erstem Desktop-Test. Zod/MSW optional nach Befund. BullMQ/Vitest derzeit nicht einbauen.
