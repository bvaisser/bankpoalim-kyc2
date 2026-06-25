// ============================================================
// KYC Questionnaire – React Component
// Progressive one-question-per-screen UI, mobile-first.
// ============================================================

import React, { useState, useCallback, useMemo } from "react";
import {
  KycQuestion,
  QuestionType,
  KycDecisionType,
  RiskLevel,
  QuestionSection,
} from "../types/kyc.types";

// ─── Types ────────────────────────────────────────────────────

interface KycQuestionnaireProps {
  sessionId: string;
  customerId: string;
  customerName: string;
  questions: KycQuestion[];
  riskLevel: RiskLevel;
  onComplete: (answers: Record<string, AnswerValue>) => void;
  onError?: (error: string) => void;
}

type AnswerValue = string | string[] | boolean;

type ScreenType =
  | "welcome"
  | "question"
  | "review"
  | "submitting"
  | "success"
  | "exception"
  | "expired";

interface QuestionnaireState {
  screen: ScreenType;
  currentIndex: number;
  answers: Record<string, AnswerValue>;
  uploadedFiles: Record<string, File | null>;
  validationError: string | null;
  decisionType: KycDecisionType | null;
  submittedAt: string | null;
}

// ─── Progress Bar ─────────────────────────────────────────────

const ProgressBar: React.FC<{ current: number; total: number }> = ({
  current,
  total,
}) => {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="kyc-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="kyc-progress__bar" style={{ width: `${pct}%` }} />
      <span className="kyc-progress__label">
        {current} of {total}
      </span>
    </div>
  );
};

// ─── Section Header Label ─────────────────────────────────────

const SECTION_LABELS: Record<QuestionSection, string> = {
  [QuestionSection.IDENTITY_CONFIRMATION]: "Identity Confirmation",
  [QuestionSection.EMPLOYMENT]: "Employment",
  [QuestionSection.INCOME]: "Income",
  [QuestionSection.SOURCE_OF_FUNDS]: "Source of Funds",
  [QuestionSection.SOURCE_OF_WEALTH]: "Source of Wealth",
  [QuestionSection.ACTIVITY_EXPECTATIONS]: "Account Activity",
  [QuestionSection.INTERNATIONAL_ACTIVITY]: "International Activity",
  [QuestionSection.TAX_RESIDENCY]: "Tax Residency",
  [QuestionSection.FATCA]: "FATCA Declaration",
  [QuestionSection.CRS]: "CRS Declaration",
  [QuestionSection.PEP]: "PEP Declaration",
  [QuestionSection.BENEFICIAL_OWNERSHIP]: "Beneficial Ownership",
  [QuestionSection.EDD]: "Enhanced Due Diligence",
};

// ─── Single-Choice Question ───────────────────────────────────

const SingleChoiceQuestion: React.FC<{
  question: KycQuestion;
  value: string | undefined;
  onChange: (v: string) => void;
}> = ({ question, value, onChange }) => (
  <ul className="kyc-options" role="radiogroup" aria-labelledby={`q-${question.questionId}`}>
    {question.options?.map((opt) => (
      <li key={opt.value}>
        <button
          className={`kyc-option-btn ${value === opt.value ? "kyc-option-btn--selected" : ""} ${opt.isHighRisk ? "kyc-option-btn--high-risk" : ""}`}
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          type="button"
        >
          <span className="kyc-option-check" aria-hidden="true">
            {value === opt.value ? "●" : "○"}
          </span>
          {opt.label}
          {opt.isHighRisk && (
            <span className="kyc-option-badge" title="This option requires additional review">
              Requires Review
            </span>
          )}
        </button>
      </li>
    ))}
  </ul>
);

// ─── Multi-Choice Question ────────────────────────────────────

const MultiChoiceQuestion: React.FC<{
  question: KycQuestion;
  value: string[];
  onChange: (v: string[]) => void;
}> = ({ question, value, onChange }) => {
  const toggle = (optValue: string) => {
    const next = value.includes(optValue)
      ? value.filter((v) => v !== optValue)
      : [...value, optValue];
    onChange(next);
  };

  return (
    <ul className="kyc-options" role="group" aria-labelledby={`q-${question.questionId}`}>
      {question.options?.map((opt) => (
        <li key={opt.value}>
          <button
            className={`kyc-option-btn ${value.includes(opt.value) ? "kyc-option-btn--selected" : ""}`}
            role="checkbox"
            aria-checked={value.includes(opt.value)}
            onClick={() => toggle(opt.value)}
            type="button"
          >
            <span className="kyc-option-check" aria-hidden="true">
              {value.includes(opt.value) ? "☑" : "☐"}
            </span>
            {opt.label}
          </button>
        </li>
      ))}
    </ul>
  );
};

// ─── Yes/No Question ──────────────────────────────────────────

const YesNoQuestion: React.FC<{
  question: KycQuestion;
  value: string | undefined;
  onChange: (v: string) => void;
}> = ({ question, value, onChange }) => (
  <div className="kyc-yesno">
    {["YES", "NO"].map((opt) => {
      const label = question.options?.find((o) => o.value === opt)?.label ?? opt;
      return (
        <button
          key={opt}
          type="button"
          className={`kyc-yesno-btn ${value === opt ? "kyc-yesno-btn--selected" : ""}`}
          onClick={() => onChange(opt)}
          aria-pressed={value === opt}
        >
          {label}
        </button>
      );
    })}
  </div>
);

// ─── Text Input Question ──────────────────────────────────────

const TextQuestion: React.FC<{
  question: KycQuestion;
  value: string;
  onChange: (v: string) => void;
}> = ({ question, value, onChange }) => (
  <textarea
    className="kyc-textarea"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder="Type your answer here..."
    rows={4}
    maxLength={500}
    aria-labelledby={`q-${question.questionId}`}
  />
);

// ─── File Upload Question ─────────────────────────────────────

const FileUploadQuestion: React.FC<{
  question: KycQuestion;
  uploadedFile: File | null;
  onFileChange: (file: File | null) => void;
}> = ({ question, uploadedFile, onFileChange }) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const accepted = question.documentMeta?.acceptedFormats ?? ["PDF", "JPG", "PNG"];
  const maxMb = question.documentMeta?.maxSizeMb ?? 10;
  const acceptAttr = accepted
    .map((f) => ({ PDF: ".pdf", JPG: ".jpg,.jpeg", PNG: ".png" }[f] ?? `.${f.toLowerCase()}`))
    .join(",");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file && file.size > maxMb * 1024 * 1024) {
      onFileChange(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    onFileChange(file);
  };

  const formatBytes = (bytes: number) =>
    bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <div className="kyc-upload">
      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr}
        onChange={handleChange}
        className="kyc-upload__input"
        aria-hidden="true"
        tabIndex={-1}
      />
      {uploadedFile ? (
        <div className="kyc-upload__preview">
          <span className="kyc-upload__file-icon" aria-hidden="true">📄</span>
          <div className="kyc-upload__file-info">
            <span className="kyc-upload__file-name">{uploadedFile.name}</span>
            <span className="kyc-upload__file-size">{formatBytes(uploadedFile.size)}</span>
          </div>
          <button
            className="kyc-upload__remove"
            type="button"
            onClick={() => {
              onFileChange(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            aria-label="Remove uploaded file"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          className="kyc-upload__zone"
          type="button"
          onClick={() => inputRef.current?.click()}
        >
          <span className="kyc-upload__zone-icon" aria-hidden="true">📎</span>
          <span className="kyc-upload__zone-label">Tap to upload document</span>
          <span className="kyc-upload__zone-hint">
            {accepted.join(", ")} · Max {maxMb} MB
          </span>
        </button>
      )}
      {question.documentMeta?.examples && (
        <p className="kyc-upload__examples">Examples: {question.documentMeta.examples}</p>
      )}
    </div>
  );
};

// ─── Question Screen ──────────────────────────────────────────

const QuestionScreen: React.FC<{
  question: KycQuestion;
  currentIndex: number;
  totalVisible: number;
  value: AnswerValue | undefined;
  uploadedFile?: File | null;
  validationError: string | null;
  onAnswer: (v: AnswerValue) => void;
  onFileChange?: (file: File | null) => void;
  onBack: () => void;
  onNext: () => void;
  isFirst: boolean;
}> = ({
  question,
  currentIndex,
  totalVisible,
  value,
  uploadedFile,
  validationError,
  onAnswer,
  onFileChange,
  onBack,
  onNext,
  isFirst,
}) => {
  const renderInput = () => {
    switch (question.type) {
      case QuestionType.YES_NO:
        return (
          <YesNoQuestion
            question={question}
            value={value as string | undefined}
            onChange={onAnswer}
          />
        );
      case QuestionType.SINGLE_CHOICE:
      case QuestionType.NUMERIC_RANGE:
      case QuestionType.DECLARATION:
      case QuestionType.COUNTRY_SELECT:
        return (
          <SingleChoiceQuestion
            question={question}
            value={value as string | undefined}
            onChange={onAnswer}
          />
        );
      case QuestionType.MULTI_CHOICE:
        return (
          <MultiChoiceQuestion
            question={question}
            value={(value as string[]) ?? []}
            onChange={onAnswer}
          />
        );
      case QuestionType.TEXT:
        return (
          <TextQuestion
            question={question}
            value={(value as string) ?? ""}
            onChange={onAnswer}
          />
        );
      case QuestionType.FILE_UPLOAD:
        return (
          <FileUploadQuestion
            question={question}
            uploadedFile={uploadedFile ?? null}
            onFileChange={onFileChange ?? (() => {})}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="kyc-screen kyc-screen--question">
      <ProgressBar current={currentIndex + 1} total={totalVisible} />
      <div className="kyc-section-tag">{SECTION_LABELS[question.section]}</div>
      <h2
        className="kyc-question-text"
        id={`q-${question.questionId}`}
      >
        {question.text}
        {question.isMandatory && (
          <span className="kyc-mandatory" aria-label="Mandatory field">
            {" "}*
          </span>
        )}
      </h2>
      {question.helpText && (
        <p className="kyc-help-text">{question.helpText}</p>
      )}
      {renderInput()}
      {validationError && (
        <p className="kyc-error" role="alert">
          {validationError}
        </p>
      )}
      <div className="kyc-nav">
        {!isFirst && (
          <button className="kyc-btn kyc-btn--secondary" onClick={onBack} type="button">
            ← Back
          </button>
        )}
        <button
          className="kyc-btn kyc-btn--primary"
          onClick={onNext}
          type="button"
          disabled={question.isRequired && !value}
        >
          {currentIndex + 1 === totalVisible ? "Review Answers" : "Continue →"}
        </button>
      </div>
    </div>
  );
};

// ─── Review Screen ────────────────────────────────────────────

const ReviewScreen: React.FC<{
  questions: KycQuestion[];
  answers: Record<string, AnswerValue>;
  onEdit: (index: number) => void;
  onSubmit: () => void;
  onBack: () => void;
}> = ({ questions, answers, onEdit, onSubmit, onBack }) => (
  <div className="kyc-screen kyc-screen--review">
    <h2 className="kyc-screen__title">Review Your Answers</h2>
    <p className="kyc-screen__subtitle">
      Please review the information below before submitting.
    </p>
    <ul className="kyc-review-list">
      {questions.map((q, i) => {
        const val = answers[q.questionId];
        if (val === undefined) return null;
        const displayVal = Array.isArray(val) ? val.join(", ") : String(val);
        const isUpload = q.type === QuestionType.FILE_UPLOAD;
        const optionLabel = isUpload
          ? displayVal
          : (q.options?.find((o) => o.value === displayVal)?.label ?? displayVal);

        return (
          <li key={q.questionId} className="kyc-review-item">
            <div className="kyc-review-item__question">{q.text}</div>
            <div className="kyc-review-item__answer">
              {isUpload && <span className="kyc-review-item__file-icon" aria-hidden="true">📄 </span>}
              {optionLabel}
            </div>
            <button
              className="kyc-review-item__edit"
              onClick={() => onEdit(i)}
              type="button"
              aria-label={`Edit answer for: ${q.text}`}
            >
              Edit
            </button>
          </li>
        );
      })}
    </ul>
    <div className="kyc-review-declaration">
      <p>
        By submitting, I declare that all information provided is accurate and
        complete to the best of my knowledge. I understand that providing false
        information may have legal consequences.
      </p>
    </div>
    <div className="kyc-nav">
      <button className="kyc-btn kyc-btn--secondary" onClick={onBack} type="button">
        ← Back
      </button>
      <button className="kyc-btn kyc-btn--submit" onClick={onSubmit} type="button">
        Submit Declaration
      </button>
    </div>
  </div>
);

// ─── Status Screens ───────────────────────────────────────────

const SuccessScreen: React.FC<{ submittedAt: string }> = ({ submittedAt }) => (
  <div className="kyc-screen kyc-screen--success">
    <div className="kyc-status-icon kyc-status-icon--success" aria-hidden="true">
      ✓
    </div>
    <h2 className="kyc-screen__title">KYC Update Complete</h2>
    <p className="kyc-screen__subtitle">
      Thank you. Your information has been verified and updated successfully.
    </p>
    <div className="kyc-detail-box">
      <div className="kyc-detail-row">
        <span>Status</span>
        <span className="kyc-status-chip kyc-status-chip--green">Approved</span>
      </div>
      <div className="kyc-detail-row">
        <span>Submitted</span>
        <span>{new Date(submittedAt).toLocaleString()}</span>
      </div>
      <div className="kyc-detail-row">
        <span>Valid Until</span>
        <span>
          {new Date(
            Date.now() + 365 * 24 * 60 * 60 * 1000,
          ).toLocaleDateString()}
        </span>
      </div>
    </div>
    <p className="kyc-footnote">
      A confirmation has been sent to your registered contact details.
    </p>
  </div>
);

const ExceptionScreen: React.FC<{ decisionType: KycDecisionType }> = ({
  decisionType,
}) => {
  const messages: Record<KycDecisionType, { title: string; body: string; chipClass: string }> = {
    [KycDecisionType.LIGHT_REVIEW]: {
      title: "Under Review",
      body: "Your information is being reviewed by our compliance team. This typically takes up to 48 hours. You will be notified when complete.",
      chipClass: "kyc-status-chip--amber",
    },
    [KycDecisionType.FULL_COMPLIANCE_REVIEW]: {
      title: "Additional Review Required",
      body: "Our compliance team requires additional information to complete your KYC update. A compliance officer will contact you within 24 hours.",
      chipClass: "kyc-status-chip--orange",
    },
    [KycDecisionType.REJECT_OR_RESTRICT]: {
      title: "Account Action Required",
      body: "We are unable to automatically complete your KYC update at this time. Please visit your nearest branch or contact our compliance team directly.",
      chipClass: "kyc-status-chip--red",
    },
    [KycDecisionType.AUTO_COMPLETE]: {
      title: "Auto Complete",
      body: "",
      chipClass: "",
    },
  };

  const msg = messages[decisionType];
  return (
    <div className="kyc-screen kyc-screen--exception">
      <div className="kyc-status-icon kyc-status-icon--review" aria-hidden="true">
        ⚑
      </div>
      <h2 className="kyc-screen__title">{msg.title}</h2>
      <span className={`kyc-status-chip ${msg.chipClass}`}>{decisionType.replace(/_/g, " ")}</span>
      <p className="kyc-screen__subtitle">{msg.body}</p>
      <div className="kyc-contact-box">
        <p>
          <strong>KYC Compliance Hotline:</strong> *4500
        </p>
        <p>
          <strong>Email:</strong> compliance@bank.co.il
        </p>
      </div>
    </div>
  );
};

const WelcomeScreen: React.FC<{
  customerName: string;
  questionCount: number;
  riskLevel: RiskLevel;
  onStart: () => void;
}> = ({ customerName, questionCount, riskLevel, onStart }) => {
  const estimatedMinutes = Math.ceil(questionCount * 0.2);
  return (
    <div className="kyc-screen kyc-screen--welcome">
      <div className="kyc-bank-logo" aria-hidden="true">🏦</div>
      <h1 className="kyc-screen__title">KYC Update Required</h1>
      <p className="kyc-screen__subtitle">Hello, {customerName}</p>
      <div className="kyc-info-box">
        <p>
          To maintain your account and comply with banking regulations, we need
          to verify and update your information.
        </p>
        <ul className="kyc-checklist">
          <li>Estimated time: ~{estimatedMinutes} minute{estimatedMinutes !== 1 ? "s" : ""}</li>
          <li>{questionCount} questions to answer</li>
          <li>Your data is encrypted and secure</li>
          <li>All answers are confidential</li>
        </ul>
      </div>
      <div className="kyc-legal-note">
        <p>
          This process is required under the Prevention of Money Laundering Law
          (2000) and Bank of Israel regulations.
        </p>
      </div>
      <button className="kyc-btn kyc-btn--primary kyc-btn--full" onClick={onStart} type="button">
        Start KYC Update
      </button>
    </div>
  );
};

// ─── Answer Validation ────────────────────────────────────────

function validateAnswer(question: KycQuestion, value: AnswerValue | undefined): string | null {
  if (question.type === QuestionType.FILE_UPLOAD) {
    if (question.isRequired && (!value || value === "")) {
      return "Please upload the required document before continuing.";
    }
    return null;
  }
  if (question.isRequired && (value === undefined || value === "" || (Array.isArray(value) && value.length === 0))) {
    return "This question is required. Please select an answer before continuing.";
  }
  if (question.type === QuestionType.TEXT && typeof value === "string") {
    if (value.length < 3) return "Please provide a more detailed answer (at least 3 characters).";
  }
  return null;
}

// ─── Conditional question filtering ──────────────────────────

function filterVisibleQuestions(
  questions: KycQuestion[],
  answers: Record<string, AnswerValue>,
): KycQuestion[] {
  return questions.filter((q) => {
    if (!q.displayConditions || q.displayConditions.length === 0) return true;
    return q.displayConditions.every((cond) => {
      const answerVal = answers[cond.questionId];
      if (answerVal === undefined) return false;
      if (cond.operator === "equals") return String(answerVal) === cond.value;
      if (cond.operator === "not_equals") return String(answerVal) !== cond.value;
      if (cond.operator === "in" && Array.isArray(cond.value)) {
        return (cond.value as string[]).includes(String(answerVal));
      }
      return true;
    });
  });
}

// ─── Main Component ───────────────────────────────────────────

export const KycQuestionnaire: React.FC<KycQuestionnaireProps> = ({
  sessionId,
  customerId,
  customerName,
  questions: allQuestions,
  riskLevel,
  onComplete,
  onError,
}) => {
  const [state, setState] = useState<QuestionnaireState>({
    screen: "welcome",
    currentIndex: 0,
    answers: {},
    uploadedFiles: {},
    validationError: null,
    decisionType: null,
    submittedAt: null,
  });

  const visibleQuestions = useMemo(
    () => filterVisibleQuestions(allQuestions, state.answers),
    [allQuestions, state.answers],
  );

  const currentQuestion = visibleQuestions[state.currentIndex];

  const handleStart = useCallback(() => {
    setState((s) => ({ ...s, screen: "question", currentIndex: 0 }));
  }, []);

  const handleAnswer = useCallback((value: AnswerValue) => {
    if (!currentQuestion) return;
    setState((s) => ({
      ...s,
      validationError: null,
      answers: { ...s.answers, [currentQuestion.questionId]: value },
    }));
  }, [currentQuestion]);

  const handleFileChange = useCallback((file: File | null) => {
    if (!currentQuestion) return;
    const qId = currentQuestion.questionId;
    setState((s) => {
      const nextAnswers = { ...s.answers };
      if (file) {
        nextAnswers[qId] = file.name;
      } else {
        delete nextAnswers[qId];
      }
      return {
        ...s,
        uploadedFiles: { ...s.uploadedFiles, [qId]: file },
        answers: nextAnswers,
        validationError: null,
      };
    });
  }, [currentQuestion]);

  const handleNext = useCallback(() => {
    if (!currentQuestion) return;
    const current = state.answers[currentQuestion.questionId];
    const error = validateAnswer(currentQuestion, current);
    if (error) {
      setState((s) => ({ ...s, validationError: error }));
      return;
    }

    if (state.currentIndex + 1 >= visibleQuestions.length) {
      setState((s) => ({ ...s, screen: "review", validationError: null }));
    } else {
      setState((s) => ({
        ...s,
        currentIndex: s.currentIndex + 1,
        validationError: null,
      }));
    }
  }, [currentQuestion, state.answers, state.currentIndex, visibleQuestions.length]);

  const handleBack = useCallback(() => {
    if (state.screen === "review") {
      setState((s) => ({
        ...s,
        screen: "question",
        currentIndex: visibleQuestions.length - 1,
      }));
    } else if (state.currentIndex > 0) {
      setState((s) => ({
        ...s,
        currentIndex: s.currentIndex - 1,
        validationError: null,
      }));
    }
  }, [state.screen, state.currentIndex, visibleQuestions.length]);

  const handleEditFromReview = useCallback((index: number) => {
    setState((s) => ({ ...s, screen: "question", currentIndex: index }));
  }, []);

  const handleSubmit = useCallback(async () => {
    setState((s) => ({ ...s, screen: "submitting" }));
    try {
      // Simulate API call – replace with actual fetch in production
      await new Promise<void>((resolve) => setTimeout(resolve, 1500));
      const now = new Date().toISOString();

      // LOW risk with no flags → auto-complete
      const decisionType =
        riskLevel === RiskLevel.LOW
          ? KycDecisionType.AUTO_COMPLETE
          : KycDecisionType.LIGHT_REVIEW;

      setState((s) => ({
        ...s,
        screen: decisionType === KycDecisionType.AUTO_COMPLETE ? "success" : "exception",
        decisionType,
        submittedAt: now,
      }));
      onComplete(state.answers);
    } catch (err) {
      setState((s) => ({ ...s, screen: "question" }));
      onError?.("Submission failed. Please try again.");
    }
  }, [riskLevel, state.answers, onComplete, onError]);

  // ─── Render ────────────────────────────────────────────────

  if (state.screen === "welcome") {
    return (
      <div className="kyc-wrapper">
        <WelcomeScreen
          customerName={customerName}
          questionCount={visibleQuestions.length}
          riskLevel={riskLevel}
          onStart={handleStart}
        />
      </div>
    );
  }

  if (state.screen === "question" && currentQuestion) {
    return (
      <div className="kyc-wrapper">
        <QuestionScreen
          question={currentQuestion}
          currentIndex={state.currentIndex}
          totalVisible={visibleQuestions.length}
          value={state.answers[currentQuestion.questionId]}
          uploadedFile={state.uploadedFiles[currentQuestion.questionId]}
          validationError={state.validationError}
          onAnswer={handleAnswer}
          onFileChange={handleFileChange}
          onBack={handleBack}
          onNext={handleNext}
          isFirst={state.currentIndex === 0}
        />
      </div>
    );
  }

  if (state.screen === "review") {
    return (
      <div className="kyc-wrapper">
        <ReviewScreen
          questions={visibleQuestions}
          answers={state.answers}
          onEdit={handleEditFromReview}
          onSubmit={handleSubmit}
          onBack={handleBack}
        />
      </div>
    );
  }

  if (state.screen === "submitting") {
    return (
      <div className="kyc-wrapper">
        <div className="kyc-screen kyc-screen--loading">
          <div className="kyc-spinner" aria-label="Processing" />
          <p>Submitting your information securely...</p>
        </div>
      </div>
    );
  }

  if (state.screen === "success" && state.submittedAt) {
    return (
      <div className="kyc-wrapper">
        <SuccessScreen submittedAt={state.submittedAt} />
      </div>
    );
  }

  if (state.screen === "exception" && state.decisionType) {
    return (
      <div className="kyc-wrapper">
        <ExceptionScreen decisionType={state.decisionType} />
      </div>
    );
  }

  return null;
};

export default KycQuestionnaire;
