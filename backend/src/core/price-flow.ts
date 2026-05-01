import { buildBookingPrompt, buildInfoOnlyReply } from "./response-builder.js";

export type PriceObjectionFollowUpCategory = "price" | "execution" | "unknown";
export type ExecutionDetail = "time" | "energy" | "consistency" | "unknown";

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function includesAnyKeyword(input: string, keywords: string[]): boolean {
  const normalized = normalizeText(input);
  return keywords.some((keyword) => normalized.includes(normalizeText(keyword)));
}

const PRICE_SELF_KEYWORDS = [
  "preis",
  "preis selbst",
  "geld",
  "teuer",
  "zu teuer",
  "zu viel",
  "kosten",
  "budget",
  "investition",
  "finanziell",
  "finanzieller rahmen",
  "leisten",
  "nicht leisten",
  "nicht bezahlen",
  "bezahlen",
  "ist mir zu teuer",
  "ist mir zu viel",
  "kann ich mir nicht leisten",
  "kann ich mir gerade nicht leisten",
  "kann ich mir grad nicht leisten",
  "kann ich mir aktuell nicht leisten",
  "kann ich mir momentan nicht leisten",
  "kann ich aktuell nicht zahlen",
  "kann ich gerade nicht zahlen",
  "aktuell nicht drin",
  "gerade nicht drin",
  "momentan nicht drin",
  "finanziell schwierig",
  "finanziell eng",
  "geld ist gerade knapp",
  "budget ist knapp",
  "zu teuer für mich",
  "echt teuer",
  "schon teuer",
  "ganz schön teuer",
  "ganz schoen teuer",
  "ganz schön viel",
  "ganz schoen viel",
  "schon viel",
  "echt viel",
  "ordentlich viel",
  "heftig",
  "sportlich",
  "stolz",
  "nicht ohne",
  "uff",
  "ui",
  "boah",
  "boa",
  "puh",
  "oha",
  "uff schon viel",
  "ui schon viel",
  "boah schon viel",
  "puh schon viel",
  "mmh schon viel",
  "mm schon viel",
  "mhm ganz schön viel",
  "ui zu teuer",
  "uff zu teuer",
  "boah zu teuer",
  "puh zu teuer",
  "zu kostspielig",
  "zu happig",
  "zu hoch",
  "preis ist hoch",
  "zu teuer gerade",
  "im moment zu teuer",
  "momentan zu teuer",
  "aktuell zu teuer",
  "für mich gerade zu teuer",
  "das ist mir zu teuer",
  "das wäre mir zu teuer",
  "das ist gerade zu viel",
  "das ist finanziell gerade nicht machbar",
  "das ist gerade nicht machbar",
  "das passt finanziell gerade nicht",
  "das sprengt gerade mein budget",
  "finanziell gerade schwierig",
"finanziell schwierig gerade",
"aktuell nicht drin",
"gerade nicht drin",
"momentan nicht drin",
"ist aber teuer",
"aber teuer",
"schon arg teuer",
"schon sehr teuer",
"ehrlich gesagt zu teuer",
"finanziell gerade eng",
"geldmäßig gerade schwierig",
"geldmaessig gerade schwierig",
"passt gerade finanziell nicht",
"passt finanziell gerade nicht rein",
"krieg ich finanziell gerade nicht hin",
"ist grad nicht drin",
"ist gerade nicht drin",

];

const PRICE_EXECUTION_KEYWORDS = [
  "alltag",
  "unterkriegen",
  "unter kriegen",
  "unterkriege",
  "unter kriege",
  "unterkrieg",
  "unter krieg",
  "im alltag unterkriegen",
  "im alltag unterkriege",
  "im alltag hinkriegen",
  "im alltag schaffen",
  "in meinen alltag passen",
  "in mein leben passen",
  "ob ich es unterkriege",
  "ob ich es unter kriege",
  "ob ich das unterkriege",
  "ob ich das unter kriege",
  "wirklich unterkriege",
  "wirklich unter kriege",
  "unterkriege ich",
  "unter kriege ich",
  "umsetzen",
  "umsetzung",
  "schaffen",
  "durchziehen",
  "tragbar",
  "dranbleiben",
  "dran bleiben",
  "dranzubleiben",
  "dran zu bleiben",
  "funktioniert nicht",
  "scheitert",
  "zeit",
  "energie",
  "realistisch",
  "ob ich das hinkriege",
  "ob ich das schaffe",
  "ob ich es schaffe",
  "ob ich es hinbekomme",
  "ob ich das hinbekomme",
  "ob ich dranbleibe",
  "ob ich wieder abbreche",
  "ob es wieder einschläft",
  "wieder einschlafen",
  "wieder abbrechen",
  "nicht durchziehen",
  "nicht dranbleiben",
  "nicht dranzubleiben",
  "nicht im alltag haltbar",
  "nicht alltagstauglich",
  "nicht tragbar",
  "nicht realistisch",
  "zu wenig zeit",
  "zu wenig energie",
  "ich schaffe das eh nicht",
  "im echten alltag",
  "mit job und kids",
  "mit job und kindern",
  "mit job und kind",
  "mit familie",
];

const EXECUTION_TIME_KEYWORDS = [
  "zeit",
  "zu wenig zeit",
  "keine zeit",
  "habe keine zeit",
  "hab keine zeit",
  "zu knapp",
  "zeitproblem",
  "zeit ist das problem",
  "zeit ist knapp",
  "zeitlich",
  "in den alltag pressen",
  "in mein leben pressen",
  "unter der woche schwierig",
  "kriege ich zeitlich nicht hin",
  "passt zeitlich nicht",
];

const EXECUTION_ENERGY_KEYWORDS = [
  "energie",
  "keine energie",
  "zu wenig energie",
  "platt",
  "müde",
  "muede",
  "erschöpft",
  "erschoepft",
  "kraftlos",
  "leer",
  "alltag zieht mich leer",
  "im alltag leer",
  "im alltag einfach keine energie",
  "mir fehlt energie",
  "mir bricht die energie weg",
];

const EXECUTION_CONSISTENCY_KEYWORDS = [
  "dranbleiben",
  "dran bleiben",
  "dranzubleiben",
  "dran zu bleiben",
  "durchziehen",
  "wieder einschlafen",
  "wieder abbrechen",
  "nicht durchziehen",
  "nicht dranbleiben",
  "nicht dranzubleiben",
  "scheitert",
  "konsequent",
  "konstanz",
  "routine halten",
  "routine aufrechterhalten",
  "immer wieder aufhören",
  "ich bleib nicht dran",
  "ich bleibe nicht dran",
];

export function classifyPriceObjectionFollowUp(
  input: string,
): PriceObjectionFollowUpCategory {
  const normalized = normalizeText(input);

  if (!normalized) {
    return "unknown";
  }

  if (includesAnyKeyword(normalized, PRICE_SELF_KEYWORDS)) {
    return "price";
  }

  if (includesAnyKeyword(normalized, PRICE_EXECUTION_KEYWORDS)) {
    return "execution";
  }

  if (
    normalized.includes("beides") ||
    normalized.includes("ein bisschen beides") ||
    normalized.includes("eigentlich beides") ||
    normalized.includes("sowohl als auch")
  ) {
    return "execution";
  }

  return "unknown";
}

export function classifyExecutionDetail(input: string): ExecutionDetail {
  const normalized = normalizeText(input);

  if (!normalized) {
    return "unknown";
  }

  if (includesAnyKeyword(normalized, EXECUTION_TIME_KEYWORDS)) {
    return "time";
  }

  if (includesAnyKeyword(normalized, EXECUTION_ENERGY_KEYWORDS)) {
    return "energy";
  }

  if (includesAnyKeyword(normalized, EXECUTION_CONSISTENCY_KEYWORDS)) {
    return "consistency";
  }

  return "unknown";
}

export function buildSoftPriceInfoReply(): string {
  return (
    "Bevor ich dir jetzt einfach irgendeine Zahl hinwerfe,\n" +
    "lass uns kurz prüfen, ob das überhaupt zu deiner Situation passt.\n" +
    "Dann können wir immer noch über den Preis sprechen."
  );
}

export function buildPriceObjectionReply(): string {
  return (
    "Verstehe. Danke, dass du das offen sagst.\n" +
    "Lass uns kurz sauber schauen, was gerade wirklich dahintersteht:\n" +
    "Geht’s dir gerade mehr um den Preis selbst\n" +
    "oder eher darum, ob du’s im Alltag überhaupt gut unterkriegst?"
  );
}

export function buildPriceSelfFollowUpReply(): string {
  return (
    "Okay, verstanden.\n" +
    "Dann geht’s dir gerade wirklich um den finanziellen Rahmen.\n" +
    "Wenn Ratenzahlung für dich grundsätzlich interessant ist, sag mir das direkt.\n" +
    "Wenn nicht, sag mir offen, was sich für dich aktuell stimmig anfühlen würde."
  );
}

export function buildPriceSelfInstallmentsReply(campaignId: string): string {
  return (
    "Wenn es um Ratenzahlung geht, klären wir das am besten kurz persönlich.\n" +
    "So kann ich dir sauber sagen, was in deiner Situation sinnvoll ist.\n\n" +
    buildBookingPrompt(campaignId)
  );
}

export function buildPriceExecutionFollowUpReply(): string {
  return (
    "Dann ist gerade eher nicht nur der Preis das Problem,\n" +
    "sondern ob du’s im echten Alltag wirklich sauber umgesetzt kriegst.\n" +
    "Genau da trennt sich meistens Motivation von System.\n" +
    "Was wirkt bei dir gerade am unrealistischsten:\n" +
    "Zeit, Energie oder dranzubleiben?"
  );
}

export function buildPriceUnclearFollowUpReply(): string {
  return (
    "Dann sag’s mir ganz direkt:\n" +
    "Geht’s dir gerade mehr um den Preis selbst\n" +
    "oder eher darum, ob du’s am Ende wirklich unterkriegst?"
  );
}

export function buildExecutionUnknownReply(): string {
  return (
    "Dann sag’s mir ganz kurz:\n" +
    "Was ist gerade am ehesten der Engpass — Zeit,\n" +
    "Energie oder dranzubleiben?"
  );
}

export function buildExecutionTimeReply(): string {
  return (
    "Verstehe. Dann ist gerade Zeit der Hauptengpass.\n" +
    "Genau deshalb bringt dir ein Plan nichts,\n" +
    "der nur auf dem Papier gut aussieht,\n" +
    "aber im Alltag auseinanderfällt.\n" +
    "Was wäre für dich aktuell realistischer:\n" +
    "a) kurze Einheiten, die sicher reinpassen\n" +
    "b) ein klarer Wochenplan mit festen Slots\n" +
    "c) eher erstmal Infos statt direkt Umsetzung"
  );
}

export function buildExecutionEnergyReply(): string {
  return (
    "Verstehe. Dann ist gerade weniger die Theorie das Problem,\n" +
    "sondern dass dir im Alltag einfach die Energie wegbricht.\n" +
    "Dann muss ein Plan nicht härter sein, sondern tragbarer.\n" +
    "Was trifft eher zu:\n" +
    "a) du brauchst erstmal wieder mehr Energie im Alltag\n" +
    "b) du brauchst vor allem eine klarere Struktur\n" +
    "c) du willst dir erstmal nur Infos anschauen"
  );
}

export function buildExecutionConsistencyReply(): string {
  return (
    "Verstehe. Dann ist gerade nicht Wissen das Problem,\n" +
    "sondern dranzubleiben, wenn der Alltag wieder reinballert.\n" +
    "Dann brauchst du weniger Motivation und mehr ein System, das dich auffängt.\n" +
    "Was würde dir gerade am meisten helfen:\n" +
    "a) ein klarer Wochenrahmen\n" +
    "b) weniger auf einmal und dafür sicher umsetzbar\n" +
    "c) erstmal Infos statt direkt loszulegen"
  );
}

export function buildExecutionTernaryChoiceValidationReply(): string {
  return "Antworte mir hier bitte einfach mit a, b oder c.";
}

export function buildExecutionBinaryChoiceValidationReply(): string {
  return "Antworte mir hier bitte einfach mit a oder b.";
}

export function buildExecutionBinaryEnergyReply(): string {
  return (
    "Dann ist klar: Du brauchst gerade nicht noch mehr Druck,\n" +
    "sondern erstmal wieder mehr Energie im Alltag.\n" +
    "Was passt gerade eher:\n" +
    "a) du willst erstmal greifbar machen, woran deine Energie im Alltag gerade am meisten hängen bleibt\n" +
    "b) du willst direkt kurz prüfen, ob ich dir dabei konkret helfen kann"
  );
}

export function buildExecutionBinaryConsistencyReply(): string {
  return (
    "Dann ist klar: Du brauchst gerade keinen härteren Plan,\n" +
    "sondern etwas, das auch hält, wenn der Alltag wieder dazwischenfunkt.\n" +
    "Was passt gerade eher:\n" +
    "a) du willst erstmal greifbar machen, wie so ein Rahmen bei dir aussehen müsste\n" +
    "b) du willst direkt kurz prüfen, ob ich dir dabei konkret helfen kann"
  );
}

export function buildExecutionBinaryTimeReply(): string {
  return (
    "Dann ist klar: Du brauchst gerade keinen perfekten Plan,\n" +
    "sondern etwas, das zeitlich wirklich in dein Leben passt.\n" +
    "Was passt gerade eher:\n" +
    "a) du willst erstmal greifbar machen, wie wenig trotzdem sinnvoll funktionieren kann\n" +
    "b) du willst direkt kurz prüfen, ob ich dir dabei konkret helfen kann"
  );
}

export function buildExecutionBinaryInfoReply(campaignId: string): string {
  return buildInfoOnlyReply(campaignId);
}

export function buildExecutionBinaryBookingReply(campaignId: string): string {
  return (
    "Gut. Dann lass uns das nicht weiter zerdenken.\n\n" +
    "Genau bei sowas helfe ich Eltern im Alltag.\n" +
    buildBookingPrompt(campaignId)
  );
}
