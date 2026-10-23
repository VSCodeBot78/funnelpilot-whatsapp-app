# Desktop-Status: Browser-Origin-Regression

Fortsetzung in PR #191, Ausgangs-HEAD `a59f75c2e4481168ede2d86ed5d9d13967cae4a2`.
Die neue Owner-Meldung nennt einen nicht erreichbaren Status und ausschließlich
„Nicht belegt“. Dieser allgemeine Frontend-Catch beweist allein weder einen
gestoppten Backenddienst noch eine Ablehnung wegen fehlender Kostenbelege.

## Nachgewiesener weiterer Fehler

Echter Chromium, unveränderter Produktionsclient, echter Vite-Proxy und Express:

| Browser-Anfrage | Origin vorhanden | Vorher | Nachher |
| --- | --- | --- | --- |
| Session-POST | ja | 200 | 200 |
| Bisheriger Status-GET | nein | 403 `desktop_origin_denied` | weiterhin 403 als negative Kontrolle |
| Status über korrigierten Client | ja, POST | kein POST-Handler | 200 |
| Verlauf über korrigierten Client | ja, POST | GET mit 403 | 200 |

Browser hängen bei Same-Origin-GET keinen Origin-Header an. Der bestehende
Backend-Guard verlangt ihn für jede Desktop-Anfrage. Die früheren Node-HTTP-
Tests setzten Origin selbst, auch bei GET. Sie belegten den Proxy-Host-Fix,
konnten diesen zusätzlichen Browserfehler jedoch nicht erkennen. Primärquelle:
https://fetch.spec.whatwg.org/#origin-header . Der neue Test prüft den echten
Browser, ohne Origin manuell zu setzen oder durch den Proxy zu ergänzen.

## Gezielte Änderung und Schutzgrenzen

`dashboard/src/services/peteDesktopLab.js` fordert Status und Verlauf als
schreibfreie POSTs mit leerem JSON-Objekt an. Der Browser erzeugt Origin selbst.
Genau zwei POST-Aliase in `backend/src/routes/test-chat.ts` verwenden dieselben
bisherigen Status-/Verlaufsfunktionen hinter `guardDesktopBrowser`. Die alten
GET-Routen bleiben mit unveränderten Prüfungen erhalten. Kein fehlender Origin
wird akzeptiert oder durch Referer/Host ersetzt. Keine Authentifizierung wird
vom Proxy ergänzt. Sämtliche Runtime-, Loopback-, Origin-/Host-, Sitzungs-,
CSRF-, JSON- und Budgetprüfungen bleiben erhalten.

Playwright 1.56.1 ist eine fest gepinnte Testabhängigkeit. Nur die bestehenden
Linux-/Windows-CI-Jobs installieren Chromium und führen die Regression aus.
Der Besitzer-AutoStart installiert dadurch keinen Browser. PR #193 bleibt
unbearbeitet. Keine Änderungen an Budgetservice, Sicherheitsvalidator, .env,
Kostenbelegen, Ledgern oder Startskripten.

## Kostenlose lokale Nachweise

| Prüfung | Ergebnis |
| --- | --- |
| Neuer echter Chromium-/React-/Vite-/Express-Test | 7/7 Testknoten bestanden |
| Erweiterter echter Vite-Proxy-Test | 9/9 bestanden |
| Bisherige Desktop-Sicherheits-/Budgettests | 17/17 bestanden |
| Backend-Regression | 520/520 bestanden |
| Starter-/Relay-Verträge | 25/25 bestanden |
| Restbudget-Skripttests | 10/10 bestanden |
| Dashboard-Tests | 102/102 bestanden |
| Backend-, Dashboard- und Pete-Labor-Build | bestanden |
| Dashboard-Dependency-Audit | bestehende 8 Befunde, keiner für Playwright |

Die echte React-Testchat-Komponente einschließlich StrictMode lädt den Status
automatisch und zeigt den belegten historischen Mindestbetrag 11,158772 USD.
Fehlende historische Abstimmung bleibt sichtbar, KI AN ist deaktiviert. Der
Browser ruft keinen Budget- oder Nachrichten-Endpunkt auf; keine Budgetdatei
wird erzeugt. Temporäre synthetische Daten, kein API-Schlüssel. Externe
Backend-Fetches sind gesperrt, andere Browser-Origins ebenfalls; externe
Aufrufe 0. Keine Token, Cookies oder Request-Werte in der Diagnose.

Beide POST-Aliase weisen falsche oder fehlende Origin/Host, Sitzung, CSRF,
Desktop-Header, JSON, Forwarded und Cross-Site weiter mit 403 ab. Same-Origin-GET
bleibt trotz gültiger Sitzung/CSRF mit `desktop_origin_denied` gesperrt.

Reproduzieren aus `backend/`, nach Installation der vorhandenen Abhängigkeiten:

```sh
node ../dashboard/node_modules/playwright/cli.js install chromium
node --import tsx --test ../scripts/pete-desktop-browser.test.mjs
node --import tsx --test ../scripts/pete-desktop-session-proxy.test.mjs
```

## Grenzen und Besitzer-Gegencheck

Reproduziert ist der Fehler im vorhandenen PR-Code. Keine erfolgreiche
Installation auf dem Besitzer-Laptop wird behauptet. Der vorhandene AutoStart
muss nach erfolgreicher CI den neuen Stand übernehmen; alte Serverprozesse
dürfen die Ports nicht weiter belegen. CI-Runs auf dem neuen HEAD werden nach
Abschluss in PR #191 und PETE_MASTER_STATE dokumentiert.

Status ist kein KI-Dialog. Historischer Kostenabgleich und Budgetfreigabe
bleiben erforderlich. Kein gültiger Review wird erfunden, keine Sicherheits-
oder Kostensperre gelockert. Keine API-Kosten, Live-Sends, Merges oder Deployments.
