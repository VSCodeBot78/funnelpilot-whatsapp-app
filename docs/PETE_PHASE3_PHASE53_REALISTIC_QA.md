# Phase 53: Pete zeigt Gesprächsverständnis statt voreiliger Übergabe

## Ursache aus Phase 3
Der GPT-5.4-Flagship-Test zeigte bei allgemeinen Fragen deutlich bessere Antworten, aber gelegentliches `needsHuman=true` nach rein finanziellen Bedenken. Bisher schaltete das den Chat sofort vollständig und dauerhaft auf Mensch, auch wenn keine Rechnung, Bestellung, akute Gefahr oder ausdrücklicher Übergabewunsch vorlag.

## Begrenzter Fix
Nur bei eindeutig harmloser Budgetgrenze oder Ablehnung von Verkaufspressure erfolgt eine kurze, sachliche, bewusst **nicht vom Modell verfasste** neutrale Antwort (`safe_noncritical`) ohne menschliche Sperre. Fachliche Ungewissheit, jede echte Transaktionsprüfung, expliziter Wunsch nach Mensch, medizinische Risiken, STOP und Datenschutz bleiben weiterhin hart gesperrt.

## Aussagekräftigere Qualitätstests
Die zehn Szenarien bestehen nun aus glaubwürdigen, unterschiedlichen Nachrichtentexten fiktiver Mütter und Väter. Nach STOP oder echter Human-Ownership werden keine zusätzlichen Testnachrichten mehr künstlich abgesendet. Pro Testfall wird `endedBy` erfasst; das Protokoll unterscheidet geplante und tatsächlich gesendete Nachrichten sowie `avoidedAfterTakeover`, statt das Schweigen als zehn Dialogrunden darzustellen. Neben Modellantworten werden verifizierte Antworten und abgesicherte Budget-Nicht-Handover separat erfasst.

## Qualitätsstatus
Lokale CI nutzt ausschließlich API-Mocks. Ein GitHub-Job mit echten OpenAI-Requests ist davon getrennt und wird nur durch den freigegebenen Branch-Commit ausgelöst. Die bisherige dauerhafte 8-USD-Grenze über alle Phase-3-Testläufe gilt. Kein öffentlicher Produktivbetrieb und keine Meta-Sends. Qualität ist bis zur unabhängigen Sichtung der echten Antworten **nicht freigegeben**.
