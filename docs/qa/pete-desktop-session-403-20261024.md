# Pete-Desktop-Labor: HTTP 403 bei der Anmeldung

Stand: 24.10.2026, Europe/Berlin. Arbeit ausschließlich auf der bestehenden Branch von PR #191. PR #193 wurde nicht bearbeitet.

## Nachgewiesener Fehler

Die Browser-Header aus Master-State 68 sind korrekt. Der vorhandene Vite-Proxy verwendet für `/test-chat` jedoch eine Zeichenkette als Kurzform. Die installierte Vite-Version wandelt diese in `{ target: ..., changeOrigin: true }` um. Dadurch ersetzt der Proxy den ursprünglichen Browser-Host `127.0.0.1:5173` durch den Ziel-Host `localhost:3001`.

`assertBrowserBoundary()` vergleicht zu Recht den Hostnamen des eingehenden Requests mit dem Hostnamen der erlaubten Browser-Origin. `localhost` und `127.0.0.1` sind verschiedene Hostnamen. Der Backend-Guard meldet daher `desktop_host_denied`, obwohl die Browser-Entwicklertools den ursprünglichen korrekten Host anzeigen.

Mit echtem lokalem Express-Backend, installiertem Vite und Loopback-HTTP reproduziert:

| Verbindung | Host am Backend | Browser-Origin | Session |
| --- | --- | --- | --- |
| Direkt, gleiche sichere Runtime | `127.0.0.1:5173` | `http://127.0.0.1:5173` | HTTP 200 |
| Bisherige Vite-Kurzform | `localhost:<Backend-Port>` | `http://127.0.0.1:5173` | HTTP 403, `desktop_host_denied` |
| Korrigierte bestehende Vite-Regel | `127.0.0.1:5173` | `http://127.0.0.1:5173` | HTTP 200 |

Im Test wird ausschließlich der Backend-Port durch einen freien lokalen Testport ersetzt. Hostname und Host-Umschreibeverhalten der tatsächlichen Vite-Regel bleiben erhalten. Die alte Kurzform wird zusätzlich als negativer Kontrollfall geprüft und muss weiterhin HTTP 403 liefern. Der Diagnoseausdruck vor dem Fix bestätigte `runtimeSafe: true`, `hostMatchesOrigin: false` und `desktop_host_denied`.

Dies ist eine lokale Reproduktion des Repository-Fehlers mit den bestätigten Owner-Headern. Ein Zugriff auf den laufenden Besitzer-Laptop oder dessen Server-Umgebung wird damit nicht behauptet. Zusätzliche abweichende Laptop-Runtime-Flags sind weiterhin nur anhand der dortigen sicheren Diagnose feststellbar.

## Eng begrenzte Änderung

- Nur `/test-chat` erhält in `dashboard/vite.config.js` die explizite Proxy-Option `changeOrigin: false`. Das bestehende Ziel `http://localhost:3001` bleibt erhalten. Weder Origin noch Authentifizierungs- oder Forwarded-Header werden erfunden.
- `pete-desktop-lab.service.ts` protokolliert Ablehnungen im lokalen Entwicklungsmodus nur mit festen, freigegebenen Reason-Codes, zum Beispiel `[pete-desktop] request_denied reason=desktop_host_denied`. Unbekannte Fehler werden zu `desktop_guard_denied`, Budget-/Runtime-Ablehnungen zu `desktop_runtime_unsafe`. Browser-Antworten bleiben generisch HTTP 403.
- Keine Header-, Cookie-, CSRF-, Umgebungs-, Schlüssel- oder Stacktrace-Ausgabe. Der Test prüft mit einem synthetischen Canary-Wert, dass Request-Inhalte nicht ins Diagnoseprotokoll gelangen.
- `pete-api-budget.service.ts` wurde gelesen und geprüft, aber nicht geändert. Seine Runtime-Bedingungen, Reservierungen, historischen Belege und Kostenfreigaben bleiben unverändert. Auch `.env`, Starter, Budgets und Ledger werden nicht verändert.

## Kostenfrei bestandene lokale Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| Neue echte Express-/Vite-Proxy-Regression | 8/8 Testknoten bestanden |
| Bestehendes Desktop-Labor mit gemockten Providern | 17/17 bestanden |
| Backend-Regression | 520/520 bestanden |
| Relay-/Starter-Verträge | 25/25 bestanden |
| Restbudget-Skripte ohne Netz | 10/10 bestanden |
| Bestehende Dashboard-Tests | 102/102 bestanden |
| Backend-, Dashboard- und bestehender Pete-Labor-Build | Bestanden |

Die neue Regression prüft außerdem erlaubtes `localhost`, unveränderte Sperren für fremde oder nicht passende Hosts, fehlendes Desktop-Kennzeichen, Forwarded-Header, Cross-Site-Requests, fehlendes JSON sowie fehlenden CSRF. Aktivierte Mobile-/QA-/GitHub-/globale API-Freigaben sperren weiterhin die Sitzung. Der Status ist nach korrekter Cookie-/CSRF-Anmeldung erreichbar, meldet aber ohne vollständige Kostenbelege weiter `historical_spend_unverified`, `enabled: false`, globale API-Freigabe aus und Sends aus. Ein Statusabruf erzeugt keinen Budget-Ledger.

Ausführen im bestehenden Backend-Verzeichnis, nach Installation der vorhandenen Backend- und Dashboard-Abhängigkeiten:

```sh
node --import tsx --test ../scripts/pete-desktop-session-proxy.test.mjs
npm run check
```

Die vorhandenen kostenlosen Linux- und Windows-CI-Workflows führen die neue Proxy-Regression zusätzlich aus. Es wurden keine kostenpflichtigen Workflow-Freigaben, Abhängigkeiten oder Abos ergänzt. Die tatsächlichen CI-Läufe und Ergebnisse auf dem veröffentlichten Commit stehen in den PR-Checks und im bestätigten Master-State-Eintrag zu diesem Fix.

## Verbleibende Bestätigung

Nach erfolgreicher CI kann der Besitzer den vorhandenen AutoStart für die geprüfte PR-191-Version verwenden und einmal den kostenlosen Pete-Status abrufen. Für die lokale Besitzer-Installation ist noch kein erfolgreicher Gegencheck belegt. Bei weiterem HTTP 403 ist ausschließlich der feste Reason-Code aus dem Backend-Fenster relevant, keine vollständige Header- oder Geheimnisausgabe.

Die funktionierende Anmeldung ist keine kostenpflichtige KI-Freigabe. Der historische Ledger-/Provider-Abgleich bleibt ein eigenständiges, unverändertes Gate. In diesem Entwicklungspaket: 0 kostenpflichtige Modellaufrufe, 0 Live-Sends, kein Merge und kein Deployment.
