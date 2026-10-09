import type { FlowOption, FlowStepId } from "../types/types.js";

export type AiChoiceInterpretation = {
  mappedChoice: string | null;
  confidence: number;
  reason: string;
};

const OPENAI_API_URL = "https://api.openai.com/v1/responses";

function getApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY?.trim();
}

function getModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
}

function extractOutputText(responseJson: any): string | null {
  if (!responseJson?.output || !Array.isArray(responseJson.output)) {
    return null;
  }

  for (const item of responseJson.output) {
    if (!item?.content || !Array.isArray(item.content)) {
      continue;
    }

    for (const contentItem of item.content) {
      if (contentItem?.type === "output_text" && typeof contentItem.text === "string") {
        return contentItem.text;
      }
    }
  }

  return null;
}

export async function interpretChoiceWithAi(params: {
  stepId: FlowStepId;
  input: string;
  options: FlowOption[];
  leadName?: string;
}): Promise<AiChoiceInterpretation | null> {
  const apiKey = getApiKey();
  if (!apiKey || params.options.length === 0) {
    return null;
  }

  const optionKeys = params.options.map((option) => option.key);
  const optionText = params.options
    .map((option) => `${option.key}) ${option.label}`)
    .join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: getModel(),
        input: [
          {
            role: "system",
            content: [
              "Du ordnest eine freie Antwort eines Leads einer bestehenden Funnel-Auswahl zu.",
              "Du schreibst keine Verkaufsantwort.",
              "Du erfindest nichts und interpretierst nicht aggressiv.",
              "Nur wenn die Aussage inhaltlich klar zu einer Option passt, mappe sie.",
              "Wenn mehrere Hauptoptionen gleichzeitig klar genannt werden und eine Alles-/Mehrere-Option existiert, nutze diese.",
              "Wenn es eine echte Rückfrage statt einer Antwort ist oder die Aussage nicht passt, mappedChoice=null.",
              `Aktueller Schritt: ${params.stepId}`,
              `Lead: ${params.leadName ?? "unbekannt"}`,
              "Optionen:",
              optionText,
            ].join("\n"),
          },
          {
            role: "user",
            content: params.input,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "qualification_choice",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["mappedChoice", "confidence", "reason"],
              properties: {
                mappedChoice: {
                  anyOf: [
                    { type: "string", enum: optionKeys },
                    { type: "null" },
                  ],
                },
                confidence: {
                  type: "number",
                  minimum: 0,
                  maximum: 1,
                },
                reason: {
                  type: "string",
                },
              },
            },
          },
        },
      }),
    });

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    const raw = extractOutputText(json);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as AiChoiceInterpretation;

    if (
      parsed.mappedChoice !== null &&
      !optionKeys.includes(parsed.mappedChoice)
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
