import type { FlowOption, FlowStepId } from "../types/types.js";

export type ParentRole = "mama" | "papa" | "parent" | "not_parent" | "unknown";

export type ParentContextResult = {
  role: ParentRole;
  explicit: boolean;
  rawText: string;
};

export type ChoiceInterpretation = {
  mappedChoice: string | null;
  confidence: number;
  source: "exact_key" | "deterministic_semantic" | "none";
};

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[?!.,;:()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(normalized: string, values: string[]): boolean {
  return values.some((value) => normalized.includes(normalizeText(value)));
}

const NOT_PARENT_PHRASES = [
  "kein papa",
  "kein vater",
  "keine mama",
  "keine mutter",
  "kein elternteil",
  "nicht papa",
  "nicht vater",
  "nicht mama",
  "nicht mutter",
  "nicht elternteil",
  "keine kinder",
  "habe keine kinder",
  "hab keine kinder",
  "noch keine kinder",
  "noch kein papa",
  "noch keine mama",
];

const MAMA_PHRASES = [
  "mama",
  "mami",
  "mutter",
  "ich bin mutter",
  "als mutter",
];

const PAPA_PHRASES = [
  "papa",
  "papi",
  "vater",
  "ich bin vater",
  "als vater",
];

const PARENT_PHRASES = [
  "elternteil",
  "mein kind",
  "meine kinder",
  "unser kind",
  "unsere kinder",
  "wir haben kinder",
  "ich habe kinder",
  "ich hab kinder",
];

export function parseParentContext(input: string): ParentContextResult {
  const normalized = normalizeText(input);

  if (!normalized) {
    return { role: "unknown", explicit: false, rawText: input.trim() };
  }

  if (includesAny(normalized, NOT_PARENT_PHRASES)) {
    return { role: "not_parent", explicit: true, rawText: input.trim() };
  }

  if (includesAny(normalized, MAMA_PHRASES)) {
    return { role: "mama", explicit: true, rawText: input.trim() };
  }

  if (includesAny(normalized, PAPA_PHRASES)) {
    return { role: "papa", explicit: true, rawText: input.trim() };
  }

  if (includesAny(normalized, PARENT_PHRASES)) {
    return { role: "parent", explicit: true, rawText: input.trim() };
  }

  return { role: "unknown", explicit: false, rawText: input.trim() };
}

const SITUATION_ENERGY = [
  "mude",
  "mued",
  "platt",
  "erschopft",
  "erschoepft",
  "keine energie",
  "wenig energie",
  "energie fehlt",
  "kraftlos",
  "ausgelaugt",
  "schlapp",
];

const SITUATION_BODY = [
  "bauch",
  "gewicht",
  "abnehmen",
  "korper",
  "koerper",
  "unwohl",
  "figur",
  "fett",
  "speck",
  "kilos",
  "kleidung",
];

const SITUATION_MOVEMENT = [
  "bewegung",
  "sport",
  "training",
  "trainieren",
  "fitness",
  "keine zeit fur sport",
  "keine zeit fuer sport",
  "nicht unter",
  "komme nicht dazu",
];

const EVERYTHING = [
  "alles",
  "alles zusammen",
  "von allem",
  "mehrere",
  "eigentlich alles",
  "irgendwie alles",
];

const GOAL_ENERGY = [
  "mehr energie",
  "wieder energie",
  "fitter",
  "fit sein",
  "nicht mehr so mude",
  "nicht mehr so muede",
  "leistungsfahiger",
  "leistungsfaehiger",
];

const GOAL_BODY = [
  "abnehmen",
  "bauch weg",
  "weniger bauch",
  "gewicht runter",
  "wohlfuhlen",
  "wohlfuehlen",
  "besser im korper",
  "besser im koerper",
  "figur",
];

const GOAL_MOVEMENT = [
  "regelmassig sport",
  "regelmaessig sport",
  "regelmassig train",
  "regelmaessig train",
  "mehr bewegung",
  "wieder trainieren",
  "wieder sport",
  "bewegung schaffen",
  "training schaffen",
];

function exactChoiceKey(input: string, options: FlowOption[]): string | null {
  const normalized = normalizeText(input);
  const exact = options.find((option) => normalized === normalizeText(option.key));
  return exact?.key ?? null;
}

function mapCategoryChoice(
  normalized: string,
  groups: { key: string; keywords: string[] }[],
  everythingKey = "d",
): ChoiceInterpretation {
  if (includesAny(normalized, EVERYTHING)) {
    return {
      mappedChoice: everythingKey,
      confidence: 0.98,
      source: "deterministic_semantic",
    };
  }

  const matched = groups.filter((group) => includesAny(normalized, group.keywords));

  if (matched.length >= 2) {
    return {
      mappedChoice: everythingKey,
      confidence: 0.9,
      source: "deterministic_semantic",
    };
  }

  if (matched.length === 1) {
    return {
      mappedChoice: matched[0].key,
      confidence: 0.88,
      source: "deterministic_semantic",
    };
  }

  return {
    mappedChoice: null,
    confidence: 0,
    source: "none",
  };
}

export function interpretChoiceDeterministically(params: {
  stepId: FlowStepId;
  input: string;
  options: FlowOption[];
}): ChoiceInterpretation {
  const directKey = exactChoiceKey(params.input, params.options);
  if (directKey) {
    return {
      mappedChoice: directKey,
      confidence: 1,
      source: "exact_key",
    };
  }

  const normalized = normalizeText(params.input);

  if (params.stepId === "situation_choice") {
    return mapCategoryChoice(normalized, [
      { key: "a", keywords: SITUATION_ENERGY },
      { key: "b", keywords: SITUATION_BODY },
      { key: "c", keywords: SITUATION_MOVEMENT },
    ]);
  }

  if (params.stepId === "goal_choice") {
    return mapCategoryChoice(normalized, [
      { key: "a", keywords: GOAL_ENERGY },
      { key: "b", keywords: GOAL_BODY },
      { key: "c", keywords: GOAL_MOVEMENT },
    ]);
  }

  return {
    mappedChoice: null,
    confidence: 0,
    source: "none",
  };
}

export function extractScaleValue(
  input: string,
  min = 1,
  max = 10,
): number | null {
  const normalized = normalizeText(input);
  const matches = normalized.match(/\b(10|[1-9])\b/g);

  if (!matches || matches.length === 0) {
    return null;
  }

  const value = Number(matches[0]);
  return value >= min && value <= max ? value : null;
}

export function buildNaturalChoiceAcknowledgement(
  stepId: FlowStepId,
  mappedChoice: string,
): string {
  if (stepId === "situation_choice") {
    if (mappedChoice === "a") {
      return "Verstanden. Dann ist Energie gerade dein größter Engpass.";
    }
    if (mappedChoice === "b") {
      return "Verstanden. Dann geht’s dir gerade vor allem darum, dich wieder wohler in deinem Körper zu fühlen.";
    }
    if (mappedChoice === "c") {
      return "Verstanden. Dann ist die Umsetzung von Bewegung im Alltag gerade der Knackpunkt.";
    }
    if (mappedChoice === "d") {
      return "Okay, dann hängt bei dir gerade einiges zusammen.";
    }
  }

  if (stepId === "goal_choice") {
    if (mappedChoice === "a") {
      return "Klar. Mehr Energie im Alltag wäre für dich also der wichtigste Unterschied.";
    }
    if (mappedChoice === "b") {
      return "Klar. Du willst dich vor allem wieder wohler in deinem Körper fühlen.";
    }
    if (mappedChoice === "c") {
      return "Klar. Regelmäßige Bewegung wieder wirklich hinzubekommen wäre für dich der wichtigste Unterschied.";
    }
    if (mappedChoice === "d") {
      return "Verstanden. Für dich geht’s nicht um eine einzelne Baustelle, sondern darum, das Gesamtpaket wieder in den Griff zu bekommen.";
    }
  }

  return "Verstanden.";
}

export function buildHumanChoiceClarifier(stepId: FlowStepId): string {
  if (stepId === "situation_choice") {
    return (
      "Du musst nicht mit a/b/c antworten. Sag’s mir einfach normal:\n" +
      "Geht’s bei dir gerade eher um Energie, Körper/Bauch, Bewegung im Alltag oder mehrere Sachen zusammen?"
    );
  }

  if (stepId === "goal_choice") {
    return (
      "Sag’s mir einfach in deinen Worten:\n" +
      "Was wäre dir am wichtigsten: mehr Energie, dich wieder wohler im Körper fühlen, regelmäßiger Bewegung schaffen oder alles zusammen?"
    );
  }

  return "Sag’s mir einfach kurz in deinen Worten.";
}
