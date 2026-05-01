function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,!?;:()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const INVALID_NAME_WORDS = new Set([
  "hallo",
  "hi",
  "hey",
  "huhu",
  "ja",
  "nein",
  "ok",
  "okay",
  "yes",
  "klar",
  "weiter",
  "go",
  "ich",
  "bin",
  "der",
  "die",
  "das",
  "und",
  "wir",
  "sind",
  "wer",
  "du",
  "ihr",
  "nobody",
  "niemand",
  "jemand",
  "später",
  "spaeter",
  "los",
  "muss",
  "weg",
  "unterwegs",
]);

const PLAYFUL_UNKNOWN_PATTERNS: RegExp[] = [
  /\bwer ich\b/i,
  /\bwer bin ich\b/i,
  /\bich bin ich\b/i,
  /\bna du\b/i,
  /\bmusst du doch wissen\b/i,
  /\bdu weißt doch wer ich bin\b/i,
  /\bdu weisst doch wer ich bin\b/i,
  /\brate mal\b/i,
  /\bwer sonst\b/i,
];

const MULTI_PERSON_PATTERNS: RegExp[] = [
  /\bwir sind\b/i,
  /\bich und\b/i,
  /\bund ich\b/i,
  /\bwir beide\b/i,
  /\bmein mann und ich\b/i,
  /\bmeine frau und ich\b/i,
  /\bmein partner und ich\b/i,
  /\bmeine partnerin und ich\b/i,
  /\bwir möchten\b/i,
  /\bwir wollen\b/i,
  /\bwir wuerden\b/i,
  /\bwir würden\b/i,
  /\bwir melden uns\b/i,
];

function capitalizeWord(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function isLikelyNameToken(token: string): boolean {
  if (!token) return false;
  if (token.length < 2) return false;
  if (token.length > 20) return false;
  if (!/^[a-zäöüß-]+$/i.test(token)) return false;
  if (INVALID_NAME_WORDS.has(token)) return false;
  return true;
}

function cleanupLeadingPhrases(normalized: string): string {
  return normalized
    .replace(/^(ich bin|ich heiße|ich heisse|mein name ist|hier ist)\s+/i, "")
    .replace(/^(der|die)\s+/i, "")
    .trim();
}

export function isPlayfulUnknownNameInput(input: string): boolean {
  const normalized = normalizeText(input);

  if (!normalized) {
    return false;
  }

  return PLAYFUL_UNKNOWN_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isMultiplePeopleIntroduction(input: string): boolean {
  const normalized = normalizeText(input);

  if (!normalized) {
    return false;
  }

  if (MULTI_PERSON_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  const andPattern =
    /\b([a-zäöüß-]{2,})\s+(und|&)\s+([a-zäöüß-]{2,})\b/i;

  const andMatch = normalized.match(andPattern);

  if (
    andMatch &&
    isLikelyNameToken(andMatch[1]) &&
    isLikelyNameToken(andMatch[3]) &&
    andMatch[1] !== andMatch[3]
  ) {
    return true;
  }

  return false;
}

export function parseName(input: string): string | null {
  const normalized = normalizeText(input);

  if (!normalized) {
    return null;
  }

  if (isPlayfulUnknownNameInput(normalized)) {
    return null;
  }

  if (isMultiplePeopleIntroduction(normalized)) {
    return null;
  }

  const cleaned = cleanupLeadingPhrases(normalized);
  if (!cleaned) {
    return null;
  }

  const tokens = cleaned
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);

  const validTokens = tokens.filter(isLikelyNameToken);

  if (validTokens.length === 0) {
    return null;
  }

  if (validTokens.length >= 2) {
    return capitalizeWord(validTokens[0]);
  }

  return capitalizeWord(validTokens[0]);
}
