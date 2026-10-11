/**
 * Browser-native speech-to-text helpers for the temporary Android Pete lab.
 * Never use Pete/OpenAI APIs for transcription; no audio is stored in Funnel Pilot.
 * A browser may use its own platform speech provider, subject to browser permissions.
 */
export function recognitionConstructor(browser) {
  return browser?.SpeechRecognition || browser?.webkitSpeechRecognition || null;
}

export function speechText(event) {
  const resultList = event?.results;
  if (!resultList || typeof resultList.length !== "number") return "";
  const words = [];
  for (let i = 0; i < resultList.length; i++) {
    const part = resultList[i];
    const transcript = typeof part?.[0]?.transcript === "string"
      ? part[0].transcript.trim() : "";
    if (transcript) words.push(transcript);
  }
  return words.join(" ").trim();
}

export function withDictation(originalDraft, transcript) {
  const start = typeof originalDraft === "string" ? originalDraft.trimEnd() : "";
  const added = typeof transcript === "string" ? transcript.trim() : "";
  if (!added) return originalDraft || "";
  return start ? start + " " + added : added;
}

const ERRORS = {
  "not-allowed": "Mikrofon nicht freigegeben. Bitte Mikrofonzugriff in Chrome erlauben.",
  "service-not-allowed": "Spracherkennung vom Browser gesperrt. Bitte direkt in Chrome öffnen.",
  "audio-capture": "Kein Mikrofon erreichbar. Bitte Android-Mikrofonberechtigung prüfen.",
  "no-speech": "Keine Sprache erkannt. Tippe zum erneuten Diktieren auf das Mikrofon.",
  "network": "Spracherkennung nicht erreichbar. Internetverbindung prüfen.",
  "language-not-supported": "Deutsche Spracherkennung wird hier nicht unterstützt.",
  "aborted": "Diktat beendet.",
};
export function speechErrorMessage(code) {
  return ERRORS[code] || "Spracherkennung fehlgeschlagen. Bitte in Chrome testen oder tippen.";
}
