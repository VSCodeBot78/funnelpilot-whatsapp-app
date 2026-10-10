/**
 * Strict local-only safety profile shared by startup preflight and the
 * continuous webhook ingress gate. No provider access or mutations here.
 */
export function evaluateSafeReadiness(status) {
  const violations = [];
  if (!status || status.ok !== true || status.service !== "funnel-pilot-backend" ||
      status.status !== "ready") {
    return ["Das Backend meldet keine gültige Funnel-Pilot-Readiness."];
  }
  const required = [
    ["nodeEnv", "development"],
    ["localLaptopSafeMode", true],
    ["instagramSendEnabled", false],
    ["whatsappSendEnabled", false],
    ["instagramEngineEnabled", false],
    ["instagramAllowAllSenders", false],
    ["instagramAutoEnableNewLeads", false],
    ["instagramAllowedSenderCount", 0],
    ["genericWebhooksEnabled", false],
    ["destructiveRoutesDisabled", true],
  ];
  for (const [key, expected] of required) {
    if (status[key] !== expected) {
      violations.push(key + " muss " + JSON.stringify(expected) + " sein.");
    }
  }
  return violations;
}
