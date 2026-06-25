// ============================================================
// KYC Backend Routes – Node.js / Express style
// Mock handlers with full validation, error handling, and audit logging.
// Replace mock data store with real DB/ORM in production.
// ============================================================

import { Request, Response, NextFunction, Router } from "express";
import {
  CreateSessionRequest,
  SubmitAnswersRequest,
  EvaluateRulesRequest,
  CaseDecisionRequest,
  KycSession,
  KycSessionStatus,
  KycAnswer,
  AuditLog,
  ComplianceCase,
  CaseStatus,
  CasePriority,
  KycDecisionType,
  ApiResponse,
  PaginatedResponse,
  NotificationChannel,
  AuthMethod,
  RiskLevel,
  KycTriggerType,
  CustomerRiskProfile,
  RuleEngineResult,
} from "../types/kyc.types";
import { evaluateKycSession, SLA_HOURS } from "../services/kycRuleEngine";
import { buildQuestionnaire } from "../services/questionnaireBuilder";

// ─── In-memory stores (replace with DB layer) ─────────────────

const sessions = new Map<string, KycSession>();
const auditLogs: AuditLog[] = [];
const cases = new Map<string, ComplianceCase>();

// ─── Utility ──────────────────────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function now(): string {
  return new Date().toISOString();
}

function success<T>(res: Response, data: T, status = 200): void {
  const body: ApiResponse<T> = {
    success: true,
    data,
    requestId: generateId("REQ"),
    timestamp: now(),
  };
  res.status(status).json(body);
}

function fail(
  res: Response,
  code: string,
  message: string,
  status = 400,
  details?: Record<string, string[]>,
): void {
  const body: ApiResponse<null> = {
    success: false,
    error: { code, message, details },
    requestId: generateId("REQ"),
    timestamp: now(),
  };
  res.status(status).json(body);
}

function writeAudit(log: Omit<AuditLog, "logId" | "timestamp" | "correlationId">): void {
  auditLogs.push({
    ...log,
    logId: generateId("AUDIT"),
    timestamp: now(),
    correlationId: generateId("COR"),
  });
}

function slaDeadline(riskLevel: RiskLevel): string {
  const hours = SLA_HOURS[riskLevel];
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

// ─── Middleware: request logger ────────────────────────────────

function requestLogger(req: Request, res: Response, next: NextFunction): void {
  writeAudit({
    action: `HTTP ${req.method} ${req.path}`,
    actor: "SYSTEM",
    actorId: "GATEWAY",
    ipAddress: req.ip,
    payload: req.method === "POST" ? { body: "[redacted]" } : undefined,
    customerId: (req.params.customerId ?? req.body?.customerId ?? "unknown") as string,
  });
  next();
}

// ─── Mock CRM lookup ──────────────────────────────────────────

function mockFetchCustomer(customerId: string) {
  return {
    customerId,
    nationalId: "IL-XXXX",
    firstName: "Demo",
    lastName: "Customer",
    dateOfBirth: "1985-06-15",
    address: { street: "1 Main St", city: "Tel Aviv", postalCode: "6100000", country: "IL", isHighRiskCountry: false },
    email: "customer@example.com",
    phone: "+972-50-0000000",
    employmentStatus: "EMPLOYED" as const,
    occupation: "ENGINEER",
    employer: "Tech Ltd",
    segment: "RETAIL" as const,
    riskLevel: RiskLevel.LOW,
    relationshipStartDate: "2018-01-01",
    nationality: "IL",
    taxResidencies: ["IL"],
    isFatcaRelevant: false,
    isCrsRelevant: false,
    isPep: false,
    hasSanctionsFlag: false,
    hasAdverseMediaFlag: false,
    accountStatus: "ACTIVE" as const,
    productHoldings: ["CURRENT_ACCOUNT", "SAVINGS_ACCOUNT"],
    createdAt: "2018-01-01T00:00:00Z",
    updatedAt: now(),
  };
}

function mockFetchRiskProfile(customerId: string): CustomerRiskProfile {
  return {
    customerId,
    overallRiskLevel: RiskLevel.LOW,
    riskScore: 15,
    riskFactors: [],
    geographicRisk: RiskLevel.LOW,
    productRisk: RiskLevel.LOW,
    behavioralRisk: RiskLevel.LOW,
    pepRisk: false,
    sanctionsRisk: false,
    adverseMediaRisk: false,
    lastAssessedAt: now(),
    nextReviewDueDate: new Date(Date.now() + 365 * 86400000).toISOString(),
    assessedBy: "SYSTEM",
  };
}

// ─── Route Handlers ───────────────────────────────────────────

/**
 * POST /kyc/sessions
 * Creates a new KYC session for a customer.
 */
async function createSession(req: Request, res: Response): Promise<void> {
  const body = req.body as CreateSessionRequest;

  if (!body.customerId) {
    fail(res, "VALIDATION_ERROR", "customerId is required", 400, { customerId: ["Required"] });
    return;
  }
  if (!body.triggerType) {
    fail(res, "VALIDATION_ERROR", "triggerType is required", 400, { triggerType: ["Required"] });
    return;
  }

  const customer = mockFetchCustomer(body.customerId);
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const session: KycSession = {
    sessionId: generateId("KYC"),
    customerId: body.customerId,
    triggerType: body.triggerType,
    triggerDetails: body.triggerDetails,
    status: KycSessionStatus.PENDING,
    riskLevelAtStart: customer.riskLevel,
    authMethod: body.authMethod ?? AuthMethod.SESSION_TOKEN,
    channelUsed: body.channelUsed ?? NotificationChannel.IN_APP,
    questionsServed: [],
    answersSubmitted: [],
    flags: [],
    ruleResults: [],
    expiresAt,
    questionCount: 0,
    isNoChangeFlow: false,
    createdAt: now(),
    updatedAt: now(),
  };

  sessions.set(session.sessionId, session);

  writeAudit({
    sessionId: session.sessionId,
    customerId: body.customerId,
    action: "SESSION_CREATED",
    actor: "SYSTEM",
    actorId: "KYC_ENGINE",
    channel: body.channelUsed,
    payload: { triggerType: body.triggerType },
  });

  success(res, { sessionId: session.sessionId, expiresAt, status: session.status }, 201);
}

/**
 * GET /kyc/sessions/:id
 * Returns full session state.
 */
async function getSession(req: Request, res: Response): Promise<void> {
  const session = sessions.get(req.params.id);
  if (!session) {
    fail(res, "NOT_FOUND", "Session not found", 404);
    return;
  }
  success(res, session);
}

/**
 * GET /kyc/sessions/:id/questions
 * Dynamically builds and returns the question list for this session.
 */
async function getQuestions(req: Request, res: Response): Promise<void> {
  const session = sessions.get(req.params.id);
  if (!session) {
    fail(res, "NOT_FOUND", "Session not found", 404);
    return;
  }
  if (new Date(session.expiresAt) < new Date()) {
    session.status = KycSessionStatus.EXPIRED;
    fail(res, "SESSION_EXPIRED", "This KYC session has expired. Please request a new one.", 410);
    return;
  }

  const customer = mockFetchCustomer(session.customerId);
  const questions = buildQuestionnaire(customer, session.triggerType, {
    lastKycComplete: !!customer.lastKycCompletionDate,
    isPep: customer.isPep,
    foreignTaxResident: customer.isFatcaRelevant || customer.isCrsRelevant,
  });

  session.questionsServed = questions.map((q) => q.questionId);
  session.questionCount = questions.length;
  session.status = KycSessionStatus.IN_PROGRESS;
  session.startedAt = session.startedAt ?? now();
  session.updatedAt = now();

  writeAudit({
    sessionId: session.sessionId,
    customerId: session.customerId,
    action: "QUESTIONS_LOADED",
    actor: "SYSTEM",
    actorId: "KYC_ENGINE",
    payload: { questionCount: questions.length, riskLevel: customer.riskLevel },
  });

  success(res, {
    sessionId: session.sessionId,
    questions,
    totalCount: questions.length,
    estimatedMinutes: Math.ceil(questions.length * 0.2),
  });
}

/**
 * POST /kyc/sessions/:id/answers
 * Persists answer batch (supports incremental saving).
 */
async function submitAnswers(req: Request, res: Response): Promise<void> {
  const session = sessions.get(req.params.id);
  if (!session) {
    fail(res, "NOT_FOUND", "Session not found", 404);
    return;
  }
  if (session.status === KycSessionStatus.SUBMITTED || session.status === KycSessionStatus.AUTO_COMPLETE) {
    fail(res, "SESSION_ALREADY_COMPLETE", "Session is already submitted", 409);
    return;
  }

  const body = req.body as SubmitAnswersRequest;
  if (!Array.isArray(body.answers)) {
    fail(res, "VALIDATION_ERROR", "answers must be an array", 400);
    return;
  }

  const timestamp = now();
  const newAnswers: KycAnswer[] = body.answers.map((a) => ({
    ...a,
    answerId: generateId("ANS"),
    answeredAt: timestamp,
    isPreFilled: false,
    confirmedByCustomer: true,
    changedFromPrevious: false,
    normalizedValue: Array.isArray(a.rawValue) ? (a.rawValue as string[]).join(",") : String(a.rawValue),
  }));

  // Replace existing answers for same question (idempotent)
  const answerMap = new Map(session.answersSubmitted.map((a) => [a.questionId, a]));
  for (const ans of newAnswers) {
    const existing = answerMap.get(ans.questionId);
    if (existing) ans.changedFromPrevious = existing.normalizedValue !== ans.normalizedValue;
    answerMap.set(ans.questionId, ans);
  }
  session.answersSubmitted = Array.from(answerMap.values());
  session.updatedAt = now();

  writeAudit({
    sessionId: session.sessionId,
    customerId: session.customerId,
    action: "ANSWERS_SAVED",
    actor: "CUSTOMER",
    actorId: session.customerId,
    payload: { count: newAnswers.length },
  });

  success(res, { saved: newAnswers.length, total: session.answersSubmitted.length });
}

/**
 * POST /kyc/sessions/:id/submit
 * Finalises the session: runs rule engine, produces decision.
 */
async function submitSession(req: Request, res: Response): Promise<void> {
  const session = sessions.get(req.params.id);
  if (!session) {
    fail(res, "NOT_FOUND", "Session not found", 404);
    return;
  }
  if (session.status === KycSessionStatus.AUTO_COMPLETE) {
    success(res, { status: session.status, decision: session.decision });
    return;
  }

  const customer = mockFetchCustomer(session.customerId);
  const profile = mockFetchRiskProfile(session.customerId);

  const engineResult: RuleEngineResult = evaluateKycSession(
    customer,
    session,
    session.answersSubmitted,
    profile,
  );

  session.flags = engineResult.flags;
  session.ruleResults = engineResult.ruleResults;
  session.decision = engineResult.decision;
  session.submittedAt = now();
  session.durationSeconds = session.startedAt
    ? Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000)
    : undefined;

  switch (engineResult.decision.type) {
    case KycDecisionType.AUTO_COMPLETE:
      session.status = KycSessionStatus.AUTO_COMPLETE;
      break;
    case KycDecisionType.LIGHT_REVIEW:
      session.status = KycSessionStatus.LIGHT_REVIEW;
      break;
    case KycDecisionType.FULL_COMPLIANCE_REVIEW:
      session.status = KycSessionStatus.FULL_COMPLIANCE_REVIEW;
      createComplianceCase(session, engineResult, customer.riskLevel);
      break;
    case KycDecisionType.REJECT_OR_RESTRICT:
      session.status = KycSessionStatus.RESTRICTED;
      createComplianceCase(session, engineResult, RiskLevel.VERY_HIGH);
      break;
  }

  session.updatedAt = now();

  writeAudit({
    sessionId: session.sessionId,
    customerId: session.customerId,
    action: "SESSION_SUBMITTED",
    actor: "CUSTOMER",
    actorId: session.customerId,
    payload: {
      decision: engineResult.decision.type,
      riskScore: engineResult.riskScore.finalScore,
      flagCount: engineResult.flags.length,
    },
  });

  success(res, {
    sessionId: session.sessionId,
    status: session.status,
    decision: {
      type: engineResult.decision.type,
      rationale: engineResult.decision.rationale,
      requiresDocumentUpload: engineResult.decision.requiresDocumentUpload,
      documentTypes: engineResult.decision.documentTypes,
    },
    riskScore: engineResult.riskScore.finalScore,
    complianceCaseId: session.complianceCaseId,
  });
}

function createComplianceCase(
  session: KycSession,
  result: RuleEngineResult,
  riskLevel: RiskLevel,
): void {
  const priorityMap: Record<RiskLevel, CasePriority> = {
    [RiskLevel.LOW]: CasePriority.LOW,
    [RiskLevel.MEDIUM]: CasePriority.MEDIUM,
    [RiskLevel.HIGH]: CasePriority.HIGH,
    [RiskLevel.VERY_HIGH]: CasePriority.CRITICAL,
  };

  const complianceCase: ComplianceCase = {
    caseId: generateId("CASE"),
    sessionId: session.sessionId,
    customerId: session.customerId,
    status: CaseStatus.OPEN,
    priority: priorityMap[riskLevel],
    flags: result.flags,
    slaDeadline: slaDeadline(riskLevel),
    slaBreach: false,
    openedAt: now(),
    escalationHistory: [],
    customerContactHistory: [],
    internalNotes: [],
    auditTrail: [],
  };

  cases.set(complianceCase.caseId, complianceCase);
  session.complianceCaseId = complianceCase.caseId;

  writeAudit({
    sessionId: session.sessionId,
    customerId: session.customerId,
    caseId: complianceCase.caseId,
    action: "COMPLIANCE_CASE_CREATED",
    actor: "SYSTEM",
    actorId: "KYC_ENGINE",
    payload: { priority: complianceCase.priority, sla: complianceCase.slaDeadline },
  });
}

/**
 * POST /kyc/rules/evaluate
 * Standalone rule engine evaluation endpoint (for testing / integration).
 */
async function evaluateRules(req: Request, res: Response): Promise<void> {
  const body = req.body as EvaluateRulesRequest;
  if (!body.sessionId || !body.customerId) {
    fail(res, "VALIDATION_ERROR", "sessionId and customerId are required");
    return;
  }

  const session = sessions.get(body.sessionId);
  if (!session) {
    fail(res, "NOT_FOUND", "Session not found", 404);
    return;
  }

  const customer = mockFetchCustomer(body.customerId);
  const result = evaluateKycSession(customer, session, body.answers ?? [], body.riskProfile);
  success(res, result);
}

/**
 * GET /kyc/cases
 * Returns paginated list of compliance cases.
 */
async function listCases(req: Request, res: Response): Promise<void> {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const status = req.query.status as CaseStatus | undefined;
  const priority = req.query.priority as CasePriority | undefined;

  let items = Array.from(cases.values());

  if (status) items = items.filter((c) => c.status === status);
  if (priority) items = items.filter((c) => c.priority === priority);

  // Sort: CRITICAL first, then by openedAt desc
  const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  items.sort((a, b) => {
    const pd = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pd !== 0) return pd;
    return new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime();
  });

  const total = items.length;
  const paged = items.slice((page - 1) * pageSize, page * pageSize);

  const response: PaginatedResponse<ComplianceCase> = {
    items: paged,
    total,
    page,
    pageSize,
    hasNext: page * pageSize < total,
  };
  success(res, response);
}

/**
 * GET /kyc/cases/:id
 * Returns a single compliance case with full audit trail.
 */
async function getCase(req: Request, res: Response): Promise<void> {
  const complianceCase = cases.get(req.params.id);
  if (!complianceCase) {
    fail(res, "NOT_FOUND", "Case not found", 404);
    return;
  }
  // Enrich with audit trail for this case
  complianceCase.auditTrail = auditLogs.filter((l) => l.caseId === req.params.id);
  success(res, complianceCase);
}

/**
 * POST /kyc/cases/:id/decision
 * Records analyst decision on a compliance case.
 */
async function recordCaseDecision(req: Request, res: Response): Promise<void> {
  const body = req.body as CaseDecisionRequest;
  const complianceCase = cases.get(req.params.id);

  if (!complianceCase) {
    fail(res, "NOT_FOUND", "Case not found", 404);
    return;
  }
  if (!body.analystId || !body.decision || !body.rationale) {
    fail(res, "VALIDATION_ERROR", "analystId, decision, and rationale are required");
    return;
  }

  const closedStatus: Record<KycDecisionType, CaseStatus> = {
    [KycDecisionType.AUTO_COMPLETE]: CaseStatus.CLOSED_APPROVED,
    [KycDecisionType.LIGHT_REVIEW]: CaseStatus.CLOSED_APPROVED,
    [KycDecisionType.FULL_COMPLIANCE_REVIEW]: CaseStatus.CLOSED_APPROVED,
    [KycDecisionType.REJECT_OR_RESTRICT]: CaseStatus.CLOSED_RESTRICTED,
  };

  complianceCase.status = body.requiresRestriction
    ? CaseStatus.CLOSED_RESTRICTED
    : closedStatus[body.decision];
  complianceCase.closedAt = now();
  complianceCase.decision = {
    decisionId: generateId("DEC"),
    sessionId: complianceCase.sessionId,
    customerId: complianceCase.customerId,
    type: body.decision,
    rationale: body.rationale,
    hardFlagsPresent: complianceCase.flags.filter((f) => f.severity === "HARD").map((f) => f.code),
    softFlagsPresent: complianceCase.flags.filter((f) => f.severity === "SOFT").map((f) => f.code),
    riskScore: 0,
    automatedDecision: false,
    analystId: body.analystId,
    decidedAt: now(),
    requiresDocumentUpload: false,
  };

  if (body.internalNote) {
    complianceCase.internalNotes.push({
      noteId: generateId("NOTE"),
      authorId: body.analystId,
      content: body.internalNote,
      createdAt: now(),
      isInternal: true,
    });
  }

  writeAudit({
    sessionId: complianceCase.sessionId,
    customerId: complianceCase.customerId,
    caseId: complianceCase.caseId,
    action: "CASE_DECISION_RECORDED",
    actor: "ANALYST",
    actorId: body.analystId,
    payload: { decision: body.decision, rationale: body.rationale },
  });

  // Update the parent session
  const session = sessions.get(complianceCase.sessionId);
  if (session) {
    session.status =
      complianceCase.status === CaseStatus.CLOSED_RESTRICTED
        ? KycSessionStatus.RESTRICTED
        : KycSessionStatus.AUTO_COMPLETE;
    session.updatedAt = now();
  }

  success(res, {
    caseId: complianceCase.caseId,
    status: complianceCase.status,
    decision: complianceCase.decision,
  });
}

/**
 * GET /kyc/audit/:customerId
 * Returns full audit trail for a customer.
 */
async function getAuditTrail(req: Request, res: Response): Promise<void> {
  const { customerId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 50;

  const logs = auditLogs
    .filter((l) => l.customerId === customerId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const total = logs.length;
  const paged = logs.slice((page - 1) * pageSize, page * pageSize);

  success(res, {
    items: paged,
    total,
    page,
    pageSize,
    hasNext: page * pageSize < total,
  });
}

// ─── Router Assembly ──────────────────────────────────────────

export function createKycRouter(): Router {
  const router = Router();

  router.use(requestLogger);

  // Sessions
  router.post("/sessions", createSession);
  router.get("/sessions/:id", getSession);
  router.get("/sessions/:id/questions", getQuestions);
  router.post("/sessions/:id/answers", submitAnswers);
  router.post("/sessions/:id/submit", submitSession);

  // Rules
  router.post("/rules/evaluate", evaluateRules);

  // Cases
  router.get("/cases", listCases);
  router.get("/cases/:id", getCase);
  router.post("/cases/:id/decision", recordCaseDecision);

  // Audit
  router.get("/audit/:customerId", getAuditTrail);

  return router;
}

// ─── Express app bootstrap example ───────────────────────────

/*
import express from "express";
const app = express();
app.use(express.json());
app.use("/kyc", createKycRouter());
app.listen(3001, () => console.log("KYC API running on :3001"));
*/
