import { getCampaignById } from "../config/campaigns.js";
import type { CampaignConfig, FlowStepDefinition, FlowStepId } from "../types/types.js";

export function getFlowSteps(campaignId: string): FlowStepDefinition[] {
  const campaign = getCampaignById(campaignId);
  return campaign.flow;
}

export function getFlowStepById(
  campaignId: string,
  stepId: FlowStepId,
): FlowStepDefinition | undefined {
  const steps = getFlowSteps(campaignId);
  return steps.find((step) => step.id === stepId);
}

export function getFirstFlowStep(campaignId: string): FlowStepDefinition {
  const campaign = getCampaignById(campaignId);
  const firstStep = campaign.flow[0];

  if (!firstStep) {
    throw new Error(`Campaign "${campaign.id}" has no flow steps configured.`);
  }

  return firstStep;
}

export function getNextFlowStep(
  campaignId: string,
  currentStepId: FlowStepId,
): FlowStepDefinition | undefined {
  const steps = getFlowSteps(campaignId);
  const currentIndex = steps.findIndex((step) => step.id === currentStepId);

  if (currentIndex === -1) {
    return undefined;
  }

  return steps[currentIndex + 1];
}

export function getPreviousFlowStep(
  campaignId: string,
  currentStepId: FlowStepId,
): FlowStepDefinition | undefined {
  const steps = getFlowSteps(campaignId);
  const currentIndex = steps.findIndex((step) => step.id === currentStepId);

  if (currentIndex <= 0) {
    return undefined;
  }

  return steps[currentIndex - 1];
}

export function isValidFlowStepId(
  campaignId: string,
  stepId: string,
): stepId is FlowStepId {
  return getFlowSteps(campaignId).some((step) => step.id === stepId);
}

export function isTerminalStep(stepId: FlowStepId): boolean {
  return stepId === "done";
}

export function getFlowOrder(campaignId: string): FlowStepId[] {
  return getFlowSteps(campaignId).map((step) => step.id);
}

export function getCommitmentBranches(): {
  reallyStartStep: FlowStepId;
  infoOnlyStep: FlowStepId;
} {
  return {
    reallyStartStep: "booking",
    infoOnlyStep: "info_only",
  };
}

export function getFallbackFlowStep(campaignId: string): FlowStepDefinition {
  return getFlowStepById(campaignId, "situation_choice") ?? getFirstFlowStep(campaignId);
}

export function getCampaignFlowConfig(campaignId: string): CampaignConfig {
  return getCampaignById(campaignId);
}
