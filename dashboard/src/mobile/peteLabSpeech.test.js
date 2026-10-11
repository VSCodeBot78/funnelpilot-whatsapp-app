import assert from "node:assert/strict";
import test from "node:test";
import {
  recognitionConstructor, speechText, withDictation, speechErrorMessage,
} from "./peteLabSpeech.js";

test("direct voice button supports standard or Android Chrome prefixed recognizer", () => {
  function Standard() {}
  function AndroidChrome() {}
  assert.equal(recognitionConstructor({ SpeechRecognition: Standard }), Standard);
  assert.equal(recognitionConstructor({ webkitSpeechRecognition: AndroidChrome }), AndroidChrome);
  assert.equal(recognitionConstructor({}), null);
  assert.equal(recognitionConstructor(null), null);
});

test("speech converts final and interim words into one editable German draft", () => {
  const event = { results: [
    [{ transcript: "Hallo, " }],
    [{ transcript: "ich bin eine Mama und möchte " }],
    [{ transcript: "mehr Energie." }],
  ] };
  assert.equal(speechText(event), "Hallo, ich bin eine Mama und möchte mehr Energie.");
  assert.equal(withDictation("", speechText(event)),
    "Hallo, ich bin eine Mama und möchte mehr Energie.");
  assert.equal(withDictation("Ich habe wenig Zeit.", speechText(event)),
    "Ich habe wenig Zeit. Hallo, ich bin eine Mama und möchte mehr Energie.");
  assert.equal(withDictation("Vorheriger Text", ""), "Vorheriger Text");
  assert.equal(speechText({ results: [[], [{ transcript: "  Hallo " }]] }), "Hallo");
  assert.equal(speechText(undefined), "");
  assert.equal(speechText({ results: [] }), "");
});

test("microphone permission/network/error feedback is actionable", () => {
  assert.match(speechErrorMessage("not-allowed"), /Mikrofonzugriff/);
  assert.match(speechErrorMessage("audio-capture"), /Mikrofon/);
  assert.match(speechErrorMessage("network"), /Internet/);
  assert.match(speechErrorMessage("no-speech"), /Keine Sprache/);
  assert.match(speechErrorMessage("service-not-allowed"), /Chrome/);
  assert.match(speechErrorMessage("other"), /fehlgeschlagen/);
});
