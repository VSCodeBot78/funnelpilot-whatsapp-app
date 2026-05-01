function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

const AD_OPENER_PATTERNS = [
  "ich habe deine anzeige gesehen",
  "habe deine anzeige gesehen",
  "deine anzeige gesehen",
  "ich habe deine werbung gesehen",
  "habe deine werbung gesehen",
  "deine werbung gesehen",
  "interessiere mich für",
  "interesse an",
  "ich interessiere mich für",
  "hi jochen",
  "hallo jochen",
  "hey jochen",
  "guten tag jochen",
];

export function isAdOrWaMeOpener(input: string): boolean {
  const normalized = normalizeText(input);

  if (!normalized) {
    return false;
  }

  return AD_OPENER_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function buildAdOrWaMeOpenerReply(): string {
  return (
    "Hey 😊 mega, dass du dich meldest! Verrätst du mir deinen Namen?"
  );
}
