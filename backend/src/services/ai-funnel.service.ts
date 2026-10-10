import { containsGeneratedPrice, isUnverifiedLongTermPriceQuestion } from "../config/offer-truth.js";
import { AI_OBJECTION_FRAMEWORK } from "../config/ai-objection-framework.js";
import type { AiFunnelReply, AiObjectionCategory } from "../types/ai-funnel.types.js";
import { readSettings } from "./settings-store.js";

type AiReplyParams = {
  category: AiObjectionCategory;
  userMessage: string;
  currentStep:
    | "ask_name"
    | "intro_ack"
    | "parent_context"
    | "situation_choice"
    | "tried_before_freetext"
    | "consequence_freetext"
    | "goal_choice"
    | "importance_scale"
    | "commitment"
    | "booking"
    | "info_only"
    | "done";
  nextStep:
    | "ask_name"
    | "intro_ack"
    | "parent_context"
    | "situation_choice"
    | "tried_before_freetext"
    | "consequence_freetext"
    | "goal_choice"
    | "importance_scale"
    | "commitment"
    | "booking"
    | "info_only"
    | "done";
  leadName?: string;
  allowedModes?: string[];
  mustNotAskQuestion?: boolean;
};

const OPENAI_API_URL = "https://api.openai.com/v1/responses";

function getApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY?.trim();
}

function getModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
}

function isAiEnabled(): boolean {
  // A configured API key alone must never activate paid AI requests.
  return Boolean(getApiKey()) && readSettings().aiEnabled === true;
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

function buildSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "category",
      "mode",
      "replyText",
      "returnToFunnel",
      "targetStep",
      "mappedChoice",
      "confidence",
    ],
    properties: {
      category: {
        type: "string",
        enum: ["price", "no_time", "partner", "already_tried", "unclear_real_chat"],
      },
      mode: {
        type: "string",
        enum: ["mirror", "open_lead", "binary_choice", "structured_choice", "direct_funnel"],
      },
      replyText: {
        type: "string",
      },
      returnToFunnel: {
        type: "boolean",
      },
      targetStep: {
        type: "string",
        enum: [
          "ask_name",
          "intro_ack",
          "parent_context",
          "situation_choice",
          "tried_before_freetext",
          "consequence_freetext",
          "goal_choice",
          "importance_scale",
          "commitment",
          "booking",
          "info_only",
          "done",
        ],
      },
      mappedChoice: {
        anyOf: [{ type: "string" }, { type: "null" }],
      },
      confidence: {
        type: "number",
      },
    },
  };
}

function buildSystemPrompt(params: AiReplyParams): string {
  const framework = AI_OBJECTION_FRAMEWORK[params.category];
  const settings = readSettings();
  const workspaceContext = [
    "Marken-/Mandantenkontext (nur für diese lokale Instanz, noch keine SaaS-Tenant-Trennung):",
    "Firmenname: " + settings.companyName.slice(0, 180),
    "Nische: " + settings.companyNiche.slice(0, 180),
    "Zielgruppe: " + settings.companyAudience.slice(0, 300),
    "Angebotsüberblick (keine Preisquelle): " + settings.companyOfferSummary.slice(0, 450),
    "Name des Assistenten: " + settings.assistantName.slice(0, 80),
    "Markensprache: " + settings.brandVoice.slice(0, 200),
    "Die vom Betreiber angegebenen bis zu drei häufigsten Kundeneinwände (keine verifizierten Fakten über diesen Lead):",
    settings.customerTopObjections || "Keine zusätzlichen Einwände hinterlegt.",
    "Kläre den konkreten Einwand aus der aktuellen Nachricht durch aktives Zuhören und höchstens eine Rückfrage. Die hinterlegten typischen Einwände sind KEINE Vermutung über den einzelnen Lead und dürfen nicht künstlich unterstellt werden.",

    "Sprache: " + settings.defaultLanguage.slice(0, 60),
    "Zusätzlicher vom Betreiber gepflegter Master-Prompt:",
    settings.masterPrompt.slice(0, 8000),
    "VERBINDLICHE GRENZEN: Dieser Zusatzprompt steuert Stil und Kontext, niemals Preise, Verfügbarkeiten, medizinische Aussagen oder Sicherheits- und Stop-Regeln. Nenne selbst keine Euro-Beträge, Rabatte oder Anrechnungsregeln. Konditionen längerer Begleitung sind nicht freigegeben und werden persönlich geklärt. Solche Informationen kommen ausschließlich aus der geprüften Funnel-Engine. Keine gefälschte Identität, keine erfundenen Fakten.",
  ].join("\n");

  return [
    "Du bist die KI-Schicht in einem WhatsApp Funnel für Eltern.",
    "Du bist zu 85% Setter und zu 15% Sales-Agent.",
    "Dein Job ist nicht freies Reden, sondern kurze, menschliche Führung mit sauberer Rückführung in den Funnel.",
    "Arbeite auf Deutsch.",
    workspaceContext,
    "Schreibe kurz, klar, empathisch und führend.",
    "Nicht manipulativ klingen.",
    "Nicht weich werden.",
    "Nicht rechtfertigen.",
    "Nicht lange erklären.",
    "Immer nur so viel antworten, dass der Lead sich gesehen fühlt und sauber weitergeführt werden kann.",
    "Nicht automatisch Multiple-Choice geben. Erst spiegeln, dann führen. Nur wenn sinnvoll strukturieren.",
    `Kategorie: ${framework.category}`,
    `Zweck: ${framework.purpose}`,
    `Kernregel: ${framework.coreRule}`,
    `Erlaubte Modi: ${(params.allowedModes ?? [
      "mirror",
      "open_lead",
      "binary_choice",
      "structured_choice",
      "direct_funnel",
    ]).join(", ")}`,
    `Aktueller Funnel-Step: ${params.currentStep}`,
    `Zielschritt: ${params.nextStep}`,
    `Lead-Name: ${params.leadName ?? "unbekannt"}`,
    params.mustNotAskQuestion
      ? "Wichtig: Stelle in replyText KEINE eigene Frage. Das System hängt direkt danach die nächste Funnel-Frage an."
      : "Du darfst eine kurze passende Frage stellen, wenn sie für die Führung nötig ist.",
    "Antworte ausschließlich als JSON nach Schema.",
  ].join("\n");
}

function buildUserPrompt(params: AiReplyParams): string {
  return [
    `Letzte Nachricht vom Lead: ${params.userMessage}`,
    "",
    "Wähle die passendste Antwortform:",
    "- mirror = nur kurz spiegeln",
    "- open_lead = spiegeln und offen führen",
    "- binary_choice = spiegeln und in 2 Optionen führen",
    "- structured_choice = spiegeln und in klare Struktur/Optionen führen",
    "- direct_funnel = sehr kurze Rückführung ohne viel Einleitung",
    "",
    "Wichtige Regeln:",
    "- Nicht botig.",
    "- Nicht zu lang.",
    "- Kein stumpfer Sales-Pitch.",
    "- Rückführung in den Funnel muss spürbar sein.",
    "- replyText darf maximal 5 Zeilen haben.",
    "- Wenn der Lead etwas Echtes offenlegt, nicht sofort in a/b/c pressen.",
    params.mustNotAskQuestion
      ? "- Keine Frage in replyText. Nur kurz spiegeln/einordnen, damit die nächste Systemfrage direkt anschließen kann."
      : "- Wenn sinnvoll, darfst du mit einer kurzen Frage führen.",
  ].join("\n");
}

async function callStructuredAi(params: AiReplyParams): Promise<AiFunnelReply | null> {
  if (!isAiEnabled() || isUnverifiedLongTermPriceQuestion(params.userMessage)) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApiKey()}`,
      },
      body: JSON.stringify({
        model: getModel(),
        input: [
          {
            role: "system",
            content: buildSystemPrompt(params),
          },
          {
            role: "user",
            content: buildUserPrompt(params),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "ai_funnel_reply",
            strict: true,
            schema: buildSchema(),
          },
        },
      }),
    });

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    const text = extractOutputText(json);

    if (!text) {
      return null;
    }

    const parsed = JSON.parse(text) as AiFunnelReply;

    if (!parsed.replyText?.trim() || containsGeneratedPrice(parsed.replyText)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function generatePriceObjectionReply(params: {
  userMessage: string;
  currentStep: AiReplyParams["currentStep"];
  leadName?: string;
}): Promise<AiFunnelReply | null> {
  return callStructuredAi({
    category: "price",
    userMessage: params.userMessage,
    currentStep: params.currentStep,
    nextStep: "commitment",
    leadName: params.leadName,
    allowedModes: ["open_lead", "binary_choice", "direct_funnel"],
  });
}

export async function generateAlreadyTriedBridgeReply(params: {
  userMessage: string;
  currentStep: AiReplyParams["currentStep"];
  nextStep: AiReplyParams["nextStep"];
  leadName?: string;
}): Promise<AiFunnelReply | null> {
  return callStructuredAi({
    category: "already_tried",
    userMessage: params.userMessage,
    currentStep: params.currentStep,
    nextStep: params.nextStep,
    leadName: params.leadName,
    allowedModes: ["mirror", "direct_funnel"],
    mustNotAskQuestion: true,
  });
}

export async function generateConsequenceBridgeReply(params: {
  userMessage: string;
  currentStep: AiReplyParams["currentStep"];
  nextStep: AiReplyParams["nextStep"];
  leadName?: string;
}): Promise<AiFunnelReply | null> {
  return callStructuredAi({
    category: "unclear_real_chat",
    userMessage: params.userMessage,
    currentStep: params.currentStep,
    nextStep: params.nextStep,
    leadName: params.leadName,
    allowedModes: ["mirror", "direct_funnel"],
    mustNotAskQuestion: true,
  });
}
