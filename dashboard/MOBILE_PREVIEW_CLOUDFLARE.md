# 0 € Mobilvorschau: Cloudflare Pages + Access (nicht Pete-Live)

Status: vorbereitet, **nicht veröffentlicht**. Kein Deploy ohne Prüfung des kostenlosen Kontotarifs und ohne aktive Cloudflare-Access-Regel für die Hauptadresse.

## Getesteter Quellstand

GitHub PR #183, Branch `feat/dashboard-mobile-preview-isolated-20261017`.
Ein isolierter React-Build mit dem echten Kampagneneditor, aber künstlichen Daten, clientseitiger Simulation und Offline-API-Stub. Weder `App.jsx` noch `/pete-test` sind im Pages-Bundle. Die Tests laufen über GitHub Actions.

**Kein** Instagram-/WhatsApp-/Pete-Versand, keine OpenAI-API, keine echten Leads, keine echten Kampagnenänderungen. Ein frischer Seitenaufruf setzt Demo-Daten zurück.

## Bevor der erste Deploy ausgelöst wird

1. Im Cloudflare-Konto den **Cloudflare Pages Free Plan** und **Cloudflare Zero Trust/Access Free** wählen/prüfen. Nur weitermachen, wenn **0 $ und keine kostenpflichtige Umstellung** angezeigt werden. Ein eventuell verlangtes Zahlungsmittel nicht hier im Chat teilen. Cloudflare Zero Trust Free kann bei der Einrichtung ein Zahlungsmittel verlangen, obwohl der Free-Tarif selbst kostenlos ist.
2. Freien, unverwechselbaren Pages-Projektnamen auswählen, z. B. `fp-mobiltest-jochen-2026`, wenn verfügbar. Der tatsächliche Domainname muss im Dashboard bestätigt werden.
3. In **Zero Trust > Access controls > Applications** eine App vom Typ **Self-hosted** für die geplante Hauptadresse `<projekt>.pages.dev` anlegen. **Allow** nur für die E-Mail des Owners bzw. die Mitgliedschaft des eigenen Cloudflare-Accounts setzen. Den kostenlosen Login über Cloudflare-Konto oder ausdrücklich freigegebene Einmal-PIN aktivieren. Niemals mit einer unbeschränkten Allow-Everyone-Policy schützen.
4. Auch `*.<projekt>.pages.dev` (Branch- und Commit-Preview-URLs) mit separater Access-App absichern. Dafür kann nach dem Pages-Anlegen unter **Settings > General > Enable access policy** die Cloudflare Access-Policy für Preview-Deployments konfiguriert werden. **Achtung:** Diese Preview-Option alleine schützt die Hauptadresse `<projekt>.pages.dev` ausdrücklich nicht.
5. Prüfen, dass alle geplanten Hostnames eingeschlossen sind. Niemals `check.jochen-kammerer.de` oder die bestehenden Live-Routen ändern.

## Cloudflare Pages Git-Einrichtung

Cloudflare Dashboard > Workers & Pages > Create application > Pages > Connect to Git.

- GitHub Repository: `VSCodeBot78/funnelpilot-whatsapp-app`
- **Production branch:** `feat/dashboard-mobile-preview-isolated-20261017` (nicht `main`)
- Framework preset: `None` / Custom
- **Root directory:** `dashboard`
- **Build command:** `npm run build:cloudflare-preview`
- **Build output directory:** `preview-dist`
- Umgebungsvariable (falls benötigt): `NODE_VERSION=22`
- Keine Schlüssel, keine Meta Tokens, keine OpenAI-Schlüssel, keine echten API-URLs eintragen.
- **Save and Deploy** erst nach Bestätigung, dass die Hauptadresse durch Cloudflare Access geschützt ist, und der Tarif kostenlos bleibt.

Der Build erzeugt `preview-dist/index.html`, statische Assets und `_headers` mit **`connect-src 'none'`**, `no-store` und `noindex`. Er verweigert den Build, wenn eine echte Kampagnen-API-Route im JavaScript-Bundle gefunden wird.

Der bisherige Node-Basic-Auth-Server `preview-server.mjs` ist für einen lokalen/anderen Host und wird auf Cloudflare Pages **nicht** eingesetzt. Bei Cloudflare übernimmt **Cloudflare Access** die Anmeldung. Nie einen Client-JavaScript-"Passwortschutz" statt Access einsetzen.

## Pflichtprüfung vor Weitergabe des Links

1. Die vom Cloudflare-Dashboard tatsächlich angezeigte URL notieren, **nicht erraten**.
2. In einem privaten Chrome-Tab ohne Login öffnen. Erwartet: Cloudflare-Access-Anmeldung, **nicht** das Dashboard.
3. Ebenso eine `/assets/<datei>.js`-URL ungeauthentifiziert prüfen. Erwartet: Access-Anmeldung/Blockade.
4. Als freigegebener Nutzer anmelden. Im Dashboard `Kampagnen & Texte` öffnen, Demo-CHECK/KETO verändern, Vorschau starten.
5. Kein Netzwerkkontakt zu Railway/Pete/Meta/WhatsApp. Bei Problemen sofort die Pages-App deaktivieren, nicht Auth-Schutz umgehen.
6. Test auf Android Chrome ohne Installation; keine echten Leads oder privaten Inhalte in Demo-Felder eintragen.

## Alternative nur wenn Access-Einrichtung nicht gelingt

**Nicht veröffentlichen**. GitHub Pages wäre für dieses öffentliche GitHub-Repository zwar kostenlos, aber als Einzelbenutzer nicht privat zugänglich. Clientseitig versteckte Seiten/Passwortfelder wären kein verlässlicher Zugangsschutz.

Nächster Human-Schritt: Cloudflare Pages/Access im eigenen Konto öffnen und kostenfreien Tarif bestätigen. Mit Screenshot der Einrichtungsansicht können wir dann die exakten Felder zusammen durchgehen.

Offizielle Informationen:
- https://developers.cloudflare.com/pages/platform/limits/
- https://developers.cloudflare.com/pages/configuration/build-configuration/
- https://developers.cloudflare.com/pages/configuration/preview-deployments/
- https://developers.cloudflare.com/pages/platform/known-issues/
- https://developers.cloudflare.com/cloudflare-one/setup/
