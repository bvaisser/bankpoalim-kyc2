# KYC System – Bank Poalim

A bank-grade Know Your Customer (KYC) platform compliant with AML/CFT, FATCA, CRS, and PEP regulations. Built with TypeScript (React frontend + Node.js/Express backend) and a standalone HTML/JS operations dashboard.

**Regulatory basis:** Israel's Prevention of Money Laundering Law (2000) and Bank of Israel regulations.

---

## System Components

| Component | File(s) | Purpose |
| --- | --- | --- |
| TypeScript types | `src/types/kyc.types.ts` | All interfaces, enums, and API contracts |
| Rule engine | `src/services/kycRuleEngine.ts` | Risk scoring, flag detection, automated decision |
| Questionnaire builder | `src/services/questionnaireBuilder.ts` | Dynamic, risk-aware question set generation |
| API routes | `src/api/kycRoutes.ts` | Express handlers, session lifecycle, compliance cases |
| Customer UI | `src/components/KycQuestionnaire.tsx` | React questionnaire (one question per screen) |
| Customer demo | `public/kyc-demo.html` + `kyc-demo.css` | Interactive bilingual KYC form demo |
| Operations dashboard | `public/kyc-dashboard.html` | Admin notification management and response tracking |

---

## End-to-End KYC Process

### 1. Trigger

A KYC session is initiated by one of 13 trigger types:

| Trigger | Example |
| --- | --- |
| `PERIODIC_REFRESH` | Annual review cycle |
| `RISK_BASED_REVIEW` | Risk score crossed a threshold |
| `PROFILE_CHANGE` | Address or employment update detected |
| `UNUSUAL_ACTIVITY` | Transaction pattern alert from AML system |
| `FATCA_CRS_MISSING` | Missing tax residency declaration |
| `PEP_STATUS_CHANGE` | Screening system flagged possible PEP |
| `SANCTIONS_INDICATOR` | Sanctions list match |
| ... | _(see `KycTriggerType` enum for all 13)_ |

### 2. Customer Notification

Before the questionnaire is presented, the customer is notified across up to five channels:

| Channel | Delivery tracking | Open tracking |
| --- | --- | --- |
| Mail | ✓ Delivered / ✗ Failed | 👁 Link clicked |
| SMS | ✓ Delivered / ✗ Failed | 👁 Link clicked |
| WhatsApp | ✓ Delivered / ✗ Failed | 👁 Read receipt |
| Website | ✓ Banner shown | 👁 Customer viewed |
| App | ✓ Push delivered | 👁 Notification tapped |

The operations dashboard tracks delivery and open status per customer per channel in real time.

### 3. Language Selection

The first screen the customer sees is a bilingual language selector (🇮🇱 עברית / 🇬🇧 English). The entire questionnaire, validation messages, result screens, and document upload UI are then rendered in the chosen language with full RTL support for Hebrew.

### 4. Session Creation

`POST /kyc/sessions`

The backend creates a `KycSession` record with a 48-hour expiry, linked to the customer and trigger. Authentication methods: session token, MFA OTP, biometrics, or step-up auth.

### 5. Questionnaire Build

`GET /kyc/sessions/:id/questions`

The `questionnaireBuilder` service dynamically generates a minimal, ordered question set based on:

- **Customer risk level** (LOW / MEDIUM / HIGH / VERY_HIGH) — higher risk = more questions
- **Trigger type** — e.g. `EMPLOYMENT_CHANGE` pushes employment questions to the front; `FATCA_CRS_MISSING` forces the tax section in regardless of risk
- **Existing profile data** — pre-fills known answers; skips FATCA/CRS if no foreign tax residency; fast-tracks LOW-risk returning customers to a 7-question minimal set

**Question sections** (in order):

1. Identity Confirmation
2. Employment
3. Income & Source of Income
4. Source of Funds
5. Source of Wealth _(HIGH/VERY_HIGH only)_
6. Account Activity Expectations
7. International Activity
8. Tax Residency / FATCA / CRS
9. PEP Declaration
10. Beneficial Ownership _(HIGH/VERY_HIGH only)_
11. Enhanced Due Diligence _(HIGH/VERY_HIGH only)_
12. Supporting Documents _(MEDIUM+ risk — see below)_

### 6. Document Upload

Certain risk levels and answer combinations require the customer to upload supporting documents directly in the questionnaire:

| Document | Trigger condition | Risk levels |
| --- | --- | --- |
| Income proof (salary slip / bank statement) | Always required | MEDIUM, HIGH, VERY_HIGH |
| Passport or national ID (both sides) | Always required | HIGH, VERY_HIGH |
| Source of funds evidence | Source declared as Inheritance / Real Estate / Loan / Gift / Other | HIGH, VERY_HIGH |
| Business registration certificate | Employment is Business Owner or Self-Employed | HIGH, VERY_HIGH |

Accepted formats: PDF, JPG, PNG — max 10 MB each. The upload zone shows a file preview (name + size) after selection and allows removal before submission.

### 7. Rule Engine Evaluation

`POST /kyc/sessions/:id/submit`

After the customer finalises, the `kycRuleEngine` evaluates all answers. The base risk score comes from the customer's existing risk level, then adjusted by:

| Rule | Score impact | Flag type |
| --- | --- | --- |
| Sanctions match | +35 | HARD |
| PEP declared | +25 | HARD |
| Material income/activity mismatch (≥2 bands) | +25 | HARD |
| High-risk country exposure | +20 | HARD |
| Unknown/undeclared source of funds | +20 | HARD |
| Conflicting FATCA/CRS declaration | +15 | HARD |
| Minor income/activity mismatch (1 band) | +8 | SOFT |
| Employment change declared | +5 | SOFT |
| International activity declared | +5 | SOFT |
| Foreign tax residency (confirmed) | +5 | SOFT |

Final score is capped at 100. Score bands: 0–25 → LOW · 26–55 → MEDIUM · 56–80 → HIGH · 81–100 → VERY_HIGH.

### 8. Automated Decision

| Decision | Condition | SLA |
| --- | --- | --- |
| `AUTO_COMPLETE` | LOW/MEDIUM risk, no hard flags, ≤1 soft flag | Instant |
| `LIGHT_REVIEW` | ≥2 soft flags, or MEDIUM + 1 soft flag | 24–48 hrs |
| `FULL_COMPLIANCE_REVIEW` | Any hard flag (excluding sanctions) | 8–24 hrs |
| `REJECT_OR_RESTRICT` | Sanctions match | 4 hrs |

### 9. Compliance Case

For `FULL_COMPLIANCE_REVIEW` and `REJECT_OR_RESTRICT` decisions a `ComplianceCase` is created automatically:

| Risk level | Priority | SLA |
| --- | --- | --- |
| VERY_HIGH | CRITICAL | 4 hours |
| HIGH | HIGH | 8 hours |
| MEDIUM | MEDIUM | 24 hours |
| LOW | LOW | 48 hours |

Analysts interact via `GET /kyc/cases`, `GET /kyc/cases/:id`, and `POST /kyc/cases/:id/decision`.

### 10. Customer Result Screen

- **Success** — auto-completed, valid for 1 year
- **Under Review** — light or full review in progress
- **Account Action Required** — restrictions applied, branch/compliance contact provided

---

## Operations Dashboard (`kyc-dashboard.html`)

A standalone admin dashboard with four sections accessible from a sidebar:

### Dashboard

- Six stat cards: total customers notified + one per channel (Mail, SMS, WhatsApp, Website, App), each showing delivered count, delivery rate, and open rate.
- Notification table — per customer, per channel delivery bubble (✓ Delivered / 👁 Opened / ⏳ Pending / ✗ Failed / —) and a consolidated "Opened" column showing how many channels the customer actually opened.
- Filters: search by name/ID, filter by channel, delivery status, or KYC status.

### Upload & Send

1. **Upload** — drag-and-drop or click to upload a CSV of customer details. Download a sample CSV for the required format.
2. **Validation Agent** — animates through each row checking name, national ID, email format, and phone format. Shows ✅ / ⚠️ / ❌ per row with specific error messages.
3. **Channel selector** — toggle each of the five channels before sending.
4. **Live sending progress** — per-customer, per-channel animated status bubbles (Sending → Sent / Failed).
5. New notifications are immediately appended to the dashboard table.

### Responses

Tracks whether customers have submitted their KYC questionnaire and whether they sent any questions or comments.

| Tab | Content |
| --- | --- |
| All | Every notified customer |
| Responded | Customers who submitted KYC |
| Pending | Customers who have not yet responded |
| Has Question | Customers who sent a question or comment |
| Doc Review | Customers with documents that need review |

**Clicking any row opens a sliding detail panel with three tabs:**

- **🤖 Auto-Reply** — the customer's question is shown as a chat bubble. The auto-response agent composes a contextual reply based on KYC domain knowledge. Admin can Approve (locks the reply as sent) or Override (removes it for manual response).
- **📋 Documents** — the Document Validation Agent analyses each uploaded file: detects document type, extracts key fields (name, employer, date, amount, expiry), cross-checks against the customer's declared data, and issues a verdict (✅ Valid / ⚠️ Needs review / ❌ Invalid) with a plain-language reason.
- **📝 Answers** — a grid of the customer's KYC questionnaire answers (employment, income, activity, international transfers, tax residency, source of funds, PEP status).

### Settings

- **Resend Interval** — set how many days after the original send to re-notify non-responding customers (1 / 3 / 7 / 14 / custom days).
- **Max resends** — stop after N attempts (1–10).
- **Send time** — preferred time of day for automated resends (within bank hours).
- **Upcoming schedule** — live preview of the next three resend batches with customer counts and timing badges.
- **Send Now** — immediately triggers a resend for all pending customers and logs it to the Resend Log.
- **Resend Log** — history of all past resend batches.

All dashboard text is fully bilingual (English / Hebrew) with RTL layout support toggled from the sidebar.

---

## CSV Upload Format

```csv
name,national_id,email,phone,risk_level
Yael Rosenthal,IL-112233,yael.r@example.com,+972501112233,LOW
Gideon Bar-Lev,IL-445566,gideon.bl@gmail.com,+972529988776,MEDIUM
```

| Column | Required | Notes |
| --- | --- | --- |
| `name` | Yes | Full customer name (min 2 chars) |
| `national_id` | Yes | National ID number |
| `email` | Yes for Mail channel | Must be a valid email address |
| `phone` | Yes for SMS / WhatsApp | International format (+972…) |
| `risk_level` | No | LOW / MEDIUM / HIGH — defaults to LOW |

---

## API Reference

| Method | Path | Description |
| --- | --- | --- |
| POST | `/kyc/sessions` | Create a new KYC session |
| GET | `/kyc/sessions/:id` | Get session state |
| GET | `/kyc/sessions/:id/questions` | Get questionnaire for this session |
| POST | `/kyc/sessions/:id/answers` | Save answers (incremental) |
| POST | `/kyc/sessions/:id/submit` | Finalise and run rule engine |
| POST | `/kyc/rules/evaluate` | Standalone rule engine evaluation |
| GET | `/kyc/cases` | List compliance cases (paginated) |
| GET | `/kyc/cases/:id` | Get case with audit trail |
| POST | `/kyc/cases/:id/decision` | Record analyst decision |
| GET | `/kyc/audit/:customerId` | Full audit log for a customer |

All responses use the `ApiResponse<T>` envelope: `{ success, data, error, requestId, timestamp }`.

---

## Project Structure

```text
kyc2/
├── src/
│   ├── types/
│   │   └── kyc.types.ts              # Interfaces, enums, API contracts (FILE_UPLOAD type, documentMeta)
│   ├── services/
│   │   ├── kycRuleEngine.ts          # Risk scoring, flag detection, decision logic
│   │   └── questionnaireBuilder.ts   # Dynamic question set + 4 document upload questions
│   ├── api/
│   │   └── kycRoutes.ts              # Express handlers, session lifecycle, compliance cases
│   └── components/
│       └── KycQuestionnaire.tsx      # React UI — one question per screen, file upload, bilingual
└── public/
    ├── kyc-demo.html                 # Customer-facing KYC form demo (bilingual, RTL, document upload)
    ├── kyc-demo.css                  # KYC form stylesheet (includes upload zone and RTL overrides)
    └── kyc-dashboard.html            # Operations dashboard (notifications, responses, agents, settings)
```

---

## Data & Audit

Every significant action writes an immutable `AuditLog` entry with actor, channel, IP address, and correlation ID. The trail is retrievable per customer (`GET /kyc/audit/:customerId`) and per compliance case, satisfying regulatory audit requirements.
