# WORK-DB001: Backend-Sicherheitsbefunde behoben

26.10.2026. Bestehender Draft-PR #193, Branch `feat/dashboard-v2-preview-20261023`, Ausgangs-HEAD `41790b0efc6ad79f9a1758c5b74be61732ae7d7e`.

## Ergebnis und Freigabeumfang

Nach der Klarstellung, dass bekannte kritische Backend-Befunde eine Gesamtabnahme verhindern, gab der Owner mit „Go“ die eng begrenzte Backend-Dependency-Reparatur frei. Alle fünf zuvor gemeldeten Backend-Befunde sind durch regulär aufgelöste Paketupdates beseitigt: **Backend-Audit 5 → 0, Frontend-Audit weiterhin 0**, beide finalen Audit-Exits 0.

Nur Backend-Abhängigkeiten, eine zusätzliche lokale Sicherheits-Regression samt Einbindung in `npm run check` und diese Belege ändern sich. Pete-Gesprächslogik, HTTP-Anwendung/Router, Datenhaltung, Dashboard-Code, bestehende Tests, Workflows, Starter und PR #191 bleiben unverändert. Keine mobile Entwicklung, kein Merge oder Rebase, Deployment, Live-Send, echter Provider-/Modellaufruf oder neue Kosten.

## Reguläre Abhängigkeitsauflösung

```sh
npm audit fix --package-lock-only --ignore-scripts
npm update express tsx --package-lock-only --ignore-scripts
npm ci
npm audit --json
npm ls --all --json
```

Die erste Audit-Korrektur behob den kritischen und die beiden hohen Befunde; `qs` und `esbuild` blieben zunächst offen (Audit-Exit 1). Danach wurden die bestehenden Elternpakete Express und tsx gezielt innerhalb der unveränderten Manifest-Versionsbereiche aktualisiert. Dadurch ließen sich auch die beiden verbleibenden Befunde regulär auflösen. Keine manuell gemischte Lockdatei, Overrides, `--force`, Major-Umstellung auf Express 5 oder Lockerung von Sicherheitsregeln.

| Paket | Vorher | Nachher |
| --- | --- | --- |
| `express` | 4.22.1 | 4.22.3 |
| `body-parser` | 1.20.4 | 1.20.9 |
| `proxy-addr` | 2.0.7 | 2.0.8 |
| `path-to-regexp` | 0.1.12 | 0.1.13 |
| `qs` | 6.14.2 | 6.16.1 |
| `esbuild` | 0.27.4 | 0.28.2 |
| `tsx` | 4.21.0 | 4.23.15 |

## Gezielte Sicherheitsregression

Neue Datei `backend/qa/dependency-security.test.mjs`, ausgeführt durch `npm run test:dependency-security` am Ende des vorhandenen `npm run check`. Sie lädt ausschließlich die Bibliotheken in isolierten Fixtures, keine Produkt-App, Stores, realen Leads, Credentials oder Pete-Engine. Die HTTP-Fixtures binden nur an `127.0.0.1` mit zufälligem Port; Regex-Prüfung in einem zeitlich begrenzten Kindprozess.

Sieben tatsächliche Tests bestanden:

1. Ein zu kurzer IPv4-mapped-IPv6-Trust-Prefix akzeptiert keine beliebigen IPv4-Adressen.
2. Ein nicht vertrauenswürdiger Peer kann seine Client-IP nicht über `X-Forwarded-For` vortäuschen.
3. Ein korrekt geschriebener gemappter IPv4-Trust-Bereich akzeptiert weiterhin genau seinen Block.
4. Ein reines IPv6-Trust-Subnetz vertraut nicht automatisch IPv4-Peers.
5. Mehrdeutige Drei-Parameter-Routen verwerfen einen begrenzten langen Nichttreffer im Kindprozess; normale Routen bleiben gültig.
6. Normales gzip-komprimiertes JSON wird weiterhin korrekt geparst.
7. gzip mit nachgestellten ungültigen Bytes wird mit HTTP 400 behandelt; ein anschließender Health-Request bleibt mit HTTP 200 erfolgreich, kein Prozessabsturz.

Die Fixtures prüfen konkrete Bibliotheksgrenzen und keinen nachgewiesenen externen Angriff auf die reale Installation. Quellen/Patchgrenzen: [proxy-addr-Advisory](https://github.com/advisories/GHSA-jqcg-44mw-7w3h), [body-parser-Advisory](https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828), [path-to-regexp-Advisory](https://github.com/advisories/GHSA-37ch-88jc-xwx2).

## Vollständige lokale Validierung

Node 24.22.1 / npm 11.9.0. Backend-IG/WA-/LLM-Freigaben für die Gesamtsuite ausgeschaltet. Beide Paketbäume wurden frisch mit `npm ci` installiert.

| Prüfung | Ergebnis |
| --- | --- |
| Backend `npm audit --json` | Exit 0, 0 Befunde (vorher 1 kritisch, 2 hoch, 1 mittel, 1 niedrig) |
| Frontend `npm audit --json` | Exit 0, weiterhin 0 Befunde |
| Backend `npm ls --all` | Exit 0, keine gemeldeten Peer-Probleme |
| Backend `npm run check` | TypeScript-Build + 17 Desktop + 520 Backend + 25 Relay/Starter/Safety + 7 neue Sicherheitsfälle bestanden |
| Frontend Standard-/Labor-Build | 102/102 Unit-Tests, beide Builds erfolgreich |
| Vorschau-Units und Vorschau-Build | 18/18, erfolgreich |
| Default-off-Bundleprüfung | erfolgreich, kein Datenclient im gesperrten Bundle |
| Vollständige Playwright-Suite | 24/24, 0 Fehler, 0 übersprungen, 0 flaky |
| axe WCAG A/AA in unveränderter Browser-Suite | 64 Scans ohne gemeldete Verstöße |
| Diff-/Bereichsprüfung | `git diff --check` erfolgreich; Geschäftslogik und bestehende Tests unverändert |

Der erste lokale Browserstart konnte mangels installiertem Chromium 23 Browserfälle nicht starten. Nach normaler Browserinstallation bestand die vollständige Wiederholung; keine Test-Erwartung oder Produktsperre wurde dafür verändert. Responsive Bestandstests sind ausschließlich Kompatibilitätsregression, keine mobile Entwicklung.

Die neue GitHub-CI wird auf dem tatsächlich geschriebenen Commit separat bestätigt. Konkrete SHA-/Run-/Job-Zuordnung und das neue Screenshot-/Playwright-Artefakt werden anschließend im bestehenden PR dokumentiert. Alte CI-Nachweise oder isolierte Tests werden nicht als neue CI oder echte Sol-Gesprächsqualität ausgegeben. [Audit-, Versions- und Testnachweis als JSON](DB001-backend-security-20261026.json).

## No-Deploy und verbleibende Systemgrenzen

Vor Codeänderungen tatsächlichen Branch und Workflow-/Auto-Deploy-Auslöser geprüft. Die vorhandene branchbezogene GitHub-CI führt nur kostenlose Tests aus; Workflows und No-Send-/LLM-Gates bleiben unverändert. Commit mit offiziell dokumentiertem `[CF-Pages-Skip]`; auf dem neuen SHA wird die Checkliste erneut kontrolliert. Keine Cloudflare-/Railway-/Hetzner-Einrichtung.

Das bekannte Dependency-Sicherheitsgate ist bei Frontend und Backend mit jeweils null gemeldeten npm-Audit-Befunden belegt. Das ist kein Beweis vollständiger Fehlerfreiheit des gesamten Produkts. Die bestehende PR-Basisdivergenz, kontrollierte V2-Einbindung in die reguläre lokale Desktop-Anwendung, reale Besitzer-Laptop-Prüfung und zentrale Qualitäts-/Produktionsfreigabe bleiben gesonderte offene Schritte. Keine pauschale Gesamtabnahme durch diese Reparatur.
