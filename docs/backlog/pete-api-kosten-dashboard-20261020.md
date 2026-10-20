# Backlog: API-Kosten im Pete-Dashboard

Datum: 20.10.2026
Status: aufgenommen, zurückgestellt bis nach Pete-/Darth-Vader-Abnahme. Keine Implementierungsfreigabe, keine Live-Änderung.

## Ziel
Kleine, übersichtliche, zunächst schreibgeschützte Anzeige unter **Einstellungen → KI & Budget**:
- API-Verbrauch heute und im aktuellen Monat
- Durchschnittliche Kosten pro Gespräch (mit klarer Definition des Gesprächs)
- bestehendes Budgetlimit und Auslastung
- Warnhinweis bei knapper Budgetreserve

## Technische Anforderungen
- Vorhandenes Backend-Budget-Ledger wiederverwenden und dessen Aussagekraft prüfen; keine erfundenen Werte.
- Schätzwerte und endgültige OpenAI-Abrechnung ausdrücklich unterscheiden; Währung und Umrechnung transparent kennzeichnen.
- Keine zusätzlichen kostenpflichtigen API-Aufrufe nur für die Anzeige.
- Kein automatisches Aufladen, keine eigenständige Budgeterhöhung, keine Schlüssel im Frontend.
- Für spätere SaaS-Ausbaustufe: getrennte Verbrauchszuordnung je Coach/Mandant, keine Vermischung von Kundendaten.

## Priorität / Aufwand
Nach Dashboard-Abnahme, echter Pete-KI-Prüfung und kritischem Sales-Opt-out-Gate (#168). Vorläufige Aufwandsschätzung 2-4 Entwicklungsstunden, abhängig von Datenqualität des bestehenden Ledgers. Keine Verschiebung der Live-Freigabekriterien.
