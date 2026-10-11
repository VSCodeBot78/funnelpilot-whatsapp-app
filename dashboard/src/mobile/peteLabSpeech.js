/**
 * Speech is a browser feature, not an OpenAI request.
 * Never capture/record audio ourselves or auto-send recognized text.
 * The browser's speech engine may process audio remotely: use synthetic personas only.
 */
export function browserSpeechConstructor(win) {
  if (!win || typeof win !== "object") return null;
  const Candidate = win.SpeechRecognition || win.webkitSpeechRecognition;
  return typeof Candidate === "function" ? Candidate : null;
}

export function recognizedSpeech(event) {
  const results = event?.results;
  if (!results || typeof results.length !== "number") return "";
  const pieces = [];
  for (let i = 0; i < Math.min(results.length, 30); i++) {
    const entry = results[i];
    const value = entry?.[0]?.transcript;
    if (typeof value === "string" && value.trim()) pieces.push(value.trim());
  }
  return pieces.join(" ").trim().slice(0, 1000);
}

export function withRecognizedText(previous, recognized) {
  const before = typeof previous === "string" ? previous.trimEnd() : "";
  const next = typeof recognized === "string" ? recognized.trim() : "";
  if (!next) return before;
  return ((before ? before + " " : "") + next).slice(0, 1000);
}

export function speechErrorLabel(code) {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Mikrofonzugriff abgelehnt. Bitte im Browser für diese Seite erlauben.";
    case "audio-capture":
      return "Kein Mikrofon verfügbar. Prüfe die Android-Mikrofonberechtigung.";
    case "network":
      return "Spracherkennung benötigt hier eine Internetverbindung.";
    case "no-speech":
      return "Keine Sprache erkannt. Tippe auf das Mikrofon und versuche es erneut.";
    case "language-not-supported":
      return "Deutsch wird von diesem Browser-Sprachdienst nicht unterstützt.";
    case "aborted":
      return "";
    default:
      return "Spracherkennung ist momentan nicht verfügbar. Bitte in Chrome öffnen oder Text eingeben.";
  }
}
