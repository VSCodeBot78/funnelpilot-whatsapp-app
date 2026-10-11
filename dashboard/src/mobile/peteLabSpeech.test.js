import assert from "node:assert/strict";
import test from "node:test";
import {
  browserSpeechConstructor, recognizedSpeech, withRecognizedText, speechErrorLabel,
} from "./peteLabSpeech.js";

test("speech feature detection does not assume WebView microphone support", () => {
  function FakeSpeech() {}
  assert.equal(browserSpeechConstructor(null), null);
  assert.equal(browserSpeechConstructor({}), null);
  assert.equal(browserSpeechConstructor({ webkitSpeechRecognition: FakeSpeech }), FakeSpeech);
  assert.equal(browserSpeechConstructor({ SpeechRecognition: FakeSpeech }), FakeSpeech);
  assert.equal(browserSpeechConstructor({ webkitSpeechRecognition: "not a constructor" }), null);
});

test("interim and final speech segments become editable text only", () => {
  const event = {
    results: [
      [{ transcript: "Ich bin Mama" }],
      [{ transcript: "und habe wenig Zeit" }],
      [{ transcript: "" }],
    ],
  };
  assert.equal(recognizedSpeech(event), "Ich bin Mama und habe wenig Zeit");
  assert.equal(withRecognizedText("Hallo", recognizedSpeech(event)),
    "Hallo Ich bin Mama und habe wenig Zeit");
  assert.equal(withRecognizedText("", ""), "");
  assert.equal(withRecognizedText("Text behalten", ""), "Text behalten");
  assert.equal(recognizedSpeech(null), "");
  assert.equal(recognizedSpeech({ results: [{ "0": { transcript: 5 } }] }), "");
  assert.equal(recognizedSpeech({ results: [[{ transcript: "x".repeat(2000) }]] }).length, 1000);
});

test("permission and browser error messages are actionable", () => {
  assert.match(speechErrorLabel("not-allowed"), /Mikrofonzugriff/);
  assert.match(speechErrorLabel("network"), /Internetverbindung/);
  assert.match(speechErrorLabel("audio-capture"), /Android/);
  assert.equal(speechErrorLabel("aborted"), "");
  assert.match(speechErrorLabel("unsupported"), /Chrome/);
});
