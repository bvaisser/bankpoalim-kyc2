// ============================================================
// KYC Questionnaire Builder
// Dynamically generates a minimal, ordered question set
// based on risk level, trigger type, and existing profile data.
// ============================================================

import {
  Customer,
  KycQuestion,
  KycTriggerType,
  RiskLevel,
  QuestionSection,
  QuestionType,
  EmploymentStatus,
} from "../types/kyc.types";

// ─── Master Question Bank ─────────────────────────────────────

const QUESTION_BANK: KycQuestion[] = [
  // ── Identity confirmation ──────────────────────────────────
  {
    questionId: "Q_NO_CHANGES",
    section: QuestionSection.IDENTITY_CONFIRMATION,
    type: QuestionType.YES_NO,
    text: "Has any of your personal or financial information changed since your last update?",
    helpText: "Select 'No' only if your employment, income, address, and activity remain exactly the same.",
    isRequired: true,
    isMandatory: false,
    options: [
      { value: "YES", label: "Yes, something has changed" },
      { value: "NO", label: "No, everything is the same" },
    ],
    riskWeight: 0,
    applicableRiskLevels: [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.VERY_HIGH],
    order: 1,
    skipIfAnswerExists: false,
  },
  // ── Employment ────────────────────────────────────────────
  {
    questionId: "Q_EMPLOYMENT_STATUS",
    section: QuestionSection.EMPLOYMENT,
    type: QuestionType.SINGLE_CHOICE,
    text: "What is your current employment status?",
    isRequired: true,
    isMandatory: true,
    options: [
      { value: "EMPLOYED", label: "Employed (for an employer)" },
      { value: "SELF_EMPLOYED", label: "Self-employed / Freelancer" },
      { value: "BUSINESS_OWNER", label: "Business owner", isHighRisk: false },
      { value: "RETIRED", label: "Retired" },
      { value: "STUDENT", label: "Student" },
      { value: "UNEMPLOYED", label: "Unemployed" },
      { value: "OTHER", label: "Other" },
    ],
    riskWeight: 5,
    applicableRiskLevels: [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.VERY_HIGH],
    order: 2,
    skipIfAnswerExists: true,
    existingAnswerField: "employmentStatus",
  },
  {
    questionId: "Q_EMPLOYMENT_CHANGED",
    section: QuestionSection.EMPLOYMENT,
    type: QuestionType.YES_NO,
    text: "Has your employment status or employer changed in the past 12 months?",
    isRequired: false,
    isMandatory: false,
    options: [
      { value: "YES", label: "Yes" },
      { value: "NO", label: "No" },
    ],
    riskWeight: 3,
    applicableRiskLevels: [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.VERY_HIGH],
    order: 3,
    skipIfAnswerExists: false,
  },
  // ── Income ────────────────────────────────────────────────
  {
    questionId: "Q_MONTHLY_INCOME",
    section: QuestionSection.INCOME,
    type: QuestionType.NUMERIC_RANGE,
    text: "What is your approximate monthly income (in NIS)?",
    isRequired: true,
    isMandatory: true,
    options: [
      { value: "UNDER_5K", label: "Up to ₪5,000" },
      { value: "FROM_5K_TO_15K", label: "₪5,001 – ₪15,000" },
      { value: "FROM_15K_TO_30K", label: "₪15,001 – ₪30,000" },
      { value: "FROM_30K_TO_50K", label: "₪30,001 – ₪50,000" },
      { value: "ABOVE_50K", label: "Above ₪50,000" },
    ],
    riskWeight: 8,
    applicableRiskLevels: [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.VERY_HIGH],
    order: 4,
    skipIfAnswerExists: false,
  },
  {
    questionId: "Q_SOURCE_OF_INCOME",
    section: QuestionSection.INCOME,
    type: QuestionType.SINGLE_CHOICE,
    text: "What is your primary source of income?",
    isRequired: true,
    isMandatory: true,
    options: [
      { value: "SALARY", label: "Salary from employment" },
      { value: "BUSINESS_INCOME", label: "Business income" },
      { value: "INVESTMENT_RETURNS", label: "Investment returns / dividends" },
      { value: "PENSION", label: "Pension" },
      { value: "RENTAL_INCOME", label: "Rental income" },
      { value: "FAMILY_SUPPORT", label: "Family support" },
      { value: "OTHER", label: "Other" },
    ],
    riskWeight: 10,
    applicableRiskLevels: [RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.VERY_HIGH],
    order: 5,
    skipIfAnswerExists: false,
  },
  // ── Source of Funds ────────────────────────────────────────
  {
    questionId: "Q_SOURCE_OF_FUNDS",
    section: QuestionSection.SOURCE_OF_FUNDS,
    type: QuestionType.SINGLE_CHOICE,
    text: "What is the primary source of funds deposited or transferred through your account?",
    isRequired: true,
    isMandatory: true,
    options: [
      { value: "SALARY", label: "Salary" },
      { value: "BUSINESS_INCOME", label: "Business income" },
      { value: "INVESTMENT_RETURNS", label: "Investment returns" },
      { value: "PENSION", label: "Pension or social benefits" },
      { value: "INHERITANCE", label: "Inheritance" },
      { value: "REAL_ESTATE", label: "Real estate sale proceeds" },
      { value: "LOAN", label: "Loan proceeds" },
      { value: "GIFT", label: "Gift from family" },
      { value: "OTHER", label: "Other – please describe", isHighRisk: true },
    ],
    riskWeight: 15,
    applicableRiskLevels: [RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.VERY_HIGH],
    order: 6,
    skipIfAnswerExists: false,
  },
  {
    questionId: "Q_SOURCE_OF_WEALTH",
    section: QuestionSection.SOURCE_OF_WEALTH,
    type: QuestionType.MULTI_CHOICE,
    text: "How did you accumulate your overall wealth? (Select all that apply)",
    isRequired: true,
    isMandatory: true,
    options: [
      { value: "CAREER_SAVINGS", label: "Career savings" },
      { value: "BUSINESS_PROFITS", label: "Business profits" },
      { value: "INVESTMENTS", label: "Long-term investments" },
      { value: "REAL_ESTATE", label: "Real estate" },
      { value: "INHERITANCE", label: "Inheritance or gift" },
      { value: "OTHER", label: "Other", isHighRisk: true },
    ],
    riskWeight: 12,
    applicableRiskLevels: [RiskLevel.HIGH, RiskLevel.VERY_HIGH],
    order: 7,
    skipIfAnswerExists: false,
  },
  // ── Activity Expectations ─────────────────────────────────
  {
    questionId: "Q_EXPECTED_MONTHLY_ACTIVITY",
    section: QuestionSection.ACTIVITY_EXPECTATIONS,
    type: QuestionType.NUMERIC_RANGE,
    text: "What is your expected total monthly account activity (deposits + withdrawals)?",
    isRequired: true,
    isMandatory: true,
    options: [
      { value: "UNDER_5K", label: "Up to ₪5,000" },
      { value: "FROM_5K_TO_15K", label: "₪5,001 – ₪15,000" },
      { value: "FROM_15K_TO_30K", label: "₪15,001 – ₪30,000" },
      { value: "FROM_30K_TO_50K", label: "₪30,001 – ₪50,000" },
      { value: "ABOVE_50K", label: "Above ₪50,000" },
    ],
    riskWeight: 12,
    applicableRiskLevels: [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.VERY_HIGH],
    order: 8,
    skipIfAnswerExists: false,
  },
  {
    questionId: "Q_CASH_ACTIVITY",
    section: QuestionSection.ACTIVITY_EXPECTATIONS,
    type: QuestionType.SINGLE_CHOICE,
    text: "How often do you expect to conduct cash transactions (deposits or withdrawals)?",
    isRequired: false,
    isMandatory: false,
    options: [
      { value: "NEVER", label: "Never" },
      { value: "RARELY", label: "Rarely (a few times a year)" },
      { value: "MONTHLY", label: "Monthly" },
      { value: "WEEKLY", label: "Weekly or more", isHighRisk: true },
    ],
    riskWeight: 8,
    applicableRiskLevels: [RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.VERY_HIGH],
    order: 9,
    skipIfAnswerExists: false,
  },
  // ── International Activity ────────────────────────────────
  {
    questionId: "Q_INTERNATIONAL_ACTIVITY",
    section: QuestionSection.INTERNATIONAL_ACTIVITY,
    type: QuestionType.YES_NO,
    text: "Do you expect to conduct international transfers (sending or receiving from abroad)?",
    isRequired: true,
    isMandatory: false,
    options: [
      { value: "YES", label: "Yes" },
      { value: "NO", label: "No" },
    ],
    riskWeight: 10,
    applicableRiskLevels: [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.VERY_HIGH],
    order: 10,
    skipIfAnswerExists: false,
  },
  {
    questionId: "Q_COUNTRY_EXPOSURE",
    section: QuestionSection.INTERNATIONAL_ACTIVITY,
    type: QuestionType.COUNTRY_SELECT,
    text: "Which countries are you transferring funds to or from?",
    helpText: "Select all countries involved in your international transactions.",
    isRequired: false,
    isMandatory: false,
    displayConditions: [
      { questionId: "Q_INTERNATIONAL_ACTIVITY", operator: "equals", value: "YES" },
    ],
    riskWeight: 15,
    applicableRiskLevels: [RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.VERY_HIGH],
    order: 11,
    skipIfAnswerExists: false,
  },
  {
    questionId: "Q_TRANSFER_PURPOSE",
    section: QuestionSection.INTERNATIONAL_ACTIVITY,
    type: QuestionType.SINGLE_CHOICE,
    text: "What is the primary purpose of your international transfers?",
    isRequired: false,
    isMandatory: false,
    displayConditions: [
      { questionId: "Q_INTERNATIONAL_ACTIVITY", operator: "equals", value: "YES" },
    ],
    options: [
      { value: "FAMILY_SUPPORT", label: "Family support" },
      { value: "BUSINESS_PAYMENT", label: "Business payments" },
      { value: "PROPERTY_PURCHASE", label: "Property purchase" },
      { value: "EDUCATION", label: "Education expenses" },
      { value: "INVESTMENT", label: "Investment" },
      { value: "OTHER", label: "Other", isHighRisk: true },
    ],
    riskWeight: 8,
    applicableRiskLevels: [RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.VERY_HIGH],
    order: 12,
    skipIfAnswerExists: false,
  },
  // ── Tax Residency / FATCA / CRS ────────────────────────────
  {
    questionId: "Q_FOREIGN_TAX_RESIDENCY",
    section: QuestionSection.TAX_RESIDENCY,
    type: QuestionType.YES_NO,
    text: "Are you a tax resident in any country other than Israel?",
    isRequired: true,
    isMandatory: true,
    options: [
      { value: "YES", label: "Yes" },
      { value: "NO", label: "No, only Israel" },
    ],
    riskWeight: 10,
    applicableRiskLevels: [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.VERY_HIGH],
    order: 13,
    skipIfAnswerExists: false,
  },
  {
    questionId: "Q_FATCA_DECLARATION",
    section: QuestionSection.FATCA,
    type: QuestionType.DECLARATION,
    text: "FATCA Declaration: Do you hold US citizenship, a US green card, or are you a US tax resident?",
    helpText: "This declaration is required under the Foreign Account Tax Compliance Act (FATCA).",
    isRequired: true,
    isMandatory: true,
    options: [
      { value: "NO", label: "No – I am not a US person" },
      { value: "YES_US_CITIZEN", label: "Yes – US citizen", isHighRisk: true },
      { value: "YES_GREEN_CARD", label: "Yes – US green card holder", isHighRisk: true },
      { value: "YES_US_RESIDENT", label: "Yes – US tax resident", isHighRisk: true },
    ],
    displayConditions: [
      { questionId: "Q_FOREIGN_TAX_RESIDENCY", operator: "equals", value: "YES" },
    ],
    riskWeight: 10,
    applicableRiskLevels: [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.VERY_HIGH],
    order: 14,
    skipIfAnswerExists: false,
  },
  {
    questionId: "Q_CRS_DECLARATION",
    section: QuestionSection.CRS,
    type: QuestionType.DECLARATION,
    text: "CRS Declaration: Please confirm your country of tax residency for CRS reporting purposes.",
    helpText: "Common Reporting Standard (CRS) requires financial institutions to collect this information.",
    isRequired: true,
    isMandatory: true,
    options: [
      { value: "CONFIRMED", label: "I confirm the tax residency information I have provided is accurate" },
      { value: "NEEDS_UPDATE", label: "I need to update my tax residency information" },
    ],
    displayConditions: [
      { questionId: "Q_FOREIGN_TAX_RESIDENCY", operator: "equals", value: "YES" },
    ],
    riskWeight: 5,
    applicableRiskLevels: [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.VERY_HIGH],
    order: 15,
    skipIfAnswerExists: false,
  },
  // ── PEP ──────────────────────────────────────────────────
  {
    questionId: "Q_PEP_STATUS",
    section: QuestionSection.PEP,
    type: QuestionType.YES_NO,
    text: "Are you, or is an immediate family member, a Politically Exposed Person (senior public official, politician, military officer, or judge)?",
    helpText: "A PEP is a person who holds or has held a prominent public function.",
    isRequired: true,
    isMandatory: true,
    options: [
      {
        value: "NO",
        label: "No",
      },
      {
        value: "YES",
        label: "Yes",
        isHighRisk: true,
        triggersBranch: { createFlag: "PEP_DECLARED" as any, escalateRisk: true },
      },
    ],
    riskWeight: 25,
    applicableRiskLevels: [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.VERY_HIGH],
    order: 16,
    skipIfAnswerExists: false,
  },
  {
    questionId: "Q_PEP_ROLE",
    section: QuestionSection.PEP,
    type: QuestionType.TEXT,
    text: "Please describe the public role or position held.",
    isRequired: true,
    isMandatory: false,
    displayConditions: [
      { questionId: "Q_PEP_STATUS", operator: "equals", value: "YES" },
    ],
    riskWeight: 10,
    applicableRiskLevels: [RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.VERY_HIGH],
    order: 17,
    skipIfAnswerExists: false,
  },
  // ── Beneficial Ownership (EDD) ────────────────────────────
  {
    questionId: "Q_BENEFICIAL_OWNERSHIP",
    section: QuestionSection.BENEFICIAL_OWNERSHIP,
    type: QuestionType.YES_NO,
    text: "Are you acting on behalf of another person or entity? (Are there ultimate beneficial owners other than yourself?)",
    isRequired: true,
    isMandatory: true,
    options: [
      { value: "NO", label: "No, I am the sole beneficial owner" },
      { value: "YES", label: "Yes", isHighRisk: true },
    ],
    riskWeight: 20,
    applicableRiskLevels: [RiskLevel.HIGH, RiskLevel.VERY_HIGH],
    order: 18,
    skipIfAnswerExists: false,
  },
  {
    questionId: "Q_RELATIONSHIP_PURPOSE",
    section: QuestionSection.EDD,
    type: QuestionType.SINGLE_CHOICE,
    text: "What is the primary purpose of your relationship with the bank?",
    isRequired: true,
    isMandatory: true,
    options: [
      { value: "PERSONAL_BANKING", label: "Personal banking and savings" },
      { value: "BUSINESS_BANKING", label: "Business banking" },
      { value: "INVESTMENT", label: "Investment and wealth management" },
      { value: "MORTGAGE", label: "Mortgage and property" },
      { value: "INTERNATIONAL", label: "International activity" },
      { value: "MIXED", label: "Multiple purposes" },
    ],
    riskWeight: 5,
    applicableRiskLevels: [RiskLevel.HIGH, RiskLevel.VERY_HIGH],
    order: 19,
    skipIfAnswerExists: false,
  },
  // ── Document Uploads ──────────────────────────────────────
  {
    questionId: "Q_DOC_INCOME_PROOF",
    section: QuestionSection.INCOME,
    type: QuestionType.FILE_UPLOAD,
    text: "Please upload a recent proof of income (salary slip, pension letter, or bank statement from the last 3 months).",
    helpText: "Accepted: PDF, JPG, PNG — max 10 MB each.",
    isRequired: true,
    isMandatory: true,
    documentMeta: {
      acceptedFormats: ["PDF", "JPG", "PNG"],
      maxSizeMb: 10,
      examples: "salary slip, bank statement, pension letter",
    },
    riskWeight: 0,
    applicableRiskLevels: [RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.VERY_HIGH],
    order: 20,
    skipIfAnswerExists: false,
  },
  {
    questionId: "Q_DOC_ID_DOCUMENT",
    section: QuestionSection.IDENTITY_CONFIRMATION,
    type: QuestionType.FILE_UPLOAD,
    text: "Please upload a clear copy of your valid passport or national ID card (both sides required).",
    helpText: "Accepted: PDF, JPG, PNG — max 10 MB.",
    isRequired: true,
    isMandatory: true,
    documentMeta: {
      acceptedFormats: ["PDF", "JPG", "PNG"],
      maxSizeMb: 10,
      examples: "passport photo page, both sides of national ID",
    },
    riskWeight: 0,
    applicableRiskLevels: [RiskLevel.HIGH, RiskLevel.VERY_HIGH],
    order: 21,
    skipIfAnswerExists: false,
  },
  {
    questionId: "Q_DOC_SOURCE_OF_FUNDS",
    section: QuestionSection.SOURCE_OF_FUNDS,
    type: QuestionType.FILE_UPLOAD,
    text: "Please upload documentary evidence of your declared source of funds.",
    helpText: "Accepted: PDF, JPG, PNG — max 10 MB.",
    isRequired: true,
    isMandatory: true,
    displayConditions: [
      { questionId: "Q_SOURCE_OF_FUNDS", operator: "in", value: ["INHERITANCE", "REAL_ESTATE", "LOAN", "GIFT", "OTHER"] },
    ],
    documentMeta: {
      acceptedFormats: ["PDF", "JPG", "PNG"],
      maxSizeMb: 10,
      examples: "inheritance letter, property sale agreement, loan contract, gift letter",
    },
    riskWeight: 0,
    applicableRiskLevels: [RiskLevel.HIGH, RiskLevel.VERY_HIGH],
    order: 22,
    skipIfAnswerExists: false,
  },
  {
    questionId: "Q_DOC_BUSINESS_REG",
    section: QuestionSection.EMPLOYMENT,
    type: QuestionType.FILE_UPLOAD,
    text: "Please upload your business registration certificate or freelance license.",
    helpText: "Required for self-employed individuals and business owners. Accepted: PDF, JPG, PNG — max 10 MB.",
    isRequired: true,
    isMandatory: true,
    displayConditions: [
      { questionId: "Q_EMPLOYMENT_STATUS", operator: "in", value: ["BUSINESS_OWNER", "SELF_EMPLOYED"] },
    ],
    documentMeta: {
      acceptedFormats: ["PDF", "JPG", "PNG"],
      maxSizeMb: 10,
      examples: "business registration certificate, freelance license, VAT certificate",
    },
    riskWeight: 0,
    applicableRiskLevels: [RiskLevel.HIGH, RiskLevel.VERY_HIGH],
    order: 23,
    skipIfAnswerExists: false,
  },
];

// ─── Questionnaire Builder ────────────────────────────────────

export interface ExistingKycData {
  employmentStatus?: string;
  incomeRange?: string;
  sourceOfFunds?: string;
  foreignTaxResident?: boolean;
  fatcaStatus?: string;
  crsConfirmed?: boolean;
  isPep?: boolean;
  hasInternationalActivity?: boolean;
  lastKycComplete?: boolean;
}

export function buildQuestionnaire(
  customer: Customer,
  trigger: KycTriggerType,
  existingData: ExistingKycData,
): KycQuestion[] {
  const riskLevel = customer.riskLevel;
  let questions = QUESTION_BANK.filter((q) =>
    q.applicableRiskLevels.includes(riskLevel),
  );

  // Always start with the "no changes" gate for periodic reviews
  const isPeriodicReview =
    trigger === KycTriggerType.PERIODIC_REFRESH ||
    trigger === KycTriggerType.RISK_BASED_REVIEW;

  if (!isPeriodicReview) {
    questions = questions.filter((q) => q.questionId !== "Q_NO_CHANGES");
  }

  // Skip FATCA/CRS unless the customer is potentially foreign tax resident
  if (!customer.isFatcaRelevant && !customer.isCrsRelevant && !existingData.foreignTaxResident) {
    questions = questions.filter(
      (q) => q.section !== QuestionSection.FATCA && q.section !== QuestionSection.CRS,
    );
  }

  // Skip PEP section if confirmed non-PEP recently and no PEP trigger
  if (
    existingData.isPep === false &&
    trigger !== KycTriggerType.PEP_STATUS_CHANGE
  ) {
    // Still show PEP question for medium+ risk; skip for LOW on pure periodic refresh
    if (riskLevel === RiskLevel.LOW && isPeriodicReview) {
      questions = questions.filter((q) => q.questionId !== "Q_PEP_ROLE");
    }
  }

  // Skip international activity sub-questions if customer declares no intl activity
  // (handled at runtime via displayConditions, but for LOW risk remove entirely)
  if (riskLevel === RiskLevel.LOW && !existingData.hasInternationalActivity) {
    questions = questions.filter(
      (q) =>
        q.questionId !== "Q_COUNTRY_EXPOSURE" &&
        q.questionId !== "Q_TRANSFER_PURPOSE",
    );
  }

  // For employment-specific triggers, push employment section to front
  if (trigger === KycTriggerType.EMPLOYMENT_CHANGE) {
    const empQ = questions.filter((q) => q.section === QuestionSection.EMPLOYMENT);
    const others = questions.filter((q) => q.section !== QuestionSection.EMPLOYMENT);
    questions = [...empQ, ...others];
  }

  // Low-risk: apply "no changes" fast track – if data is complete, minimal set
  if (riskLevel === RiskLevel.LOW && isPeriodicReview && existingData.lastKycComplete) {
    const lowRiskMinimalSet = [
      "Q_NO_CHANGES",
      "Q_EMPLOYMENT_CHANGED",
      "Q_MONTHLY_INCOME",
      "Q_EXPECTED_MONTHLY_ACTIVITY",
      "Q_INTERNATIONAL_ACTIVITY",
      "Q_FOREIGN_TAX_RESIDENCY",
      "Q_PEP_STATUS",
    ];
    questions = questions.filter((q) => lowRiskMinimalSet.includes(q.questionId));
  }

  // Remove EDD / source of wealth for LOW risk
  if (riskLevel === RiskLevel.LOW) {
    questions = questions.filter(
      (q) =>
        q.section !== QuestionSection.SOURCE_OF_WEALTH &&
        q.section !== QuestionSection.EDD &&
        q.section !== QuestionSection.BENEFICIAL_OWNERSHIP,
    );
  }

  // FATCA/CRS trigger: ensure tax section is always included
  if (trigger === KycTriggerType.FATCA_CRS_MISSING) {
    const taxIds = [
      "Q_FOREIGN_TAX_RESIDENCY",
      "Q_FATCA_DECLARATION",
      "Q_CRS_DECLARATION",
    ];
    const existing = new Set(questions.map((q) => q.questionId));
    const toAdd = QUESTION_BANK.filter(
      (q) => taxIds.includes(q.questionId) && !existing.has(q.questionId),
    );
    questions = [...questions, ...toAdd];
  }

  // Remove duplicate questions and sort by order
  const seen = new Set<string>();
  const deduped = questions.filter((q) => {
    if (seen.has(q.questionId)) return false;
    seen.add(q.questionId);
    return true;
  });

  return deduped.sort((a, b) => a.order - b.order);
}

// ─── Branching: resolve next question given current answers ───

export function resolveNextQuestion(
  allQuestions: KycQuestion[],
  answeredIds: Set<string>,
  currentAnswers: Record<string, string | string[] | boolean>,
): KycQuestion | null {
  for (const q of allQuestions) {
    if (answeredIds.has(q.questionId)) continue;

    if (q.displayConditions && q.displayConditions.length > 0) {
      const conditionsMet = q.displayConditions.every((cond) => {
        const answerVal = currentAnswers[cond.questionId];
        if (answerVal === undefined) return false;
        if (cond.operator === "equals") return answerVal === cond.value;
        if (cond.operator === "not_equals") return answerVal !== cond.value;
        if (cond.operator === "in") {
          return Array.isArray(cond.value)
            ? cond.value.includes(answerVal as string)
            : false;
        }
        return true;
      });
      if (!conditionsMet) {
        answeredIds.add(q.questionId); // skip it
        continue;
      }
    }

    return q;
  }

  return null; // questionnaire complete
}
