# Funnel Pilot – Phase 37 / Priorität 7: Coach-Onboarding als sicherer Entwurf

**Stand: 10.10.2026.** Die Eingabemaske, die Vorschau und die Speicherung sind als Entwicklungsschritt implementiert und automatisiert getestet. Echte Coach-Konten, getrennte Daten, neue Meta-Verbindungen, unabhängige KI-Assistenten und SaaS-Livebetrieb wurden NICHT freigegeben.

## 1. Zweck und bewusste Abgrenzung

Funnel Pilot soll später auch von anderen Coaches als Jochen genutzt werden, ohne dass diese im Programmcode arbeiten müssen. Der bestehende Single-Workspace hatte bereits Eingabefelder für Marke, Website, Nische, Zielgruppe, Betreiber, Assistentenname, Markensprache, Master-Prompt, Einwände, Handover, Angebotsbeschreibung sowie Buchungs- und Checkout-Link.

Die neuen Felder sind **zusätzliche v1-Entwurfsdaten**, keine aktiven von Pete freigegebenen Konditionen, Preise oder Konversationsabläufe. Der vorhandene Jochen-Master-Prompt, die im Laufzeitsystem freigegebenen Produkte und Preise sowie die bestehenden Kampagnenregeln werden durch das Ausfüllen der neuen Entwürfe **nicht verändert**.

**WICHTIG:** Die vorhandenen alten Felder im Einrichtungsassistenten bearbeiten weiterhin denselben aktuellen Jochen-Workspace. Wer darin eine andere Marke oder einen anderen Master-Prompt speichert, verändert die vorhandene Konfiguration. Daher wurden deutliche Warnungen ergänzt: **Fremde Coach-Profile aktuell nur in separater Testumgebung testen**, nicht im laufenden Eltern-fit-&-vital-Workspace.

## 2. Neue Eingaben

Im Einrichtungsassistenten:

- **Schritt Marke & KI-Assistent:** vorhandene Felder für Marke, Website, Zielgruppe, Betreiber, Assistentenname, Tonalität, drei häufigste Kundeneinwände, Master-Prompt, Handover und No-Gos; dazu ein sichtbarer Hinweis auf den einzigen aktuellen Workspace.
- **Schritt Angebote:** Die vorhandenen globalen Angebots- und Buchungsfelder bleiben erhalten. Zusätzlich ein separater **Coach-Entwurf** mit Kontaktweg und optionaler selbst formulierter Begrüßung, **bis zu vier Angebotsentwürfen** (Name, Preisangabe, HTTPS-Link) sowie **bis zu fünf FAQs** (Frage und Antwort). Nicht ausgefüllte Reihen sind entfernbar und werden beim Speichern entfernt.
- **Speichern:** Ein eigener Knopf „Coach-Entwurf speichern“ und weiterhin der reguläre Weiter-Button. Speichern verwendet den bestehenden `/settings-config`-Endpunkt. Der gespeicherte Entwurf bleibt im vorhandenen Workspace, es wird **kein neuer Kunde/Benutzer angelegt**.
- **Vorschau:** Zeigt Marke, Betreiber, Assistent, Zielgruppe, Sprache, Kontakt, Begrüßung, Angebotsentwürfe und die Zahl der FAQs. Sie ist **keine generierte KI-Konversation**, keine echte Buchungsbestätigung und keine geprüfte Freigabe. Wenn für eine andere Marke noch Jochen-/Eltern-fit-&-vital-Referenzen im Master-Prompt oder in bestehenden Links stehen, erscheint ein deutlicher Hinweis.
- **Test:** Der bisherige Pete-Testchat bleibt unter „Test“ erreichbar, arbeitet aber weiterhin nur mit dem bestehenden Single-Workspace und ist **kein simuliertes eigenes Coach-Konto**. Der Hinweis steht jetzt im Wizard.

## 3. Versioniertes Schema und Validierung

Neu: `SettingsConfig.coachOnboardingDraft` mit dem Objekt

```json
{
  "version": 1,
  "preferredContact": "",
  "welcomeLine": "",
  "offers": [
    {"name": "Beispielangebot", "priceLabel": "", "url": "https://example.org/angebot"}
  ],
  "faqs": [
    {"question": "Für wen ist das?", "answer": "Für die definierte Zielgruppe."}
  ]
}
```

Die Struktur ist ein **Entwurf**, kein freigeschalteter Katalog. Das Backend akzeptiert nur exakt definierte Felder und vorgegebene Typen. Es begrenzt Zeichenlängen und Anzahl von Angeboten/FAQs, verlangt Angebotstitel und vollständige FAQ-Paare sowie HTTPS für optional angegebene Links. Ungültige Eingaben erzeugen HTTP **400** mit aussagekräftigem Fehler statt falscher Erfolgsmeldung. Es gibt keine Anbieter-Tokens oder Login-/Rollenfelder in dieser Struktur.

Ältere Settings ohne das Feld bleiben lesbar und verwenden einen leeren Entwurf. Ein beschädigtes, extern manipuliertes Coach-Entwurfsobjekt wird beim Lesen **nicht** in eine gültige Angebotsfreigabe umgewandelt.

Betroffene Module:
- `backend/src/services/coach-onboarding-draft.ts`
- `backend/src/services/settings-store.ts`
- `backend/src/routes/settings-config.ts`
- `dashboard/src/onboarding/CoachDraftEditor.jsx`
- `dashboard/src/onboarding/CoachProfilePreview.jsx`
- `dashboard/src/onboarding/coachOnboardingPreview.js`
- `dashboard/src/onboarding/SetupWizardModal.jsx`
- `dashboard/src/hooks/useSettingsConfig.js`

Die bisherigen Datenschutz-/Produktionszugriffs-Sperren aus Phase 36 gelten unverändert. Ein Coach-Entwurf wird unter dem aktuellen gemeinsamen `DATA_DIR` gespeichert, **nicht in einem gesonderten Mandanten**.

## 4. Automatisierte Abnahme

- Reale lokale HTTP-Anfragen an `/settings-config`: Entwurf mit Angebot, Preisangabe, Link und FAQ speichern → GET erneut abrufen → partielle Änderung an der Markensprache → alle neuen Daten bleiben vorhanden.
- Ungültiges Angebots-URL-Schema und fremde Rollen-/Admin-Felder werden mit **400** abgewiesen. Die Maximalzahlen und Textlängen werden geprüft.
- Sicherung der Angebotswahrheit: Test stellt sicher, dass `DEFAULT_MASTER_PROMPT`, `aiEnabled`, `testMode` und der bestehende `starterCheckoutUrl` **durch den zusätzlichen Coach-Entwurf nicht geändert werden**.
- Pure UI-Vorschautests: Kennzeichnung „Nur Entwurf“, Darstellung echter Eingaben, Warnung bei geerbten Jochen-Links, keine falsche Tenant-/Provider-Bestätigung, kein Versand-/Aktivierungsaufruf.
- Bestehende Backend-, Webhook-Sicherheits-, Startdiagnose-, Chat-, Dashboard- und Buildprüfungen müssen weiterhin grün bleiben.

## 5. Späterer manueller Laptop-Test – nur isoliert!

1. Sichere lokale Starter-/Preflight-Anleitung aus Phase 32 befolgen. **Nie echte Kundendaten für einen fremden Coach überschreiben**. Für fremde Coach-Tests einen **separaten lokalen `DATA_DIR` und eine eigene isolierte Testinstanz** nutzen, nicht den produktiven Jochen-Workspace. Der normale Starter verwendet den bestehenden lokalen Ordner und erstellt **keine** automatische Coach-Isolation.
2. Einrichtung → Marke & KI-Assistent: Testmarke, Zielgruppe, Assistentennamen und Sprache anlegen.
3. Angebote: Ein Testangebot samt optionaler Preisangabe und HTTPS-Link sowie zwei Test-FAQs eintragen; „Coach-Entwurf speichern“.
4. Seite schließen/neu laden, erneut öffnen: Entwurfsdaten vorhanden. Eine weitere FAQ ergänzen, speichern und erneut prüfen.
5. Vorschau: Werte korrekt, „Nur Entwurf“, ggf. Warnung vor Jochen-Vorlagen. Kein Preis/Link aus dem Entwurf wird von Pete automatisch versendet.
6. Ohne echte Meta-Sends durch die bestehenden Setup- und Navigationsfunktionen gehen. **Testchat bleibt weiterhin der aktuelle Single-Workspace**; echte fremde Coach-DMs sind nicht Gegenstand dieses Tests.
7. Optional mobile Darstellung des Editors/Preview im Browser prüfen. Erst später auf realem Android/iOS mit sicherem Login/PWA ausrollen.

## 6. Blocker vor echter SaaS-Freigabe

Die sieben geplanten Entwicklungsprioritäten sind damit zwar als Code-/Konzeptgrundlage bearbeitet, aber die **größte Produktionslücke ist noch offen**:

- Echtes Account-Onboarding mit Identitätsnachweis, Anmeldung, Rollen und Zugriffskontrolle.
- Vollständige **serverseitige Tenant-Isolation** für alle Daten, Integrationen und Actions (Coach A darf weder Coach B noch Jochen sehen). Mit den heutigen globalen JSON-Dateien und der aktuellen Settings-Struktur ist das nicht gegeben.
- Eigenständige Coach-Angebots-/Preiswahrheit pro Workspace und aktive Engine-Anbindung erst nach validierter Angebots-/Policy-Freigabe; persönliche Antworten und Safety-Regeln müssen vom richtigen Coach stammen.
- Isolierte Meta-/WhatsApp-/Calendly-/HubSpot-Verbindungen, Signaturen, Opt-outs, Ghosting und Human-Handover **je Coach**.
- Verschlüsselte Backups/Restore, HTTPS-Login, Audit-Logs, DSGVO-Verarbeitung und Lösch-/Exportverfahren; Hetzner-Betrieb aus Phase 36 separat abnehmen.
- Später eigener mobiler Arbeitsplatz/PWA (Backlog M-02) und einfache native Link-/Button-Flows (M-01) statt ManyChat.

**Go/No-Go:** Geeignet als **technische Coach-Onboarding-Vorbereitung und Demo in isolierter Testumgebung**. Noch **nicht** geeignet, um einen fremden Coach einzuladen oder Zugriff auf vorhandene Gespräche/Daten zu gewähren.
