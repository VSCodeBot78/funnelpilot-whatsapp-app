# Phase 54: Korrekturen anhand des GPT-5.4-Realistic-Tests

Quelle: GitHub Actions 38123260402, zehn fiktive Eltern-Gespräche. Sieben längere Gespräche wurden gut und kontextnah beantwortet, zwei verifizierte Kauf-/Terminfragen mussten korrekt an einen Menschen, aber drei konkrete Qualitätsmängel wurden sichtbar.

1. **Historische Schwangerschaft**: Der Satz „Meine letzte Schwangerschaft ist über zwei Jahre her“ löste falsch `medical_critical` aus. Nur eindeutig historischer Kontext mit allgemeiner Fitnessfrage wird als Wissensfrage behandelt; Beschwerden, Insulin und aktuelle Schwangerschaft behalten die medizinische Schutzsperre.
2. **Kauf/Zugangs-Mail**: „Ich habe gestern den Selbststarter gekauft, aber finde die Zugangs-Mail nicht“ führte zu einem allgemeinen Modell-Handoff. Nun direkte, ehrliche und nicht verifizierende Bestellprüfungs-Antwort mit menschlicher Übernahme.
3. **Inhaltsfrage Selbststarter**: Die kombinierte Frage nach Selbststarter-Inhalt und Preis führte unnötig das teurere Coaching ein. Jetzt ausschließlich bestätigter Selbststarter-Preis und verifizierte Produktseite, ohne erfundene Inhaltsliste.
4. **Zwei Kanäle**: Pete versprach teilweise, nur noch in einem Chat zu schreiben. Der verifizierte Regelsatz nennt jetzt ausdrücklich die Ungewissheit über Instagram/WhatsApp-Cross-Channel-Stopps; Handoff bei Frage nach Jochen und der KI-Pause. Das Modell darf keine ungetestete Automatik-Garantie behaupten.

Alle neuen Tests verwenden Mock-Antworten. Sie validieren Routing, Sicherheit und Wortlaut, keine menschliche Qualitätsnote. Weitere echte GPT-5.4-Nachtests ausschließlich im freigegebenen, kumulativ gedeckelten Phase-3-Sandbox-Lauf; keine echten Meta-Nachrichten. **Phase 4 bleibt NO-GO bis alle relevanten Dialoge qualitativ abgenommen wurden.**
