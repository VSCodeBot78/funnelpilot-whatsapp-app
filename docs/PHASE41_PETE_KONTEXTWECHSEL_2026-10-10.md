# Funnel Pilot – Phase 41: Pete respektiert echte Themenwechsel

Stand: 10.10.2026. Umfang: gezielte Nachbesserung im bereits vorhandenen
natürlichen Gesprächsmodus (`natural-conversation.ts`). Kein neues
Funnel-Konzept, kein Preis-/Produkt-/Meta-Umbau.

## Beobachteter Codefehler vor Änderung
Ein Lead, der nach der Frage „Jochen im Chat oder Strategiegespräch?“
mit „Kein Termin, schick mir den Keto Guide“ antwortete, landete im
`human_choice`-Block wegen des Wortes „Termin“ bei der Terminbuchung.
Ein Lead, der nach `coaching_close` „nicht direkt kaufen“ schrieb,
traf die positive Checkout-Abzweigung wegen `direkt`/`kaufen`.

## Lösung
- Explizite Folgefrage nach **Keto Guide, Elterncheck, Selbststarter oder
  Preis** darf die bestehende Chat-/Termin-Auswahl verlassen.
- Nur **bejahte** Terminwünsche werden im `human_choice` mit dem
  Kalender beantwortet. „Kein Termin“, „Nein danke“ und „nur Infos“
  landen beim unverbindlichen Infoweg.
- Vor einem direkten Checkout werden eindeutige Negationen eines
  sofortigen Kaufs erkannt. Ist stattdessen ausdrücklich ein
  Strategiegespräch gewünscht, wird nur der Buchungslink angeboten.
- Die bestehenden unveränderbaren Angebote/Preiswahrheit,
  STOP-Regeln, Human-Takeover und Provider-Buchungsbestätigung
  bleiben erhalten.

## Neue Persona-Regression
`backend/src/config/pete-context-switch-phase41.test.ts`:
- Mama: kein Termin, kostenloser Keto Guide
- Papa: konkreter Preis der 5-Wochen-Begleitung
- Mama: Elterncheck statt Call
- Papa: Selbststarter statt Call
- Mama: Nein zu Termin, nur Infos
- Papa: persönliche Chatübernahme
- Mama: echtes Strategiegespräch
- Mama: nicht direkt kaufen
- Papa: ausdrücklich direkt kaufen
- Mama: erst Strategiegespräch, kein Checkout

Die Tests verwenden echte lokale Conversation Engine mit synthetischen
Lead-IDs; der Modell-API-Schlüssel ist entfernt. Keine externe Nachricht,
kein Meta-/Calendly-/OpenAI-Aufruf.

## Offene Qualitätsgrenzen
Deterministische Antworten sind nicht gleich lebendige echte
LLM-Gesprächsqualität. Weitere Selbsttests mit natürlicher Ausdrucksweise,
Mehrdeutigkeiten, Kontext- und 4-Farben-Erkennung sind sinnvoll.
Echte Kunden-/Gerätetests benötigen eine eigene Freigabe.
