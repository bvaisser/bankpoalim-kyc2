// ============================================================
// KYC Rule Engine
// Evaluates answers, computes risk scores, raises flags,
// and produces a binding KYC decision.
// ============================================================

import {
  Customer,
  CustomerRiskProfile,
  KycAnswer,
  KycFlag,
  KycSession,
  RuleResult,
  RiskScore,
  KycDecision,
  RuleEngineResult,
  RiskLevel,
  FlagCode,
  FlagSeverity,
  KycDecisionType,
  QuestionSection,
  SourceOfFunds,
  IncomeRange,
  EmploymentStatus,
  ScoreAdjustment,
} from "../types/kyc.types";

// ─── High-Risk Countries (FATF grey/black + bank policy list) ──
const HIGH_RISK_COUNTRIES = new Set([
  "IR", "KP", "MM", "SY", "YE", "LY", "SO", "SD", "VE",
  "AF", "IQ", "ML", "NI", "PK", "PH", "SS", "TZ", "VU",
]);

// ─── High-Risk Occupations ────────────────────────────────────
const HIGH_RISK_OCCUPATIONS = new Set([
  "POLITICIAN", "GOVERNMENT_OFFICIAL", "JUDGE", "MILITARY_OFFICER",
  "DIPLOMAT", "CENTRAL_BANK_OFFICIAL", "SOE_EXECUTIVE",
  "ARMS_DEALER", "CRYPTOCURRENCY_TRADER",
]);

// ─── Risk Score Thresholds ────────────────────────────────────
const RISK_THRESHOLDS = {
  LOW_MAX: 25,
  MEDIUM_MAX: 55,
  HIGH_MAX: 80,
} as const;

// ─── SLA Hours by Risk Level ─────────────────────────────────
export const SLA_HOURS: Record<RiskLevel, number> = {
  [RiskLevel.LOW]: 48,
  [RiskLevel.MEDIUM]: 24,
  [RiskLevel.HIGH]: 8,
  [RiskLevel.VERY_HIGH]: 4,
};

// ─── Helpers ─────────────────────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function getAnswerValue(answers: KycAnswer[], questionId: string): string | undefined {
  return answers.find((a) => a.questionId === questionId)?.normalizedValue;
}

function getAnswerArray(answers: KycAnswer[], questionId: string): string[] {
  const answer = answers.find((a) => a.questionId === questionId);
  if (!answer) return [];
  const raw = answer.rawValue;
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === "string") return [raw];
  return [];
}

function createFlag(
  sessionId: string,
  customerId: string,
  code: FlagCode,
  severity: FlagSeverity,
  description: string,
  sourceQuestionId?: string,
  sourceAnswerValue?: string,
  ruleId?: string,
): KycFlag {
  return {
    flagId: generateId("FLAG"),
    sessionId,
    customerId,
    code,
    severity,
    description,
    sourceQuestionId,
    sourceAnswerValue,
    ruleId,
    detectedAt: new Date().toISOString(),
  };
}

function ruleResult(
  ruleId: string,
  ruleName: string,
  triggered: boolean,
  scoreImpact = 0,
  output?: string,
  flagCreated?: FlagCode,
): RuleResult {
  return {
    ruleId,
    ruleName,
    triggered,
    output,
    flagCreated,
    scoreImpact,
    evaluatedAt: new Date().toISOString(),
  };
}

// ─── Risk Score Computation ───────────────────────────────────

function computeBaseRiskScore(
  customer: Customer,
  profile: CustomerRiskProfile,
): { base: number; adjustments: ScoreAdjustment[] } {
  const adjustments: ScoreAdjustment[] = [];
  let base = 0;

  // Risk level baseline
  const levelBase: Record<RiskLevel, number> = {
    [RiskLevel.LOW]: 10,
    [RiskLevel.MEDIUM]: 30,
    [RiskLevel.HIGH]: 60,
    [RiskLevel.VERY_HIGH]: 80,
  };
  base = levelBase[customer.riskLevel];

  if (customer.isPep) {
    adjustments.push({ reason: "PEP status", delta: 25, ruleId: "R_PEP_001" });
  }
  if (customer.hasSanctionsFlag) {
    adjustments.push({ reason: "Sanctions match", delta: 30, ruleId: "R_SANC_001" });
  }
  if (customer.hasAdverseMediaFlag) {
    adjustments.push({ reason: "Adverse media", delta: 15, ruleId: "R_MEDIA_001" });
  }
  if (HIGH_RISK_COUNTRIES.has(customer.address.country)) {
    adjustments.push({ reason: "High-risk country of residence", delta: 20, ruleId: "R_GEO_001" });
  }
  if (HIGH_RISK_OCCUPATIONS.has(customer.occupation.toUpperCase())) {
    adjustments.push({ reason: "High-risk occupation", delta: 15, ruleId: "R_OCC_001" });
  }
  if (customer.taxResidencies.some((c) => HIGH_RISK_COUNTRIES.has(c))) {
    adjustments.push({ reason: "Tax residency in high-risk country", delta: 10, ruleId: "R_TAX_001" });
  }

  return { base, adjustments };
}

function deriveRiskLevel(score: number): RiskLevel {
  if (score <= RISK_THRESHOLDS.LOW_MAX) return RiskLevel.LOW;
  if (score <= RISK_THRESHOLDS.MEDIUM_MAX) return RiskLevel.MEDIUM;
  if (score <= RISK_THRESHOLDS.HIGH_MAX) return RiskLevel.HIGH;
  return RiskLevel.VERY_HIGH;
}

// ─── Individual Rule Evaluators ───────────────────────────────

function evaluatePepRule(
  answers: KycAnswer[],
  session: KycSession,
  customer: Customer,
  flags: KycFlag[],
  results: RuleResult[],
  scoreAdj: ScoreAdjustment[],
): void {
  const pepAnswer = getAnswerValue(answers, "Q_PEP_STATUS");

  if (pepAnswer === "YES" || customer.isPep) {
    flags.push(
      createFlag(
        session.sessionId,
        customer.customerId,
        FlagCode.PEP_DECLARED,
        FlagSeverity.HARD,
        "Customer declared PEP status or existing PEP flag is active",
        "Q_PEP_STATUS",
        pepAnswer,
        "R_PEP_001",
      ),
    );
    scoreAdj.push({ reason: "PEP declared in session", delta: 25, ruleId: "R_PEP_001" });
    results.push(ruleResult("R_PEP_001", "PEP Declaration Rule", true, 25, "Hard flag: PEP", FlagCode.PEP_DECLARED));
  } else {
    results.push(ruleResult("R_PEP_001", "PEP Declaration Rule", false));
  }
}

function evaluateHighRiskCountryRule(
  answers: KycAnswer[],
  session: KycSession,
  customer: Customer,
  flags: KycFlag[],
  results: RuleResult[],
  scoreAdj: ScoreAdjustment[],
): void {
  const countries = getAnswerArray(answers, "Q_COUNTRY_EXPOSURE");
  const highRisk = countries.filter((c) => HIGH_RISK_COUNTRIES.has(c));

  if (highRisk.length > 0 || HIGH_RISK_COUNTRIES.has(customer.address.country)) {
    flags.push(
      createFlag(
        session.sessionId,
        customer.customerId,
        FlagCode.HIGH_RISK_COUNTRY,
        FlagSeverity.HARD,
        `Exposure to high-risk countries: ${[...highRisk, customer.address.country].join(", ")}`,
        "Q_COUNTRY_EXPOSURE",
        highRisk.join(","),
        "R_GEO_002",
      ),
    );
    scoreAdj.push({ reason: "High-risk country exposure declared", delta: 20, ruleId: "R_GEO_002" });
    results.push(ruleResult("R_GEO_002", "High-Risk Country Exposure Rule", true, 20, undefined, FlagCode.HIGH_RISK_COUNTRY));
  } else {
    results.push(ruleResult("R_GEO_002", "High-Risk Country Exposure Rule", false));
  }
}

function evaluateSourceOfFundsRule(
  answers: KycAnswer[],
  session: KycSession,
  customer: Customer,
  flags: KycFlag[],
  results: RuleResult[],
  scoreAdj: ScoreAdjustment[],
): void {
  const sof = getAnswerValue(answers, "Q_SOURCE_OF_FUNDS");

  if (sof === "OTHER" || sof === undefined) {
    flags.push(
      createFlag(
        session.sessionId,
        customer.customerId,
        FlagCode.UNKNOWN_SOURCE_OF_FUNDS,
        FlagSeverity.HARD,
        'Source of funds declared as "Other" or not provided',
        "Q_SOURCE_OF_FUNDS",
        sof,
        "R_SOF_001",
      ),
    );
    scoreAdj.push({ reason: "Unknown/undeclared source of funds", delta: 20, ruleId: "R_SOF_001" });
    results.push(ruleResult("R_SOF_001", "Source of Funds Rule", true, 20, undefined, FlagCode.UNKNOWN_SOURCE_OF_FUNDS));
  } else {
    results.push(ruleResult("R_SOF_001", "Source of Funds Rule", false));
  }
}

function evaluateIncomeActivityMismatchRule(
  answers: KycAnswer[],
  session: KycSession,
  customer: Customer,
  flags: KycFlag[],
  results: RuleResult[],
  scoreAdj: ScoreAdjustment[],
): void {
  const incomeAnswer = getAnswerValue(answers, "Q_MONTHLY_INCOME");
  const activityAnswer = getAnswerValue(answers, "Q_EXPECTED_MONTHLY_ACTIVITY");

  const incomeOrder: Record<string, number> = {
    [IncomeRange.UNDER_5K]: 1,
    [IncomeRange.FROM_5K_TO_15K]: 2,
    [IncomeRange.FROM_15K_TO_30K]: 3,
    [IncomeRange.FROM_30K_TO_50K]: 4,
    [IncomeRange.ABOVE_50K]: 5,
  };

  if (incomeAnswer && activityAnswer) {
    const incomeRank = incomeOrder[incomeAnswer] ?? 0;
    const activityRank = incomeOrder[activityAnswer] ?? 0;
    const gap = activityRank - incomeRank;

    if (gap >= 2) {
      flags.push(
        createFlag(
          session.sessionId,
          customer.customerId,
          FlagCode.INCOME_ACTIVITY_MISMATCH_MATERIAL,
          FlagSeverity.HARD,
          `Declared activity (${activityAnswer}) materially exceeds income (${incomeAnswer})`,
          "Q_EXPECTED_MONTHLY_ACTIVITY",
          activityAnswer,
          "R_MISMATCH_001",
        ),
      );
      scoreAdj.push({ reason: "Material income/activity mismatch", delta: 25, ruleId: "R_MISMATCH_001" });
      results.push(ruleResult("R_MISMATCH_001", "Income/Activity Mismatch Rule", true, 25, "Material mismatch", FlagCode.INCOME_ACTIVITY_MISMATCH_MATERIAL));
    } else if (gap === 1) {
      flags.push(
        createFlag(
          session.sessionId,
          customer.customerId,
          FlagCode.INCOME_ACTIVITY_MISMATCH_MINOR,
          FlagSeverity.SOFT,
          `Declared activity slightly exceeds income range`,
          "Q_EXPECTED_MONTHLY_ACTIVITY",
          activityAnswer,
          "R_MISMATCH_002",
        ),
      );
      scoreAdj.push({ reason: "Minor income/activity mismatch", delta: 8, ruleId: "R_MISMATCH_002" });
      results.push(ruleResult("R_MISMATCH_002", "Income/Activity Minor Mismatch Rule", true, 8, "Minor mismatch", FlagCode.INCOME_ACTIVITY_MISMATCH_MINOR));
    } else {
      results.push(ruleResult("R_MISMATCH_001", "Income/Activity Mismatch Rule", false));
    }
  }
}

function evaluateFatcaCrsRule(
  answers: KycAnswer[],
  session: KycSession,
  customer: Customer,
  flags: KycFlag[],
  results: RuleResult[],
  scoreAdj: ScoreAdjustment[],
): void {
  const taxResident = getAnswerValue(answers, "Q_FOREIGN_TAX_RESIDENCY");
  const fatcaDecl = getAnswerValue(answers, "Q_FATCA_DECLARATION");
  const crsDecl = getAnswerValue(answers, "Q_CRS_DECLARATION");

  if (taxResident === "YES" && fatcaDecl !== "CONFIRMED" && crsDecl !== "CONFIRMED") {
    flags.push(
      createFlag(
        session.sessionId,
        customer.customerId,
        FlagCode.CONFLICTING_FATCA_CRS,
        FlagSeverity.HARD,
        "Customer declared foreign tax residency but FATCA/CRS declaration not confirmed",
        "Q_FATCA_DECLARATION",
        fatcaDecl,
        "R_FATCA_001",
      ),
    );
    scoreAdj.push({ reason: "Conflicting FATCA/CRS declaration", delta: 15, ruleId: "R_FATCA_001" });
    results.push(ruleResult("R_FATCA_001", "FATCA/CRS Conflict Rule", true, 15, undefined, FlagCode.CONFLICTING_FATCA_CRS));
  } else if (taxResident === "YES") {
    flags.push(
      createFlag(
        session.sessionId,
        customer.customerId,
        FlagCode.FOREIGN_TAX_RESIDENCY_DECLARED,
        FlagSeverity.SOFT,
        "Foreign tax residency declared – FATCA/CRS confirmed",
        "Q_FOREIGN_TAX_RESIDENCY",
        taxResident,
        "R_FATCA_002",
      ),
    );
    scoreAdj.push({ reason: "Foreign tax residency (soft)", delta: 5, ruleId: "R_FATCA_002" });
    results.push(ruleResult("R_FATCA_002", "Foreign Tax Residency Soft Rule", true, 5, undefined, FlagCode.FOREIGN_TAX_RESIDENCY_DECLARED));
  } else {
    results.push(ruleResult("R_FATCA_001", "FATCA/CRS Conflict Rule", false));
  }
}

function evaluateEmploymentChangeRule(
  answers: KycAnswer[],
  session: KycSession,
  customer: Customer,
  flags: KycFlag[],
  results: RuleResult[],
  scoreAdj: ScoreAdjustment[],
): void {
  const empChanged = getAnswerValue(answers, "Q_EMPLOYMENT_CHANGED");

  if (empChanged === "YES") {
    flags.push(
      createFlag(
        session.sessionId,
        customer.customerId,
        FlagCode.EMPLOYMENT_CHANGED,
        FlagSeverity.SOFT,
        "Customer reported employment status change",
        "Q_EMPLOYMENT_CHANGED",
        empChanged,
        "R_EMP_001",
      ),
    );
    scoreAdj.push({ reason: "Employment change declared", delta: 5, ruleId: "R_EMP_001" });
    results.push(ruleResult("R_EMP_001", "Employment Change Rule", true, 5, undefined, FlagCode.EMPLOYMENT_CHANGED));
  } else {
    results.push(ruleResult("R_EMP_001", "Employment Change Rule", false));
  }
}

function evaluateSanctionsRule(
  customer: Customer,
  session: KycSession,
  flags: KycFlag[],
  results: RuleResult[],
  scoreAdj: ScoreAdjustment[],
): void {
  if (customer.hasSanctionsFlag) {
    flags.push(
      createFlag(
        session.sessionId,
        customer.customerId,
        FlagCode.SANCTIONS_MATCH,
        FlagSeverity.HARD,
        "Active sanctions match detected from screening system",
        undefined,
        undefined,
        "R_SANC_001",
      ),
    );
    scoreAdj.push({ reason: "Sanctions match", delta: 35, ruleId: "R_SANC_001" });
    results.push(ruleResult("R_SANC_001", "Sanctions Match Rule", true, 35, undefined, FlagCode.SANCTIONS_MATCH));
  } else {
    results.push(ruleResult("R_SANC_001", "Sanctions Match Rule", false));
  }
}

function evaluateInternationalActivityRule(
  answers: KycAnswer[],
  session: KycSession,
  customer: Customer,
  flags: KycFlag[],
  results: RuleResult[],
  scoreAdj: ScoreAdjustment[],
): void {
  const intlActivity = getAnswerValue(answers, "Q_INTERNATIONAL_ACTIVITY");

  if (intlActivity === "YES") {
    flags.push(
      createFlag(
        session.sessionId,
        customer.customerId,
        FlagCode.INTERNATIONAL_ACTIVITY_NEW,
        FlagSeverity.SOFT,
        "Customer declared new or ongoing international transaction activity",
        "Q_INTERNATIONAL_ACTIVITY",
        intlActivity,
        "R_INTL_001",
      ),
    );
    scoreAdj.push({ reason: "International activity declared", delta: 5, ruleId: "R_INTL_001" });
    results.push(ruleResult("R_INTL_001", "International Activity Rule", true, 5, undefined, FlagCode.INTERNATIONAL_ACTIVITY_NEW));
  } else {
    results.push(ruleResult("R_INTL_001", "International Activity Rule", false));
  }
}

// ─── Decision Engine ──────────────────────────────────────────

function computeDecision(
  session: KycSession,
  customer: Customer,
  flags: KycFlag[],
  finalScore: number,
  riskLevel: RiskLevel,
): KycDecision {
  const hardFlags = flags.filter((f) => f.severity === FlagSeverity.HARD);
  const softFlags = flags.filter((f) => f.severity === FlagSeverity.SOFT);
  const hardFlagCodes = hardFlags.map((f) => f.code);
  const softFlagCodes = softFlags.map((f) => f.code);

  let decisionType: KycDecisionType;
  let rationale: string;
  let requiresDocumentUpload = false;
  let documentTypes: string[] | undefined;

  if (customer.hasSanctionsFlag || hardFlagCodes.includes(FlagCode.SANCTIONS_MATCH)) {
    decisionType = KycDecisionType.REJECT_OR_RESTRICT;
    rationale = "Sanctions match detected. Account must be reviewed for immediate restriction.";
    requiresDocumentUpload = false;
  } else if (hardFlags.length > 0) {
    decisionType = KycDecisionType.FULL_COMPLIANCE_REVIEW;
    rationale = `Hard flags detected: ${hardFlagCodes.join(", ")}. Full compliance review required.`;
    requiresDocumentUpload = riskLevel === RiskLevel.HIGH || riskLevel === RiskLevel.VERY_HIGH;
    if (requiresDocumentUpload) {
      documentTypes = ["INCOME_PROOF", "SOURCE_OF_FUNDS_EVIDENCE", "ID_DOCUMENT"];
    }
  } else if (softFlags.length >= 2 || (softFlags.length >= 1 && riskLevel === RiskLevel.MEDIUM)) {
    decisionType = KycDecisionType.LIGHT_REVIEW;
    rationale = `Soft flags present: ${softFlagCodes.join(", ")}. Light sampling review triggered.`;
  } else if (
    riskLevel === RiskLevel.LOW &&
    hardFlags.length === 0 &&
    softFlags.length <= 1 &&
    finalScore <= RISK_THRESHOLDS.LOW_MAX
  ) {
    decisionType = KycDecisionType.AUTO_COMPLETE;
    rationale = "Low risk, no hard flags, minimal soft flags. Auto-completed successfully.";
  } else if (riskLevel === RiskLevel.MEDIUM && hardFlags.length === 0 && softFlags.length === 0) {
    decisionType = KycDecisionType.AUTO_COMPLETE;
    rationale = "Medium risk with no flags and clean answers. Auto-completed.";
  } else {
    decisionType = KycDecisionType.LIGHT_REVIEW;
    rationale = "Risk profile requires sampling review before auto-completion.";
  }

  return {
    decisionId: generateId("DEC"),
    sessionId: session.sessionId,
    customerId: customer.customerId,
    type: decisionType,
    rationale,
    hardFlagsPresent: hardFlagCodes,
    softFlagsPresent: softFlagCodes,
    riskScore: finalScore,
    automatedDecision: true,
    decidedAt: new Date().toISOString(),
    effectiveUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    requiresDocumentUpload,
    documentTypes,
  };
}

// ─── Public API ───────────────────────────────────────────────

export function evaluateKycSession(
  customer: Customer,
  session: KycSession,
  answers: KycAnswer[],
  profile: CustomerRiskProfile,
): RuleEngineResult {
  const flags: KycFlag[] = [];
  const results: RuleResult[] = [];
  const scoreAdjustments: ScoreAdjustment[] = [];

  const { base, adjustments: baseAdj } = computeBaseRiskScore(customer, profile);
  scoreAdjustments.push(...baseAdj);

  // Evaluate each rule
  evaluateSanctionsRule(customer, session, flags, results, scoreAdjustments);
  evaluatePepRule(answers, session, customer, flags, results, scoreAdjustments);
  evaluateHighRiskCountryRule(answers, session, customer, flags, results, scoreAdjustments);
  evaluateSourceOfFundsRule(answers, session, customer, flags, results, scoreAdjustments);
  evaluateIncomeActivityMismatchRule(answers, session, customer, flags, results, scoreAdjustments);
  evaluateFatcaCrsRule(answers, session, customer, flags, results, scoreAdjustments);
  evaluateEmploymentChangeRule(answers, session, customer, flags, results, scoreAdjustments);
  evaluateInternationalActivityRule(answers, session, customer, flags, results, scoreAdjustments);

  const totalDelta = scoreAdjustments.reduce((sum, a) => sum + a.delta, 0);
  const finalScore = Math.min(100, base + totalDelta);
  const riskLevel = deriveRiskLevel(finalScore);

  const riskScore: RiskScore = {
    customerId: customer.customerId,
    sessionId: session.sessionId,
    baseScore: base,
    adjustments: scoreAdjustments,
    finalScore,
    riskLevel,
    calculatedAt: new Date().toISOString(),
  };

  const decision = computeDecision(session, customer, flags, finalScore, riskLevel);

  return {
    sessionId: session.sessionId,
    customerId: customer.customerId,
    ruleResults: results,
    flags,
    riskScore,
    decision,
    evaluatedAt: new Date().toISOString(),
  };
}

// ─── Convenience exports for unit testing individual rules ───

export const _internal = {
  HIGH_RISK_COUNTRIES,
  HIGH_RISK_OCCUPATIONS,
  RISK_THRESHOLDS,
  computeBaseRiskScore,
  deriveRiskLevel,
  computeDecision,
};
