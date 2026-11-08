/**
 * Pete Learning Loop v1
 *
 * No model self-training, API calls, real-lead transcripts or automatic
 * production promotion. Only structured synthetic QA outcome labels enter
 * this module. A reviewer must approve a *versioned* general guidance set
 * after independent holdout and safety gates. Prices, links, STOP and actual
 * transactions remain exclusively in the existing trusted engine.
 */
export type PeteLearningCategory =
  | "premature_handoff"
  | "offer_context_drift"
  | "missing_link"
  | "missing_requested_tip"
  | "conversation_repetition"
  | "medical_boundary";

export type PeteSyntheticOutcome = Readonly<{
  caseId: string;
  source: "synthetic";
  category: PeteLearningCategory;
  outcome: "pass" | "fail";
}>;

const LESSONS: Readonly<Record<PeteLearningCategory, string>> = Object.freeze({
  premature_handoff:
    "Eine normale unsichere Aussage ist keine Bitte um menschliche Übernahme. Vor needsHuman=true prüfen, ob tatsächlich eine menschliche Entscheidung benötigt wird. Unbekannte Käufe und Zahlungen niemals bestätigen; eine fehlende Prüfberechtigung ehrlich erklären. Bei echten Streitfällen und expliziter Chat-Übernahme die bestehenden Sicherheitswege nutzen.",
  offer_context_drift:
    "Behalte das zuletzt eindeutig besprochene Angebot in Folgefragen bei. Verwechsle eine kleine persönliche Begleitung niemals mit einem intensiveren Programm. Nur belegte Leistungsdaten verwenden; für verbindliche Beträge und URLs die bestehende verifizierte Anwendung zuständig lassen.",
  missing_link:
    "Wenn nach einem Link gefragt wird, keinen Link vortäuschen oder mit 'hier ist der Link' antworten, ohne dass die verifizierte Anwendung eine echte URL bereitstellt. Keine URLs erfinden.",
  missing_requested_tip:
    "Eine Absage an Kaufangebote ist nicht automatisch eine Absage an hilfreiche Informationen. Bei ausdrücklich erbetenem allgemeinem Tipp genau einen konkreten, unaufdringlichen Schritt nennen, ohne neue Verkaufseinladung.",
  conversation_repetition:
    "Die letzte neue Aussage hat Vorrang. Keine bereits beantwortete Frage erneut stellen und keine Buchungshinweise wiederholen, nachdem der Lead selbst über die Terminwahl entscheiden will. Bei Gesprächsende ohne neue Frage kurz und natürlich abschließen.",
  medical_boundary:
    "Nichtakute Beschwerden sind kein Grund für eine automatische stille Übernahme; erkläre Grenzen ohne Diagnose oder individuelle Übungsfreigabe. Bei Alarmzeichen und echten medizinischen Entscheidungen bestehen die vorhandenen Sicherheitsgrenzen unverändert.",
});

const CATEGORY_SET: ReadonlySet<string> = new Set(Object.keys(LESSONS));
const isCaseId = (s: string): boolean => /^[a-z0-9][a-z0-9_-]{3,63}$/i.test(s);

export type PeteLearningProposal = Readonly<{
  version: "pete-learning-v1";
  status: "proposed";
  categories: readonly PeteLearningCategory[];
  trainingCaseIds: readonly string[];
  failureCount: number;
}>;

export type PeteLearningHoldout = Readonly<{
  caseId: string;
  passed: boolean;
  safetyPassed: boolean;
}>;

export type PeteReviewedLearning = Readonly<{
  version: "pete-learning-v1";
  status: "owner_approved";
  approvedCategories: readonly PeteLearningCategory[];
  trainingCaseIds: readonly string[];
  holdoutCaseIds: readonly string[];
}>;

/** No conversation text, email, lead IDs, names, payment facts or prompts. */
export function proposePeteLearning(
  outcomes: readonly PeteSyntheticOutcome[],
): PeteLearningProposal {
  if (!Array.isArray(outcomes) || outcomes.length > 500) throw Error("Invalid synthetic feedback count");
  const failures = new Map<PeteLearningCategory, Set<string>>();
  const seen = new Set<string>();
  for (const item of outcomes) {
    if (!item || item.source !== "synthetic" || !isCaseId(item.caseId) ||
        !CATEGORY_SET.has(item.category) || !["pass","fail"].includes(item.outcome))
      throw Error("Only structured synthetic QA outcomes may enter Pete learning");
    const dedupe = item.caseId + "|" + item.category;
    if (seen.has(dedupe)) throw Error("Duplicate evidence for learning case");
    seen.add(dedupe);
    if (item.outcome === "fail") {
      const ids = failures.get(item.category) ?? new Set<string>();
      ids.add(item.caseId);
      failures.set(item.category, ids);
    }
  }
  const categories = (Object.keys(LESSONS) as PeteLearningCategory[])
    .filter(category => (failures.get(category)?.size ?? 0) >= 2);
  return Object.freeze({
    version: "pete-learning-v1" as const,
    status: "proposed" as const,
    categories: Object.freeze(categories),
    trainingCaseIds: Object.freeze([...new Set(categories.flatMap(c => [...(failures.get(c) ?? [])]))].sort()),
    failureCount: categories.reduce((n,c) => n + (failures.get(c)?.size ?? 0), 0),
  });
}

/**
 * Manual review gate; holdout results are *provided by an independent test*.
 * This function validates their shape and separation but cannot prove that
 * a real model was evaluated. Review records are NOT provider QA receipts.
 */
export function reviewPeteLearning(
  proposal: PeteLearningProposal,
  evidence: Readonly<{
    reviewer: "owner";
    safetyRegressionPassed: true;
    holdout: readonly PeteLearningHoldout[];
  }>,
): PeteReviewedLearning {
  if (proposal?.version !== "pete-learning-v1" || proposal.status !== "proposed" ||
      !proposal.categories.length || !proposal.categories.every(c => CATEGORY_SET.has(c)))
    throw Error("No valid candidate learning profile");
  if (evidence?.reviewer !== "owner" || evidence.safetyRegressionPassed !== true)
    throw Error("Owner approval and safety regression are required");
  if (!Array.isArray(evidence.holdout) || evidence.holdout.length < 5)
    throw Error("At least five independent holdout cases required");
  const train = new Set(proposal.trainingCaseIds);
  const holdout = new Set<string>();
  for (const item of evidence.holdout) {
    if (!item || !isCaseId(item.caseId) || train.has(item.caseId) ||
        holdout.has(item.caseId) || item.passed !== true || item.safetyPassed !== true)
      throw Error("Independent safety-passing holdout evidence required");
    holdout.add(item.caseId);
  }
  return Object.freeze({
    version: "pete-learning-v1" as const,
    status: "owner_approved" as const,
    approvedCategories: Object.freeze([...proposal.categories]),
    trainingCaseIds: Object.freeze([...train]),
    holdoutCaseIds: Object.freeze([...holdout]),
  });
}

/** Only trusted, fixed general lessons can be emitted, never feedback text. */
export function renderPeteReviewedLearning(profile: PeteReviewedLearning | null): string {
  if (!profile) return "";
  if (profile.version !== "pete-learning-v1" || profile.status !== "owner_approved" ||
      !profile.approvedCategories?.length ||
      !profile.approvedCategories.every(category => CATEGORY_SET.has(category)))
    throw Error("Unapproved Pete learning profile");
  return "\nPETE LERNPROFIL (reviewed v1, nur allgemeine Gesprächsprinzipien; keine Freigabe für Preise, Links oder Versand):\n" +
    profile.approvedCategories.map(category => LESSONS[category]).join("\n");
}
