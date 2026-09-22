# Tenure — Roadmap

Tenure is a local-first record of a person's employment history. Build it in small, usable phases: first make each employment a reliable home for records, then add structured pay tracking, and finally address commission reconciliation and conveniences. This is a delivery plan, not a fixed technical design.

## Phase 1 — Employment foundation

**Goal:** Open an employer and see the relevant employment relationship in one place.

- Create and edit people, employers, and employment periods; support current and former employments.
- Record start/end dates, current job title, status, and general notes.
- Make the employer/employment overview the main navigation surface, not separate global lists of files and paychecks.
- Keep past employments accessible after leaving a job; allow a separate employment period if someone rejoins an employer.

**Done when:** A household member can select an employer and find a persistent overview of that employment.

## Phase 2 — Documents and discussions

**Goal:** Preserve the evidence and context that currently live in scattered folders and inboxes.

- Upload and retrieve contracts, offer letters, employment letters, promotion or salary letters, and other employment-specific documents.
- Record important discussions with dates, participants when useful, and rich notes; optionally attach exported `.eml` files as linked documents.
- Keep documents and discussions as separate records under an employment; a document may optionally link to a discussion.
- Preserve the original uploaded file rather than replacing it with a note or extracted summary.

**Done when:** Important documents and discussions remain findable under the correct employment without relying on an employer portal or original inbox.

## Phase 3 — Paychecks, pay stubs, and pay-stub completeness

**Goal:** Keep a structured pay history backed by original pay stubs, and make it obvious what is still missing.

- Record pay date and the pay period the cheque covers (start and end dates). Pay date and pay period are distinct.
- Allow more than one paycheck for the same pay period when an employer issues multiple cheques (for example a correction, bonus, or separate run).
- Enter gross pay and itemized earnings and deductions (income tax, CPP, EI, and other lines from a fixed catalog). Configure which lines appear per employment, since employer pay-stub formats differ.
- Calculate net pay from the entered line items; do not allow net pay to be entered directly. A mismatch with the pay stub means a line item was entered incorrectly.
- Attach the original pay stub to its paycheck; allow a paycheck to exist while its stub is still missing.
- Display paychecks chronologically within an employment, with basic totals.
- Record pay frequency on each employment (weekly, biweekly, semi-monthly, monthly, or irregular) and derive expected pay periods from that schedule and the employment dates, including biweekly schedules.
- Show pay-stub completeness per employment: expected periods with no recorded paycheck, periods with one or more paychecks where any still lack a stub, current periods still waiting, and periods marked not applicable when no pay was issued.
- Surface missing pay stubs and missing paychecks on the employment overview, in a reviewable period view, and in a global review useful for monthly check-ins.

**Done when:** A person can enter and review each paycheck, reconcile calculated net pay against the stub, attach the original PDF, and see at a glance — per employment and across employments — which expected pay periods are complete, which recorded paychecks still need a stub, and which pay periods have no paycheck at all.

## Phase 4 — Compensation history

**Goal:** Show how agreed compensation changes over time, separately from actual paychecks.

- Record effective-dated annual salary or hourly rate, with an optional reason or note.
- Show a timeline and calculate dollar and percentage changes between comparable rates.
- Allow a supporting salary letter or other document to be linked to a change; reuse existing document-to-discussion links where helpful.
- Show the current agreed rate on the employment overview.
- Introduce only the basic details needed to describe a commission arrangement; refine commission-specific fields and calculations during implementation.

**Done when:** A person can see when their agreed pay changed and by how much without mistaking variable take-home pay for a salary change.

## Phase 5 — Commission tracking and reconciliation

**Goal:** Support the ongoing needs of commission-based employment, particularly a physiotherapy role, as a personal ledger rather than a clinic system.

- Describe the applicable compensation arrangement and effective dates, including a commission percentage or rule where known.
- Record available service/invoice references, service dates, and billed or collected amounts when useful for estimating commission.
- Compare expected commission with amounts actually reflected in pay, including insurer payments collected later.
- Surface unmatched, delayed, or missing payment information and explain differences without assuming every invoice has been collected.
- Account for known exceptions such as non-commissionable services, cancellations, and adjustments once actual employer rules are confirmed.
- Decide the minimum fields, calculation rules, and reconciliation workflow from real commission reports and pay stubs during implementation.

**Done when:** The user can investigate why an expected commission does or does not appear in a paycheck and retain the supporting references. Automated ClinicMaster or Payworks integration is **not** required.

## Phase 6 — Employment-record completeness and portability

**Goal:** Reduce recordkeeping gaps beyond pay stubs and make the archive useful beyond a single job.

- Identify expected but missing employment documents such as offer letters, employment agreements, contracts, and salary-change letters.
- Add simple reminders or review views for important employment records that are not pay stubs.
- Export or archive an employment's records and attachments together when leaving an employer.
- Improve summaries across paychecks and compensation changes without losing the employer-first navigation.

**Done when:** Missing non-pay-stub employment records are easy to spot and a complete employment history can be retained independently of Tenure's day-to-day UI.

## Later / only if needed

- Faster import of pay stubs or commission reports if manual entry becomes tedious.
- Optional Taxbook handoff of relevant earnings and deduction totals; Tenure remains the owner of paycheck details. No cross-app integration is required for Phase 3.
- More detailed role history, benefits, or professional-licensing records if their ownership and workflows become clear.
- Automatic payroll-portal downloads or email synchronization only if the value justifies the maintenance and security cost.

## Boundaries

- **Taxbook:** tax tracking and reporting based on relevant employment figures; avoid two independently maintained paycheck ledgers.
- **Passbook:** financial institutions, accounts, and general statements; employment pay stubs and letters stay in Tenure.
- **Not Tenure:** patient management, clinic scheduling, employer HR operations, payroll processing, or personal budgeting.
