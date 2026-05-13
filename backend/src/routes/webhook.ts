import { Router, type NextFunction, type Request, type Response } from "express";
import { env } from "../config/env.js";
import { getCampaignById } from "../config/campaigns.js";
import { processIncomingMessage } from "../core/conversation-engine.js";
import {
  appendAssistantMessage,
  getOrCreateConversationState,
  patchAnswers,
  patchFlags,
  persistConversationState,
  setCurrentStep,
} from "../core/state-manager.js";
import { mapIncomingMessagePayload } from "../services/message-mapper.service.js";
import { processCalendlyWebhook } from "../services/calendly-webhook.service.js";
import type {
  CheckoutWebhookPayload,
  CheckoutWebhookResponse,
  IncomingMessagePayload,
  IncomingMessageResponse,
} from "../types/types.js";

const router = Router();

function genericWebhookGuard(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (env.NODE_ENV === "production" && !env.ENABLE_GENERIC_WEBHOOKS) {
    res.status(404).json({
      ok: false,
      error: "generic_webhook_disabled",
      message:
        "Generische Test-/Integrations-Webhooks sind in production standardmäßig deaktiviert.",
    });
    return;
  }

  next();
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isSuccessfulCheckout(payload: CheckoutWebhookPayload): boolean {
  const event = normalizeText(payload.event);
  const status = normalizeText(payload.status);
  const paymentStatus = normalizeText(payload.paymentStatus);
  const orderStatus = normalizeText(payload.orderStatus);

  const successValues = ["paid", "success", "succeeded", "completed", "complete"];
  const successEvents = [
    "checkout.completed",
    "purchase.completed",
    "payment.paid",
    "order.paid",
    "checkout.paid",
  ];

  return (
    successValues.includes(status) ||
    successValues.includes(paymentStatus) ||
    successValues.includes(orderStatus) ||
    successEvents.includes(event)
  );
}

function buildStarterPurchaseSuccessReply(params: {
  campaignId: string;
  onboardingBookingUrl?: string;
  successReply?: string;
}): string {
  const campaign = getCampaignById(params.campaignId);
  const onboardingUrl =
    params.onboardingBookingUrl?.trim() ||
    campaign.texts.onboardingBookingUrl;

  const template =
    params.successReply?.trim() ||
    campaign.texts.starterPurchaseSuccessReply;

  return template.replace("[ONBOARDING_LINK]", onboardingUrl);
}

/**
 * Produktnäherer Incoming-Endpoint.
 * Noch kein echter Meta-Webhook, aber vorbereitet für externe Systeme.
 *
 * Erlaubte Payload-Felder u. a.:
 * - leadId
 * - phone / from
 * - contactId
 * - campaignId
 * - trigger
 * - messageText / message / text
 * - source / channel / provider
 */
router.post("/", genericWebhookGuard, async (req, res) => {
  try {
    const payload = req.body as IncomingMessagePayload;
    const mapped = mapIncomingMessagePayload(payload);

    const result = await processIncomingMessage({
      leadId: mapped.leadId,
      campaignId: mapped.campaignId,
      messageText: mapped.messageText,
    });

    const response: IncomingMessageResponse = {
      ok: true,
      reply: result.text,
      nextStep: result.nextStep,
      detectedIntent: result.detectedIntent,
      leadId: mapped.leadId,
      campaignId: mapped.campaignId,
      source: mapped.source,
    };

    return res.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler im Webhook.";

    const response: IncomingMessageResponse = {
      ok: false,
      error: message,
    };

    return res.status(400).json(response);
  }
});

/**
 * Alias für produktnähere Struktur
 * z. B. für spätere Systemanbindung / Integrationen.
 */
router.post("/message", genericWebhookGuard, async (req, res) => {
  try {
    const payload = req.body as IncomingMessagePayload;
    const mapped = mapIncomingMessagePayload(payload);

    const result = await processIncomingMessage({
      leadId: mapped.leadId,
      campaignId: mapped.campaignId,
      messageText: mapped.messageText,
    });

    const response: IncomingMessageResponse = {
      ok: true,
      reply: result.text,
      nextStep: result.nextStep,
      detectedIntent: result.detectedIntent,
      leadId: mapped.leadId,
      campaignId: mapped.campaignId,
      source: mapped.source,
    };

    return res.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler im Webhook /message.";

    const response: IncomingMessageResponse = {
      ok: false,
      error: message,
    };

    return res.status(400).json(response);
  }
});

/**
 * Noch klarerer Incoming-Pfad für spätere externe Integrationen.
 */
router.post("/messages/incoming", genericWebhookGuard, async (req, res) => {
  try {
    const payload = req.body as IncomingMessagePayload;
    const mapped = mapIncomingMessagePayload(payload);

    const result = await processIncomingMessage({
      leadId: mapped.leadId,
      campaignId: mapped.campaignId,
      messageText: mapped.messageText,
    });

    const response: IncomingMessageResponse = {
      ok: true,
      reply: result.text,
      nextStep: result.nextStep,
      detectedIntent: result.detectedIntent,
      leadId: mapped.leadId,
      campaignId: mapped.campaignId,
      source: mapped.source,
    };

    return res.json(response);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unbekannter Fehler im Webhook /messages/incoming.";

    const response: IncomingMessageResponse = {
      ok: false,
      error: message,
    };

    return res.status(400).json(response);
  }
});

/**
 * Checkout Webhook Phase A
 * Erwartet vorerst mindestens:
 * - leadId
 * - campaignId
 * - event oder status/paymentStatus/orderStatus
 *
 * Beispiel:
 * {
 *   "leadId": "lead-123",
 *   "campaignId": "eltern-vital-fit",
 *   "event": "checkout.completed",
 *   "paymentStatus": "paid",
 *   "checkoutId": "co_123",
 *   "productId": "starter_499"
 * }
 */
router.post("/checkout", genericWebhookGuard, (req, res) => {
  try {
    const payload = req.body as CheckoutWebhookPayload;

    if (!payload.leadId || !payload.campaignId) {
      const response: CheckoutWebhookResponse = {
        ok: false,
        error: "leadId und campaignId sind erforderlich.",
      };

      return res.status(400).json(response);
    }

    if (!isSuccessfulCheckout(payload)) {
      const response: CheckoutWebhookResponse = {
        ok: false,
        leadId: payload.leadId,
        campaignId: payload.campaignId,
        status: "ignored",
        error: "Kein erfolgreicher Checkout-Status erkannt.",
      };

      return res.status(400).json(response);
    }

    const state = getOrCreateConversationState(payload.leadId, payload.campaignId);
    const campaign = getCampaignById(payload.campaignId);

    if (state.answers.starterPurchaseStatus === "paid") {
      const response: CheckoutWebhookResponse = {
        ok: true,
        duplicated: true,
        leadId: payload.leadId,
        campaignId: payload.campaignId,
        status: "already_paid",
        message: "Checkout war bereits als bezahlt markiert.",
      };

      return res.json(response);
    }

    const now = new Date().toISOString();
    const onboardingBookingUrl =
      payload.onboardingBookingUrl?.trim() ||
      campaign.texts.onboardingBookingUrl;

    patchAnswers(state, {
      starterPurchaseStatus: "paid",
      starterPurchasedAt: now,
      starterCheckoutSessionId: payload.checkoutId?.trim(),
      starterProductId: payload.productId?.trim(),
      onboardingBookingUrl,
      onboardingPromptSentAt: now,
    });

    patchFlags(state, {
      wantsDirectBuyStarter: true,
    });

    setCurrentStep(state, "done");

    const replyText = buildStarterPurchaseSuccessReply({
      campaignId: payload.campaignId,
      onboardingBookingUrl,
      successReply: payload.successReply,
    });

    appendAssistantMessage(state, replyText);
    persistConversationState(state);

    const response: CheckoutWebhookResponse = {
      ok: true,
      leadId: payload.leadId,
      campaignId: payload.campaignId,
      status: "paid",
      reply: replyText,
      message: "Checkout erfolgreich verarbeitet und Onboarding-Nachricht vorbereitet.",
    };

    return res.json(response);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unbekannter Fehler im Checkout-Webhook.";

    const response: CheckoutWebhookResponse = {
      ok: false,
      error: message,
    };

    return res.status(500).json(response);
  }
});

/**
 * Calendly Webhook Phase B
 * Nutzt tracking.utm_content als leadId und tracking.utm_campaign als campaignId.
 */
router.post("/calendly", (req, res) => {
  try {
    const result = processCalendlyWebhook(req.body);

    if (!result.ok) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler im Calendly-Webhook.";

    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

export default router;
