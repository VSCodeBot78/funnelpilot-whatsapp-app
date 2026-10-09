import crypto from "node:crypto";

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

export function verifyMetaWebhookSignature(params: {
  rawBody?: Buffer;
  signatureHeader?: string;
  appSecret?: string;
}): {
  ok: boolean;
  statusCode: number;
  error?: string;
} {
  const appSecret = normalizeString(params.appSecret);
  if (!appSecret) {
    return {
      ok: false,
      statusCode: 500,
      error: "META_APP_SECRET ist nicht gesetzt. Meta Webhook Signaturprüfung ist erforderlich.",
    };
  }

  const signature = normalizeString(params.signatureHeader);
  if (!signature.startsWith("sha256=")) {
    return {
      ok: false,
      statusCode: 401,
      error: "X-Hub-Signature-256 fehlt oder ist ungültig.",
    };
  }

  const expected = `sha256=${crypto
    .createHmac("sha256", appSecret)
    .update(params.rawBody ?? Buffer.alloc(0))
    .digest("hex")}`;

  const signatureBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return {
      ok: false,
      statusCode: 401,
      error: "Meta Webhook Signaturprüfung fehlgeschlagen.",
    };
  }

  return { ok: true, statusCode: 200 };
}
