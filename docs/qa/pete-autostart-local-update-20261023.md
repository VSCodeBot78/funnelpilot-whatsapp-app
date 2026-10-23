# Funnel Pilot AutoStart: dauerhaftes Ein-Klick-Update (23.10.2026)

**Ziel:** Der Owner startet immer dasselbe Dashboard. Neue *lokale Testversionen* werden beim Doppelklick automatisch nur nach erfolgreichem kostenlosem GitHub QA übernommen. Kein Merge/Deploy, keine realen IG/WhatsApp-Sends oder kostenpflichtigen KI-Aufrufe.

## Warum die alte Aktualisierung gestoppt hat
In `FunnelPilot-Desktop-Test` liegen nachweislich uncommittete Änderungen. Das alte V2-Skript nutzte `git diff --quiet` und verweigerte zu Recht das Überschreiben. Diese Dateien dürfen unangetastet bleiben. Deswegen arbeitet AutoStart **nicht mehr mit `git pull`, `git reset` oder `git switch` im vorhandenen Testordner**.

## Bedienung, einmalig
Ein fester Zweiteiler wird **einmal** im bestehenden Ordner `FunnelPilot-Desktop-Test` abgelegt:
- `FunnelPilot-AutoStart.cmd` als Windows-Doppelklick-Start
- `FunnelPilot-AutoStart.bootstrap.ps1` als unveränderlicher Lader des auf GitHub-Commit `faf743a79924c7fcfc0223f07f4715c35928bdf9` festgelegten Steuerprogramms

Die Bootstrap-Datei prüft den Git-Blob `416181aac1fb3ee4e5c762d619873e0cc07586e4`, bevor der Starthelfer ausgeführt wird. Der geprüfte Helfer bleibt lokal unter `%LOCALAPPDATA%\FunnelPilot\Launcher` zwischengespeichert.

Danach ist **immer dieselbe CMD** der Startknopf. Keine weiteren ZIP-Updates, kein VS Code, keine manuellen Git- oder PowerShell-Befehle.

## Was der Starter tut
1. Er prüft Repository-Herkunft, Node und freie lokale Ports. Änderungen im bestehenden Testordner sind erlaubt.
2. Er liest die aktuelle SHA des Draft-Zweigs `feat/pete-policy-v4-20261022`. Erst wenn für exakt diese SHA `Pete desktop QA - offline only` erfolgreich beendet ist, akzeptiert er sie als Kandidat.
3. Er holt diese Version in einen **neuen** detached Git-Worktree unter `%LOCALAPPDATA%\FunnelPilot\Releases\<SHA>`. Kein Verschieben oder Überschreiben der lokalen Originaldateien.
4. Backend/Dashboard-Abhängigkeiten und Builds werden **nur beim ersten Mal je Commit** eingerichtet. Bei gleichem Commit geht es direkt zum Start.
5. Eine vorhandene `backend/.env` aus dem alten Testordner wird lokal in die neue Version kopiert, nicht in Chat/GitHub hochgeladen und nicht verändert. Ohne passende Calendly-PAT/Modellberechtigung wird keine Verbindung behauptet. Persistente, separate Testdaten unter `%LOCALAPPDATA%\FunnelPilot\PeteLab\Data`; bestehende Daten und Budgetdateien des alten Laborordners bleiben unangetastet.
6. Windows öffnet Backend/Dashboard ausschließlich lokal auf `127.0.0.1:3001/5173`. Er kontrolliert Readiness-/Safety-Flags **vor** dem Browserstart. Erfolgreicher Start sichert die zuletzt startfähige SHA. Fällt später ein GitHub-Update aus, verwendet er diese Version erneut. Bei belegten Ports oder roter Safety-Prüfung stoppt er.
7. Keine Verbindungsschalter in der vorhandenen `.env` werden dauerhaft geändert. Die lokalen Laufzeitprozesse erzwingen Meta-Sends AUS, kein öffentlicher Tunnel, keine destruktiven Routen, und **`PETE_LLM_API_CALLS_APPROVED=false`**. Damit kann diese Startvariante noch nicht den echten kostenpflichtigen Sol-Darth-Vader-Test ersetzen.

## Nachweis und Grenzen
- `Pete desktop QA - offline only` prüft Backend/Dashboard, keine echten Provider.
- `Pete AutoStart Windows safety` prüft die Windows-PowerShell-5.1-Syntax, fest gesetzte Kosten-/Sendeschutzflags und das nichtdestruktive Erstellen eines sauberen Windows-Git-Worktrees bei *modifiziertem Ausgangsordner*.
- Ein bestandener Cloud-Windows-Test ist **noch keine tatsächliche Ausführung auf dem Owner-Laptop**. Die erste Inbetriebnahme benötigt einen sichtbaren, erfolgreich abgeschlossenen Start. Netzwerk, npm-Abhängigkeiten und die alte `.env` können lokal abweichen.
- Das automatische Update greift **beim nächsten Start**. Es startet keine unbemerkten Hintergrund-Updates mitten im Gespräch. Es verändert auch keine Live-Installation.
- Die neue Calendly-Lese-Diagnose wird im neuen Desktop-Pete-Labor sichtbar. Das beweist noch nicht die direkte Terminabfrage im natürlichen KI-Gespräch. Signierter Buchungswebhook / Google-Kalenderlink bleiben separate Testgrenzen.
- Keine zusätzlichen API-Kosten ohne neue ausdrückliche Freigabe. Für den echten Sol-Test brauchen wir ein separat bestätigtes Budget-/Provider-Ready-Gate, nicht nur ein grünes Dashboard.

**Wartungsprinzip:** Codeänderungen -> GitHub CI -> beim nächsten Doppelklick übernimmt AutoStart nur erfolgreich geprüfte Draft-Testversionen. Bei Live-Releases ist eine gesonderte Freigabe erforderlich.
