export type PeteQaGrantHold = {
  id: string; micro: number; runId: string; testSet: string;
  ownerGrantId: string; ownerApprovalRef: string; approvalSha256: string;
  sourceSha: string; previousHistorySha256: string; bindingSha256: string;
  status: "reserved";
};
export function getPeteQaRuntimeAuthorization(env: NodeJS.ProcessEnv): PeteQaGrantHold;
export function runPeteQaLedgerCommand(command: string, env?: NodeJS.ProcessEnv, cwd?: string): void;
