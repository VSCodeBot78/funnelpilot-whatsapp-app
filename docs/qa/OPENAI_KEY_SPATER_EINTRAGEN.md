# Pete QA: OpenAI-Key später sicher hinterlegen

**Status 21.10.2026:** Änderungen sind ausschließlich im Draft-PR #188 vorbereitet. Kein Live-Versand, kein A−-Nachweis und kein weiterer bezahlter Test durch das Speichern des Keys.

## Am Handy (GitHub im Browser)

1. Im Browser anmelden: https://github.com/VSCodeBot78/funnelpilot-whatsapp-app/settings/secrets/actions
2. Unter **Repository secrets** das bestehende **OPENAI_API_KEY** suchen und über **Update** ersetzen. Falls es nicht existiert, **New repository secret** verwenden und **OPENAI_API_KEY** exakt als Namen eintragen. Auf dem Handy kann die Desktopansicht hilfreich sein.
3. Den frischen OpenAI-API-Schlüssel **nur** in das **Secret value**-Feld von GitHub eintragen und mit **Update secret** bzw. **Add secret** speichern.
4. **Niemals** in ChatGPT, eine GitHub-Issue, einen Commit, einen Screenshot oder eine Nachricht einfügen.
5. Dann in ChatGPT nur schreiben: **„GitHub-Key aktualisiert.“**

Der Schlüssel kann über das OpenAI API-Dashboard erstellt werden. ChatGPT Plus und ein OpenAI-API-Guthaben sind getrennte Abrechnungsprodukte. Ein 401 weist auf eine ungültige oder für das Modell nicht berechtigte API-Anmeldung hin; ein frischer Schlüssel muss zum richtigen API-Projekt gehören.

## Was nach deiner Nachricht geschieht

- Ich kontrolliere zuerst den GitHub-Draft-PR und den grünen Offline-CI-Lauf.
- **Erst dann**, und nur nach der angekündigten Fertigmeldung, aktiviere ich den vorbereiteten *einmaligen* Zweig `pete-quality-real-resume-20261021` mit dem vorgesehenen Commitmarker. Das reine Speichern des Secrets startet nichts.
- Das Workflow-Skript prüft **kostenlos** über `GET /v1/models/gpt-4.1-mini`, ob der Schlüssel funktioniert. Bei HTTP 401/403 kein bezahlter Modellaufruf und keine neue Reservierung.
- Der GitHub-Ledger bestätigt eine persistente Reservierung, bevor fiktive Modellgespräche ausgeführt werden. Frühere vorsorgliche 0,245788 USD werden angerechnet. Verfügbarer Deckel für den Folgelauf: **maximal 1,754212 USD**.
- Neustart, erneuter Commit, wiederholter Workflow-Lauf oder fehlende Ausgabenachweise können dieses Budget **nicht** erneut freigeben.
- 20 synthetische Gesprächsfälle mit echten `replySource=llm`-Nachweisen, separatem Sicherheits- und Regelweg, nachvollziehbarem Token- und Kostenstand. Kein Dashboard-/Handy-Test von Jochen, bevor die interne Qualitätsabnahme besteht.

## Wichtig

- **Keine** Freigabe für Meta-Sends, WhatsApp-Sends, Live-Kontakte, Terminbuchungen oder Deployments.
- **Kein** eigenständiger neuer 2-Dollar-Betrag, keine Abos.
- Der noch **nicht** auf dem Laptop eingespielte Code ist nicht automatisch testbereit. Bei echter Modellqualität unter A− bleibt der Darth-Vader-Endtest blockiert.
- Die QA-Aufrufe benutzen nur fiktive Eltern-DMs und **gpt-4.1-mini** über die OpenAI Responses API.
