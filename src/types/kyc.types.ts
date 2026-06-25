// ============================================================
// KYC System – Core TypeScript Interfaces & Enums
// Bank-grade, AML/CFT, FATCA, CRS, PEP compliant
// ============================================================

// ─── Enumerations ───────────────────────────────────────────

export enum RiskLevel {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  VERY_HIGH = "VERY_HIGH",
}

export enum KycTriggerType {
  PERIODIC_REFRESH = "PERIODIC_REFRESH",
  RISK_BASED_REVIEW = "RISK_BASED_REVIEW",
  PROFILE_CHANGE = "PROFILE_CHANGE",
  ADDRESS_CHANGE = "ADDRESS_CHANGE",
  EMPLOYMENT_CHANGE = "EMPLOYMENT_CHANGE",
  NEW_PRODUCT_OPENING = "NEW_PRODUCT_OPENING",
  UNUSUAL_ACTIVITY = "UNUSUAL_ACTIVITY",
  INTERNATIONAL_TRANSFER = "INTERNATIONAL_TRANSFER",
  HIGH_CASH_ACTIVITY = "HIGH_CASH_ACTIVITY",
  FATCA_CRS_MISSING = "FATCA_CRS_MISSING",
  PEP_STATUS_CHANGE = "PEP_STATUS_CHANGE",
  SANCTIONS_INDICATOR = "SANCTIONS_INDICATOR",
  ADVERSE_MEDIA = "ADVERSE_MEDIA",
}

export enum KycSessionStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  SUBMITTED = "SUBMITTED",
  AUTO_COMPLETE = "AUTO_COMPLETE",
  LIGHT_REVIEW = "LIGHT_REVIEW",
  FULL_COMPLIANCE_REVIEW = "FULL_COMPLIANCE_REVIEW",
  REJECTED = "REJECTED",
  RESTRICTED = "RESTRICTED",
  EXPIRED = "EXPIRED",
}

export enum KycDecisionType {
  AUTO_COMPLETE = "AUTO_COMPLETE",
  LIGHT_REVIEW = "LIGHT_REVIEW",
  FULL_COMPLIANCE_REVIEW = "FULL_COMPLIANCE_REVIEW",
  REJECT_OR_RESTRICT = "REJECT_OR_RESTRICT",
}

export enum QuestionType {
  SINGLE_CHOICE = "SINGLE_CHOICE",
  MULTI_CHOICE = "MULTI_CHOICE",
  YES_NO = "YES_NO",
  NUMERIC_RANGE = "NUMERIC_RANGE",
  TEXT = "TEXT",
  DATE = "DATE",
  COUNTRY_SELECT = "COUNTRY_SELECT",
  DECLARATION = "DECLARATION",
  FILE_UPLOAD = "FILE_UPLOAD",
}

export enum QuestionSection {
  IDENTITY_CONFIRMATION = "IDENTITY_CONFIRMATION",
  EMPLOYMENT = "EMPLOYMENT",
  INCOME = "INCOME",
  SOURCE_OF_FUNDS = "SOURCE_OF_FUNDS",
  SOURCE_OF_WEALTH = "SOURCE_OF_WEALTH",
  ACTIVITY_EXPECTATIONS = "ACTIVITY_EXPECTATIONS",
  INTERNATIONAL_ACTIVITY = "INTERNATIONAL_ACTIVITY",
  TAX_RESIDENCY = "TAX_RESIDENCY",
  FATCA = "FATCA",
  CRS = "CRS",
  PEP = "PEP",
  BENEFICIAL_OWNERSHIP = "BENEFICIAL_OWNERSHIP",
  EDD = "EDD",
}

export enum FlagSeverity {
  SOFT = "SOFT",
  HARD = "HARD",
}

export enum FlagCode {
  // Hard flags
  PEP_DECLARED = "PEP_DECLARED",
  SANCTIONS_MATCH = "SANCTIONS_MATCH",
  HIGH_RISK_COUNTRY = "HIGH_RISK_COUNTRY",
  UNKNOWN_SOURCE_OF_FUNDS = "UNKNOWN_SOURCE_OF_FUNDS",
  INCOME_ACTIVITY_MISMATCH_MATERIAL = "INCOME_ACTIVITY_MISMATCH_MATERIAL",
  MANDATORY_QUESTION_REFUSED = "MANDATORY_QUESTION_REFUSED",
  CONFLICTING_FATCA_CRS = "CONFLICTING_FATCA_CRS",
  ADVERSE_MEDIA_CONFIRMED = "ADVERSE_MEDIA_CONFIRMED",
  BENEFICIAL_OWNER_UNIDENTIFIED = "BENEFICIAL_OWNER_UNIDENTIFIED",

  // Soft flags
  INCOME_ACTIVITY_MISMATCH_MINOR = "INCOME_ACTIVITY_MISMATCH_MINOR",
  MISSING_OPTIONAL_FIELD = "MISSING_OPTIONAL_FIELD",
  EMPLOYMENT_CHANGED = "EMPLOYMENT_CHANGED",
  ACTIVITY_INCREASED_MODERATE = "ACTIVITY_INCREASED_MODERATE",
  FOREIGN_TAX_RESIDENCY_DECLARED = "FOREIGN_TAX_RESIDENCY_DECLARED",
  INTERNATIONAL_ACTIVITY_NEW = "INTERNATIONAL_ACTIVITY_NEW",
  MULTIPLE_COUNTRIES_DECLARED = "MULTIPLE_COUNTRIES_DECLARED",
}

export enum NotificationChannel {
  PUSH = "PUSH",
  IN_APP = "IN_APP",
  SMS = "SMS",
  EMAIL = "EMAIL",
}

export enum NotificationStatus {
  PENDING = "PENDING",
  SENT = "SENT",
  DELIVERED = "DELIVERED",
  READ = "READ",
  FAILED = "FAILED",
}

export enum CaseStatus {
  OPEN = "OPEN",
  IN_REVIEW = "IN_REVIEW",
  PENDING_CUSTOMER_INFO = "PENDING_CUSTOMER_INFO",
  ESCALATED = "ESCALATED",
  CLOSED_APPROVED = "CLOSED_APPROVED",
  CLOSED_RESTRICTED = "CLOSED_RESTRICTED",
  CLOSED_REJECTED = "CLOSED_REJECTED",
}

export enum CasePriority {
  CRITICAL = "CRITICAL",
  HIGH = "HIGH",
  MEDIUM = "MEDIUM",
  LOW = "LOW",
}

export enum EmploymentStatus {
  EMPLOYED = "EMPLOYED",
  SELF_EMPLOYED = "SELF_EMPLOYED",
  BUSINESS_OWNER = "BUSINESS_OWNER",
  RETIRED = "RETIRED",
  STUDENT = "STUDENT",
  UNEMPLOYED = "UNEMPLOYED",
  OTHER = "OTHER",
}

export enum IncomeRange {
  UNDER_5K = "UNDER_5K",
  FROM_5K_TO_15K = "FROM_5K_TO_15K",
  FROM_15K_TO_30K = "FROM_15K_TO_30K",
  FROM_30K_TO_50K = "FROM_30K_TO_50K",
  ABOVE_50K = "ABOVE_50K",
}

export enum SourceOfFunds {
  SALARY = "SALARY",
  BUSINESS_INCOME = "BUSINESS_INCOME",
  INVESTMENT_RETURNS = "INVESTMENT_RETURNS",
  PENSION = "PENSION",
  INHERITANCE = "INHERITANCE",
  REAL_ESTATE = "REAL_ESTATE",
  LOAN = "LOAN",
  GIFT = "GIFT",
  OTHER = "OTHER",
}

export enum CustomerSegment {
  RETAIL = "RETAIL",
  PRIVATE_BANKING = "PRIVATE_BANKING",
  SME = "SME",
  CORPORATE = "CORPORATE",
}

export enum AuthMethod {
  SESSION_TOKEN = "SESSION_TOKEN",
  MFA_OTP = "MFA_OTP",
  BIOMETRIC = "BIOMETRIC",
  STEP_UP = "STEP_UP",
}

// ─── Core Entities ────────────────────────────────────────────

export interface Address {
  street: string;
  city: string;
  postalCode: string;
  country: string;
  stateOrRegion?: string;
  isHighRiskCountry: boolean;
}

export interface Customer {
  customerId: string;
  nationalId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // ISO 8601
  address: Address;
  email: string;
  phone: string;
  employmentStatus: EmploymentStatus;
  occupation: string;
  employer?: string;
  segment: CustomerSegment;
  riskLevel: RiskLevel;
  relationshipStartDate: string;
  nationality: string;
  taxResidencies: string[]; // ISO country codes
  isFatcaRelevant: boolean;
  isCrsRelevant: boolean;
  isPep: boolean;
  hasSanctionsFlag: boolean;
  hasAdverseMediaFlag: boolean;
  lastKycCompletionDate?: string;
  nextKycDueDate?: string;
  accountStatus: "ACTIVE" | "RESTRICTED" | "CLOSED";
  productHoldings: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomerRiskProfile {
  customerId: string;
  overallRiskLevel: RiskLevel;
  riskScore: number; // 0–100
  riskFactors: RiskFactor[];
  geographicRisk: RiskLevel;
  productRisk: RiskLevel;
  behavioralRisk: RiskLevel;
  pepRisk: boolean;
  sanctionsRisk: boolean;
  adverseMediaRisk: boolean;
  lastAssessedAt: string;
  nextReviewDueDate: string;
  assessedBy: "SYSTEM" | string;
}

export interface RiskFactor {
  factorCode: string;
  description: string;
  weight: number;
  value: string | number | boolean;
  contribution: number; // points added to risk score
}

export interface KycSession {
  sessionId: string;
  customerId: string;
  triggerType: KycTriggerType;
  triggerDetails?: string;
  status: KycSessionStatus;
  riskLevelAtStart: RiskLevel;
  authMethod: AuthMethod;
  channelUsed: NotificationChannel;
  questionsServed: string[]; // question IDs
  answersSubmitted: KycAnswer[];
  flags: KycFlag[];
  ruleResults: RuleResult[];
  decision?: KycDecision;
  complianceCaseId?: string;
  startedAt?: string;
  submittedAt?: string;
  completedAt?: string;
  expiresAt: string;
  durationSeconds?: number;
  questionCount: number;
  isNoChangeFlow: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KycQuestion {
  questionId: string;
  section: QuestionSection;
  type: QuestionType;
  text: string;
  helpText?: string;
  isRequired: boolean;
  isMandatory: boolean; // regulatory mandatory vs business required
  options?: QuestionOption[];
  validationRules?: ValidationRule[];
  displayConditions?: DisplayCondition[];
  riskWeight: number;
  applicableRiskLevels: RiskLevel[];
  order: number;
  skipIfAnswerExists: boolean;
  existingAnswerField?: keyof Customer; // pre-fill from CRM
  documentMeta?: {
    acceptedFormats: string[];
    maxSizeMb: number;
    examples?: string;
  };
}

export interface QuestionOption {
  value: string;
  label: string;
  isHighRisk?: boolean;
  triggersBranch?: BranchCondition;
}

export interface BranchCondition {
  skipSections?: QuestionSection[];
  addSections?: QuestionSection[];
  createFlag?: FlagCode;
  escalateRisk?: boolean;
}

export interface DisplayCondition {
  questionId: string;
  operator: "equals" | "not_equals" | "contains" | "in";
  value: string | string[];
}

export interface ValidationRule {
  type: "required" | "min_length" | "max_length" | "regex" | "custom";
  value?: string | number;
  errorMessage: string;
}

export interface KycAnswer {
  answerId: string;
  sessionId: string;
  questionId: string;
  questionSection: QuestionSection;
  rawValue: string | string[] | boolean | number;
  normalizedValue: string;
  answeredAt: string;
  isPreFilled: boolean;
  confirmedByCustomer: boolean;
  changedFromPrevious: boolean;
}

export interface KycFlag {
  flagId: string;
  sessionId: string;
  customerId: string;
  code: FlagCode;
  severity: FlagSeverity;
  description: string;
  sourceQuestionId?: string;
  sourceAnswerValue?: string;
  ruleId?: string;
  detectedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
}

export interface RiskScore {
  customerId: string;
  sessionId: string;
  baseScore: number;
  adjustments: ScoreAdjustment[];
  finalScore: number;
  riskLevel: RiskLevel;
  calculatedAt: string;
}

export interface ScoreAdjustment {
  reason: string;
  delta: number;
  ruleId: string;
}

export interface RuleResult {
  ruleId: string;
  ruleName: string;
  triggered: boolean;
  output?: string;
  flagCreated?: FlagCode;
  scoreImpact: number;
  evaluatedAt: string;
}

export interface KycDecision {
  decisionId: string;
  sessionId: string;
  customerId: string;
  type: KycDecisionType;
  rationale: string;
  hardFlagsPresent: FlagCode[];
  softFlagsPresent: FlagCode[];
  riskScore: number;
  automatedDecision: boolean;
  analystId?: string;
  decidedAt: string;
  effectiveUntil?: string;
  requiresDocumentUpload: boolean;
  documentTypes?: string[];
}

export interface AuditLog {
  logId: string;
  sessionId?: string;
  customerId: string;
  caseId?: string;
  action: string;
  actor: "CUSTOMER" | "SYSTEM" | "ANALYST" | "ADMIN";
  actorId: string;
  channel?: NotificationChannel;
  ipAddress?: string;
  deviceFingerprint?: string;
  payload?: Record<string, unknown>;
  timestamp: string;
  correlationId: string;
}

export interface ComplianceCase {
  caseId: string;
  sessionId: string;
  customerId: string;
  status: CaseStatus;
  priority: CasePriority;
  assignedAnalystId?: string;
  flags: KycFlag[];
  slaDeadline: string;
  slaBreach: boolean;
  openedAt: string;
  closedAt?: string;
  escalationHistory: EscalationEvent[];
  customerContactHistory: CustomerContact[];
  internalNotes: CaseNote[];
  decision?: KycDecision;
  auditTrail: AuditLog[];
}

export interface EscalationEvent {
  escalatedAt: string;
  escalatedBy: string;
  escalatedTo: string;
  reason: string;
}

export interface CustomerContact {
  contactedAt: string;
  channel: NotificationChannel;
  reason: string;
  response?: string;
  respondedAt?: string;
}

export interface CaseNote {
  noteId: string;
  authorId: string;
  content: string;
  createdAt: string;
  isInternal: boolean;
}

export interface Notification {
  notificationId: string;
  customerId: string;
  sessionId?: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  subject: string;
  body: string;
  deepLinkUrl?: string;
  scheduledAt?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  retryCount: number;
  fallbackChannel?: NotificationChannel;
}

export interface SystemIntegrationResult {
  integrationId: string;
  sessionId: string;
  targetSystem: "CRM" | "AML" | "CORE_BANKING" | "PEP_SCREENING" | "SANCTIONS";
  action: string;
  success: boolean;
  requestPayload: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
  errorMessage?: string;
  attemptedAt: string;
  completedAt?: string;
  retryCount: number;
}

// ─── Rule Engine Types ────────────────────────────────────────

export interface RuleDefinition {
  ruleId: string;
  name: string;
  description: string;
  priority: number;
  conditions: RuleCondition[];
  operator: "AND" | "OR";
  actions: RuleAction[];
  enabled: boolean;
  applicableRiskLevels: RiskLevel[];
}

export interface RuleCondition {
  field: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "not_in" | "contains";
  value: string | number | boolean | string[];
}

export interface RuleAction {
  type: "SET_DECISION" | "CREATE_FLAG" | "ADJUST_SCORE" | "SKIP_SECTION" | "REQUIRE_DOCUMENT";
  payload: Record<string, unknown>;
}

export interface RuleEngineResult {
  sessionId: string;
  customerId: string;
  ruleResults: RuleResult[];
  flags: KycFlag[];
  riskScore: RiskScore;
  decision: KycDecision;
  evaluatedAt: string;
}

// ─── API Contracts ────────────────────────────────────────────

export interface CreateSessionRequest {
  customerId: string;
  triggerType: KycTriggerType;
  triggerDetails?: string;
  channelUsed: NotificationChannel;
  authMethod: AuthMethod;
}

export interface SubmitAnswersRequest {
  sessionId: string;
  answers: Omit<KycAnswer, "answerId" | "answeredAt">[];
}

export interface EvaluateRulesRequest {
  sessionId: string;
  customerId: string;
  answers: KycAnswer[];
  riskProfile: CustomerRiskProfile;
}

export interface CaseDecisionRequest {
  caseId: string;
  analystId: string;
  decision: KycDecisionType;
  rationale: string;
  internalNote?: string;
  requiresRestriction?: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  requestId: string;
  timestamp: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
}
