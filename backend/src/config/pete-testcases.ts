import {
  PETE_NEUTRAL_CONFIDENCE_FALLBACK,
  type PeteCommunicationColor,
  type PeteEscalationCategory,
} from "./pete-prompt-v1.js";

export type PeteTestCase = {
  id: string;
  category: string;
  incomingMessage: string;
  priorAssistantMessage?: string;
  expectedClassification: string;
  expectedBehavior: string;
  peteMayAnswer: boolean;
  jochenMustTakeOver: boolean;
  escalationCategory?: PeteEscalationCategory;
  internalCommunicationColorHint?: PeteCommunicationColor;
  internalColorUsageNote?: string;
  exampleReply: string;
};

export const PETE_TESTCASES: PeteTestCase[] = [
  {
    id: "free-entry-ad-seen",
    category: "Freier Einstieg",
    incomingMessage: "Hi, ich hab deine Anzeige gesehen.",
    expectedClassification: "freier Anzeigen-/WhatsApp-Einstieg",
    expectedBehavior: "kurz begrüßen, einordnen und nach dem Hauptthema fragen",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    internalCommunicationColorHint: "yellow",
    internalColorUsageNote:
      "leicht und menschlich aktivieren, aber die Farbe niemals benennen",
    exampleReply:
      "Hey, danke dir.\nDann schauen wir kurz, ob das für deinen Alltag passt.\nGeht es bei dir gerade eher um Energie, Bauch, Schlaf/Stress oder Struktur?",
  },
  {
    id: "suggested-entry-video-guide",
    category: "Vorgeschlagene Einstiegsmeldung",
    incomingMessage:
      "Hi Jochen, ich habe deine Anzeige zur kostenlosen Video-Anleitung gesehen und möchte wissen, ob das für meinen Elternalltag passt.",
    expectedClassification: "vorgeschlagener Einstieg mit Video-Anleitung",
    expectedBehavior:
      "bestätigen und kurz klären, welches Thema für den Elternalltag relevant ist",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    exampleReply:
      "Ja, genau dafür ist die Einordnung da.\nDamit ich es sauber einschätze:\nGeht es bei dir eher um Energie, Bauch, Schlaf/Stress oder Struktur?",
  },
  {
    id: "price-question",
    category: "Preisfrage",
    incomingMessage: "Was kostet das?",
    expectedClassification: "Preisfrage",
    expectedBehavior:
      "Preis ruhig einordnen, keinen Sofort-Buchungslink und kein aggressives Closing senden",
    peteMayAnswer: true,
    jochenMustTakeOver: true,
    escalationCategory: "price_negotiation",
    internalCommunicationColorHint: "blue",
    internalColorUsageNote:
      "sachlich einordnen, nicht diskutieren, keine Farbe oder Typisierung nennen",
    exampleReply:
      "Der persönliche Einstieg ist das 5-Wochen-Coaching für 499 €. Wenn persönliche Begleitung gerade nicht passt, gibt es den Selbststarter für 14,95 €.",
  },
  {
    id: "price-direct-sag-schon",
    category: "Preisfrage",
    incomingMessage: "sag schon",
    expectedClassification: "direkte Preisnachfrage",
    expectedBehavior:
      "bekannte Preisinfo nennen, aber ohne Push, Platz-sichern-Text oder Buchungslink",
    peteMayAnswer: true,
    jochenMustTakeOver: true,
    escalationCategory: "price_negotiation",
    internalCommunicationColorHint: "blue",
    internalColorUsageNote:
      "sachlich bleiben, nicht closen, keine Farbe oder Typisierung nennen",
    exampleReply:
      "Das 5-Wochen-Coaching liegt bei 499 €.\nWenn persönliche Begleitung gerade nicht passt, gibt es den Selbststarter für 14,95 €.\nWichtig ist, was zu deiner Situation und deinem Unterstützungsbedarf passt.",
  },
  {
    id: "medical-tinnitus-fatigue",
    category: "Medizinische Frage",
    incomingMessage:
      "Ich habe Pfeifen im Ohr und bin total m\u00fcde und Ich will endlich den Bauch loswerden.",
    expectedClassification: "medizinische Beschwerde",
    expectedBehavior:
      "medizinischen Teil markieren, nicht diagnostizieren, nicht hart beenden und weiter sauber einordnen",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    escalationCategory: "medical",
    exampleReply:
      "Das mit dem Pfeifen im Ohr notiere ich mir. Sowas sollte bei Bedarf sauber abgekl\u00e4rt werden.\nF\u00fcr die Einordnung hier ist wichtig:\nGeht es bei dir zus\u00e4tzlich eher um Stress/Schlaf, Energie oder Bauch?",
  },
  {
    id: "aggressive-coach",
    category: "Aggressiver Lead",
    incomingMessage: "Schon wieder so ein Coach, der nur Geld will.",
    expectedClassification: "Aggression / Misstrauen",
    expectedBehavior:
      "nicht rechtfertigen, ruhig bleiben, optional Exit anbieten",
    peteMayAnswer: true,
    jochenMustTakeOver: true,
    escalationCategory: "aggression_mistrust",
    internalCommunicationColorHint: "green",
    internalColorUsageNote:
      "ruhig deeskalieren, keinen Druck machen, keine Charakterfarbe aussprechen",
    exampleReply:
      "Verstehe ich. Genau deshalb soll hier auch niemand in irgendwas reingedr\u00fcckt werden. Wenn du nur kurz pr\u00fcfen willst, ob die kostenlose Anleitung f\u00fcr deinen Alltag Sinn macht, k\u00f6nnen wir das ruhig machen. Wenn nicht, ist auch okay.",
  },
  {
    id: "info-link-after-guide-context",
    category: "Kontextuelle Linkfrage",
    incomingMessage: "ok schick mir den link",
    priorAssistantMessage:
      "Wenn du nur kurz pr\u00fcfen willst, ob die kostenlose Anleitung f\u00fcr deinen Alltag Sinn macht, k\u00f6nnen wir das ruhig machen.",
    expectedClassification: "Info-/Video-Link nach Anleitungskontext",
    expectedBehavior:
      "korrekten Video-Anleitungslink senden, keinen Buchungslink und keinen Checkout-Link",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    exampleReply:
      "Klar, hier ist die kostenlose Video-Anleitung:\nKostenlose Video-Anleitung\nhttps://jochen-kammerer.de/eltern-energie-training/",
  },
  {
    id: "video-guide-link-direct",
    category: "Video-Anleitung-Link",
    incomingMessage: "die Video Anleitung",
    expectedClassification: "direkte Anfrage nach kostenloser Video-Anleitung",
    expectedBehavior:
      "kostenlose Video-Anleitung mit korrektem Training-Link senden, keine veraltete Angebots-URL",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    exampleReply:
      "Klar, hier ist die kostenlose Video-Anleitung:\nKostenlose Video-Anleitung\nhttps://jochen-kammerer.de/eltern-energie-training/",
  },
  {
    id: "ambiguous-link-request",
    category: "Unklare Linkfrage",
    incomingMessage: "Schick mir den Link",
    expectedClassification: "unklare Link-Anfrage ohne Kontext",
    expectedBehavior:
      "nicht raten, keinen zufälligen Link senden, nach aktuellem Angebot/Ressource oder Termin klären, ohne technische Link-Bezeichnung",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    exampleReply:
      "Klar. Geht's dir um die Eltern Vital Methode, den Selbststarter, den Elterncheck, den Keto Guide oder direkt um einen Termin?",
  },
  {
    id: "warm-signal-alone",
    category: "Warmes Signal",
    incomingMessage:
      "Ich weiß, dass ich was ändern muss, aber ich bekomme es allein nicht hin.",
    expectedClassification: "warmer Lead mit Unterstützungsbedarf",
    expectedBehavior:
      "kurz paraphrasieren, Zielbild oder Unterstützungsbedarf klären, Strategiegespräch vorbereiten",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    exampleReply:
      "Klingt so, als wäre der Wille da, aber dir fehlt gerade die passende Struktur.\nWas wäre für dich zuerst wichtiger:\nmehr Energie oder wieder mehr Kontrolle über Bauch/Alltag?",
  },
  {
    id: "cold-what-is-this",
    category: "Kalter Lead",
    incomingMessage: "Was ist das?",
    expectedClassification: "kalter unklarer Einstieg",
    expectedBehavior:
      "kurz erklären, nicht pitchen, Video-Anleitung anbieten oder Hauptthema klären",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    exampleReply:
      "Kurz gesagt: Es geht darum, Eltern im echten Alltag wieder zu mehr Energie, Struktur und einem besseren Körpergefühl zu führen.\nDamit ich nichts Falsches schicke:\nWas ist bei dir gerade das Hauptthema?",
  },
  {
    id: "unclear-yes",
    category: "Unklare Antwort",
    incomingMessage: "Ja",
    expectedClassification: "unklarer Kontext / Ein-Wort-Antwort",
    expectedBehavior: "nicht raten, Kontext klären",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    escalationCategory: "unclear_context",
    exampleReply: PETE_NEUTRAL_CONFIDENCE_FALLBACK,
  },
  {
    id: "belly-topic",
    category: "Thema Bauch",
    incomingMessage: "Ich will endlich den Bauch loswerden.",
    expectedClassification: "Bauch / Körpergefühl",
    expectedBehavior:
      "nicht versprechen, Alltag und Struktur erfragen",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    exampleReply:
      "Verstanden, der Bauch ist gerade dein Hauptthema.\nIch verspreche dir da nichts pauschal.\nWoran scheitert es im Alltag eher: Essen, Bewegung, Stress oder Dranbleiben?",
  },
  {
    id: "sleep-stress",
    category: "Thema Schlaf/Stress",
    incomingMessage: "Ich schlafe schlecht und funktioniere nur noch.",
    expectedClassification: "Schlaf/Stress mit Belastung",
    expectedBehavior:
      "ruhig spiegeln, Belastung klären, keine medizinische Diagnose",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    exampleReply:
      "Das klingt nach ziemlich viel Druck im Alltag.\nIch kann das hier nicht medizinisch bewerten.\nGeht es bei dir eher um Schlaf, Stress oder fehlende Struktur tagsüber?",
  },
  {
    id: "discount",
    category: "Rabatt",
    incomingMessage: "Gibt es Rabatt?",
    expectedClassification: "Preisverhandlung",
    expectedBehavior:
      "nicht verhandeln, ruhig einordnen, Jochen übernimmt bei Details",
    peteMayAnswer: true,
    jochenMustTakeOver: true,
    escalationCategory: "price_negotiation",
    exampleReply:
      "Rabatte kläre ich hier nicht im Chat.\nWenn es grundsätzlich passen könnte, schaut Jochen lieber sauber mit dir, welche Option sinnvoll ist.",
  },
  {
    id: "direct-call-request",
    category: "Sofortiger Call-Wunsch",
    incomingMessage: "Kann ich direkt mit Jochen sprechen?",
    expectedClassification: "heißer Lead / Call-Wunsch",
    expectedBehavior:
      "hei\u00dfen Lead erkennen; echten Booking-Link senden, falls vorhanden; sonst sauberer Handoff, keinen Platzhalter ausgeben",
    peteMayAnswer: true,
    jochenMustTakeOver: true,
    escalationCategory: "hot_lead",
    internalCommunicationColorHint: "red",
    internalColorUsageNote:
      "direkt und knapp zum nächsten Schritt führen, ohne die Farbe zu benennen",
    exampleReply:
      "Ja, das macht Sinn.\nDann halte ich kurz fest, worum es geht, und Jochen meldet sich pers\u00f6nlich bei dir.",
  },
  {
    id: "bot-identity-question",
    category: "Transparenz",
    incomingMessage: "Bist du eine KI oder schreibt Jochen pers\u00f6nlich?",
    expectedClassification: "direkte KI-/Bot-/Jochen-Frage",
    expectedBehavior:
      "ehrlich antworten, Pete als KI-Assistent benennen, aber nicht ungefragt technisch wirken",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    exampleReply:
      "Ich bin Pete, Jochens KI-Assistent. Ich helfe hier bei der ersten Einordnung, damit du schnell eine saubere Antwort bekommst. Wenn es pers\u00f6nlich oder konkreter wird, \u00fcbernimmt Jochen direkt.",
  },
  {
    id: "free-plan-only",
    category: "Nicht passend",
    incomingMessage: "Ich suche nur einen kostenlosen Plan.",
    expectedClassification: "Info-only / nicht kaufnah",
    expectedBehavior:
      "kostenlose Video-Anleitung anbieten oder freundlich abgrenzen",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    exampleReply:
      "Alles klar, dann macht ein Gespräch gerade vermutlich keinen Sinn.\nDu kannst dir erstmal die kostenlose Anleitung anschauen.\nWenn du danach mehr willst, können wir weiter sortieren.",
  },
  {
    id: "critical-medication-fast-weight-loss",
    category: "Medizinisch kritisch",
    incomingMessage: "Ich nehme Medikamente und will schnell abnehmen.",
    expectedClassification: "medizinisch kritisch / Medikamente",
    expectedBehavior:
      "keine Beratung, keine schnelle Abnahme versprechen, Jochen und ärztliche Abklärung",
    peteMayAnswer: true,
    jochenMustTakeOver: true,
    escalationCategory: "medical",
    exampleReply:
      "Da m\u00f6chte ich nichts Falsches sagen. Bei Medikamenten, Diagnosen oder akuten Beschwerden sollte das sauber \u00e4rztlich abgekl\u00e4rt werden. Ich gebe das an Jochen weiter, damit du keine unklare Empfehlung bekommst.",
  },
  {
    id: "free-nonsense",
    category: "Freie Nonsens-Nachricht",
    incomingMessage: "Ok haha keine Ahnung",
    expectedClassification: "unklarer Kontext",
    expectedBehavior: "nicht raten, nicht pitchen, einfache Kl\u00e4rungsfrage stellen",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    escalationCategory: "unclear_context",
    exampleReply:
      "Alles klar. Dann machen wir es einfach:\nWelches Thema m\u00f6chtest du in den n\u00e4chsten Wochen zuerst angehen: Energie, Bauch, Schlaf/Stress oder Struktur?",
  },
  {
    id: "forbidden-awkward-wording",
    category: "Formulierung",
    incomingMessage: "Keine Ahnung",
    expectedClassification: "unklarer Kontext / Formulierungscheck",
    expectedBehavior:
      "Antwort darf nicht enthalten: 'Was sorgt f\u00fcr z\u00f6gernd bei dir?' oder 'Was ist bei dir gerade am gr\u00f6\u00dften'",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    escalationCategory: "unclear_context",
    exampleReply:
      "Welches Thema m\u00f6chtest du in den n\u00e4chsten Wochen zuerst angehen: Energie, Bauch, Schlaf/Stress oder Struktur?",
  },
  {
    id: "objection-price-too-expensive",
    category: "Einwand / Preis",
    incomingMessage:
      "Hi\nTim\nWas kostet das?\n499 \u20ac ist mir ehrlich gesagt zu teuer.",
    expectedClassification: "Preis-/Budget-Einwand",
    expectedBehavior:
      "AAA: ruhig abholen, Passung/Wert kl\u00e4ren, kein Rabatt, kein Druck und kein Booking-Push",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    escalationCategory: "price_negotiation",
    exampleReply:
      "Verstehe ich.\nGerade deshalb sollte klar sein, ob es \u00fcberhaupt zu deiner Situation passt.\nWas m\u00fcsste sich bei dir ver\u00e4ndern, damit es sich \u00fcberhaupt lohnt?",
  },
  {
    id: "objection-no-time",
    category: "Einwand / Zeit",
    incomingMessage: "Hi\nNina\nGrad keine Zeit f\u00fcr lange Chats.",
    expectedClassification: "Zeit-Einwand",
    expectedBehavior:
      "kurz bleiben, keinen Monolog senden, eine kleine Info-Alternative anbieten",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    exampleReply:
      "Verstehe ich.\nDann halten wir es kurz.\nSoll ich dir erst die kostenlose Video-Anleitung schicken?",
  },
  {
    id: "objection-send-info-first",
    category: "Einwand / Info",
    incomingMessage: "Hi\nBen\nSchick mir erst mal Infos.",
    expectedClassification: "Info-Routing-Signal",
    expectedBehavior:
      "Info-Wunsch kl\u00e4ren oder passenden Info-Link senden, keinen Booking-Link pushen",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    exampleReply:
      "Klar.\nDamit ich dir nicht den falschen Link schicke:\nGeht's dir um die kostenlose Video-Anleitung oder um Infos zum Strategiegespr\u00e4ch?",
  },
  {
    id: "objection-sleep-on-it",
    category: "Einwand / Nachdenken",
    incomingMessage: "Hi\nSarah\nIch will da erstmal dr\u00fcber schlafen.",
    expectedClassification: "Nachdenk-/Unsicherheits-Einwand",
    expectedBehavior:
      "nicht dr\u00fccken, offene Unsicherheit kurz kl\u00e4ren, keine Endlosschleife starten",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    exampleReply:
      "V\u00f6llig okay.\nSowas muss sich stimmig anf\u00fchlen.\nWas ist gerade noch offen: Zeit, Preis oder ob es grunds\u00e4tzlich passt?",
  },
  {
    id: "objection-soft-no-interest",
    category: "Einwand / Soft No",
    incomingMessage: "Hi\nAlex\nKlingt gerade nicht relevant f\u00fcr mich.",
    expectedClassification: "Soft-No ohne Opt-out",
    expectedBehavior:
      "einmal respektvoll kl\u00e4ren, ob es grunds\u00e4tzlich kein Thema oder nur gerade nicht passend ist",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    exampleReply:
      "Alles gut, danke f\u00fcr die Ehrlichkeit.\nIst es grunds\u00e4tzlich kein Thema f\u00fcr dich oder gerade einfach nicht der richtige Zeitpunkt?",
  },
  {
    id: "objection-hard-stop",
    category: "Hard Stop",
    incomingMessage: "Hi\nAlex\nNein danke, bitte nichts mehr schicken.",
    expectedClassification: "klarer Opt-out / Hard Stop",
    expectedBehavior:
      "sofort schlie\u00dfen, keine weitere Frage, kein CTA, kein Link",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    exampleReply:
      "Alles klar, danke f\u00fcr die R\u00fcckmeldung. Dann schreibe ich dir dazu nicht weiter.",
  },
  {
    id: "objection-partner",
    category: "Einwand / Partner",
    incomingMessage: "Hi\nLisa\nIch muss das erst mit meinem Mann besprechen.",
    expectedClassification: "Partner-/Umfeld-Einwand",
    expectedBehavior:
      "Partner nicht als Hindernis behandeln, gemeinsamen Informationsstand anbieten",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    exampleReply:
      "Verstehe ich.\nGerade bei so einer Entscheidung ist es sinnvoll, wenn ihr beide denselben Stand habt.\nSoll ich dir eine kurze \u00dcbersicht schicken, die ihr gemeinsam anschauen k\u00f6nnt?",
  },
  {
    id: "objection-trust-coach",
    category: "Einwand / Misstrauen",
    incomingMessage: "Hi\nTom\nSchon wieder so ein Coach, der nur verkaufen will.",
    expectedClassification: "Misstrauen / Coach-Abwehr",
    expectedBehavior:
      "deeskalieren, nicht rechtfertigen, Info vor Booking anbieten",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    escalationCategory: "aggression_mistrust",
    exampleReply:
      "Kann ich verstehen.\nOnline wird viel versprochen, deshalb dr\u00fccke ich dich hier in nichts rein.\nSoll ich dir erst die kostenlose Anleitung schicken?",
  },
  {
    id: "human-request-before-partner-objection",
    category: "Priorit\u00e4t / Human Request",
    incomingMessage:
      "Hi\nJulia\nIch muss das noch kurz zu Hause besprechen, w\u00fcrde aber eigentlich gern direkt mit Jochen reden.",
    expectedClassification: "Human Request vor Partner-Einwand",
    expectedBehavior:
      "direkten Jochen-/Terminwunsch vorrangig behandeln und echten Booking-Link oder sicheren Handoff nutzen",
    peteMayAnswer: true,
    jochenMustTakeOver: true,
    escalationCategory: "hot_lead",
    exampleReply:
      "Ja, das macht Sinn.\nDann lass uns direkt einen Termin festmachen, damit das nicht im Chat versandet.\nHier kannst du dir ein Strategiegespr\u00e4ch sichern:\n[ECHTER_BOOKING_LINK]",
  },
  {
    id: "medical-critical-before-objection",
    category: "Priorit\u00e4t / Medizinisch",
    incomingMessage:
      "Hi\nChris\nIch bin unsicher, weil ich Medikamente nehme und will da nichts falsch machen.",
    expectedClassification: "medizinisch kritisch vor Einwandlogik",
    expectedBehavior:
      "keine Beratung, kein Einwand-Handling, medizinische Vorsicht und Handoff",
    peteMayAnswer: true,
    jochenMustTakeOver: true,
    escalationCategory: "medical",
    exampleReply:
      "Da m\u00f6chte ich nichts Falsches sagen. Bei Medikamenten, Diagnosen oder akuten Beschwerden sollte das sauber \u00e4rztlich abgekl\u00e4rt werden. Ich gebe das an Jochen weiter, damit du keine unklare Empfehlung bekommst.",
  },
  {
    id: "regression-hard-stop-contact-me-no-more",
    category: "Regression / Decision Layer",
    incomingMessage: "bitte kontaktiere mich nicht mehr",
    expectedClassification: "hard_stop",
    expectedBehavior: "sofort schliessen, keine Frage, kein Link, keine Funnel-Logik",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    exampleReply:
      "Alles klar, danke f\u00fcr die R\u00fcckmeldung. Dann schreibe ich dir dazu nicht weiter.",
  },
  {
    id: "regression-hard-stop-nothing-more",
    category: "Regression / Decision Layer",
    incomingMessage: "Nein danke, bitte nichts mehr schicken.",
    expectedClassification: "hard_stop",
    expectedBehavior: "sofort schliessen, keine weitere Nachfrage",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    exampleReply:
      "Alles klar, danke f\u00fcr die R\u00fcckmeldung. Dann schreibe ich dir dazu nicht weiter.",
  },
  {
    id: "regression-price-question-no-push",
    category: "Regression / Decision Layer",
    incomingMessage: "Was kostet das?",
    expectedClassification: "price_question",
    expectedBehavior: "ruhige Preis-Einordnung, kein Buchungslink, keine Platz-sichern-Sprache",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    escalationCategory: "price_negotiation",
    exampleReply:
      "Der persönliche Einstieg ist das 5-Wochen-Coaching für 499 €. Wenn persönliche Begleitung gerade nicht passt, gibt es den Selbststarter für 14,95 €.",
  },
  {
    id: "regression-direct-price-sag-schon-no-push",
    category: "Regression / Decision Layer",
    incomingMessage: "sag schon",
    expectedClassification: "price_question / direct price",
    expectedBehavior: "bekannte Preisinfo nennen, ohne Platz sichern oder Checkout-Push",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    escalationCategory: "price_negotiation",
    exampleReply:
      "Das 5-Wochen-Coaching liegt bei 499 €.\nWenn persönliche Begleitung gerade nicht passt, gibt es den Selbststarter für 14,95 €.\nWichtig ist, was zu deiner Situation und deinem Unterstützungsbedarf passt.",
  },
  {
    id: "regression-installments-personal-conversation",
    category: "Regression / Decision Layer",
    incomingMessage: "Ratenzahlung",
    expectedClassification: "price_objection",
    expectedBehavior: "Ratenzahlung nicht erfinden, Richtung persoenliches Strategiegespraech fuehren",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    escalationCategory: "price_negotiation",
    exampleReply:
      "Ratenzahlung kl\u00e4ren wir am besten kurz pers\u00f6nlich.\nWenn es grunds\u00e4tzlich passen k\u00f6nnte, ist ein kurzes Strategiegespr\u00e4ch der sauberste n\u00e4chste Schritt.",
  },
  {
    id: "regression-human-request-reach-jochen",
    category: "Regression / Decision Layer",
    incomingMessage: "ok wie erreiche ich Jochen",
    expectedClassification: "human_request / booking_request",
    expectedBehavior: "Human Request vor Einwandlogik, echter Booking-Link oder sauberer Termin-Hinweis",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    escalationCategory: "hot_lead",
    exampleReply:
      "Ja, das macht Sinn.\nHier kannst du dir direkt ein Strategiegespr\u00e4ch buchen:\n[ECHTER_BOOKING_LINK]",
  },
  {
    id: "regression-video-offer-yes-please",
    category: "Regression / Decision Layer",
    incomingMessage: "ja bitte",
    priorAssistantMessage: "Soll ich dir erst die kostenlose Video-Anleitung schicken?",
    expectedClassification: "link_request / info",
    expectedBehavior: "Video-Link senden, keinen Booking-Link",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    exampleReply:
      "Klar, hier ist die kostenlose Video-Anleitung:\nKostenlose Video-Anleitung\nhttps://jochen-kammerer.de/eltern-energie-training/",
  },
  {
    id: "regression-info-first-clarify",
    category: "Regression / Decision Layer",
    incomingMessage: "Schick mir erst mal Infos",
    expectedClassification: "link_request / info_clarify",
    expectedBehavior: "Info-Wunsch klaeren, keinen Booking-Link und keinen Checkout-Link senden",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    exampleReply:
      "Geht's dir um die Eltern Vital Methode, den Selbststarter, den Elterncheck oder den Keto Guide?",
  },
  {
    id: "regression-offer-info-question",
    category: "Regression / Decision Layer",
    incomingMessage: "was bietest du denn an?",
    expectedClassification: "offer_info",
    expectedBehavior: "kurz erklaeren, nicht als Name oder Pain-Frage behandeln",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    exampleReply:
      "Kurz gesagt: Das persönliche Einstiegsangebot ist das 5-Wochen-Coaching für Eltern im echten Alltag.\nMehr Energie, bessere Struktur und wieder ein besseres Körpergefühl.\nWenn du erstmal selbst loslegen willst, gibt es zusätzlich den Selbststarter für 14,95 €.",
  },
  {
    id: "regression-soft-no-close",
    category: "Regression / Decision Layer",
    incomingMessage: "kein thema f\u00fcr mich",
    priorAssistantMessage:
      "Ist es grunds\u00e4tzlich kein Thema f\u00fcr dich oder gerade einfach nicht der richtige Zeitpunkt?",
    expectedClassification: "objection / soft no",
    expectedBehavior: "bei wiederholtem Soft-No respektvoll schliessen",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    exampleReply:
      "Alles gut, danke f\u00fcr die Ehrlichkeit.\nDann macht es gerade keinen Sinn, dich weiter durch den Funnel zu f\u00fchren.\nWenn es sp\u00e4ter doch relevant wird, kannst du dich melden.",
  },
  {
    id: "regression-previous-attempts-not-price",
    category: "Regression / Decision Layer",
    incomingMessage:
      "schon vieles probiert aber nichts hat den gew\u00fcnschten Effekt gebracht",
    expectedClassification: "frustration_previous_attempts",
    expectedBehavior: "nicht als Preis-/Budget-Einwand klassifizieren",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    exampleReply:
      "Verstehe. Dann klingt es nicht nach noch mehr Wissen, sondern danach, dass es im Alltag bisher nicht stabil gegriffen hat.\nWas war bisher eher der Knackpunkt: Zeit, Energie oder Dranbleiben?",
  },
  {
    id: "regression-intro-why-not-start-question",
    category: "Regression / Decision Layer",
    incomingMessage: "warum nicht",
    priorAssistantMessage:
      "Ich stelle dir dazu kurz ein paar schnelle Fragen, ok?",
    expectedClassification: "question_intro_confirmed",
    expectedBehavior: "nach Fragen-Intro die erste Funnel-Frage starten",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    exampleReply: "Was merkst du aktuell im Alltag am meisten?",
  },
  {
    id: "regression-intro-what-about-questions",
    category: "Regression / Decision Layer",
    incomingMessage: "was ist mit den fragen?",
    priorAssistantMessage:
      "Ich stelle dir dazu kurz ein paar schnelle Fragen, ok?",
    expectedClassification: "question_intro_confirmed",
    expectedBehavior: "nach Fragen-Intro die erste Funnel-Frage starten",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    exampleReply: "Was merkst du aktuell im Alltag am meisten?",
  },
  {
    id: "regression-medical-handoff-later-booking",
    category: "Regression / Decision Layer",
    incomingMessage: "kann ich Termin buchen?",
    priorAssistantMessage:
      "Da m\u00f6chte ich nichts Falsches sagen. Bei Medikamenten, Diagnosen oder akuten Beschwerden sollte das sauber \u00e4rztlich abgekl\u00e4rt werden.",
    expectedClassification: "booking_request trotz aktivem Medical-Handoff",
    expectedBehavior: "keine Beratung geben, aber Terminbuchung nicht blockieren",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    escalationCategory: "medical",
    exampleReply:
      "Ja, das macht Sinn.\nHier kannst du dir direkt ein Strategiegespr\u00e4ch buchen:\n[ECHTER_BOOKING_LINK]",
  },
  {
    id: "regression-trust-coach-no-sales",
    category: "Regression / Decision Layer",
    incomingMessage: "Schon wieder so ein Coach, der nur verkaufen will.",
    expectedClassification: "objection / trust",
    expectedBehavior: "deeskalieren, kein Rechtfertigen, kostenlose Anleitung anbieten",
    peteMayAnswer: true,
    jochenMustTakeOver: false,
    escalationCategory: "aggression_mistrust",
    exampleReply:
      "Kann ich verstehen.\nOnline wird viel versprochen, deshalb drücke ich dich hier in nichts rein.\nSoll ich dir erst den kostenlosen Elterncheck schicken?",
  },
];

export function getPeteRegressionTestCases(): PeteTestCase[] {
  return PETE_TESTCASES.filter((testCase) =>
    testCase.category.startsWith("Regression /"),
  );
}
