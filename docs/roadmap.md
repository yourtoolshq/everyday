# Tenure — Roadmap

Tenure is a local-first record of a person's employment history. Build it in small, usable phases: first make each employment a reliable home for records, then add structured pay tracking, and finally address commission reconciliation and conveniences. This is a delivery plan, not a fixed technical design.

## Phase 1 — Employment foundation

**Goal:** Open an employer and see the relevant employment relationship in one place.

- Create and edit people, employers, and employment periods; support current and former employments.
- Record start/end dates, current job title, status, and general notes.
- Make the employer/employment overview the main navigation surface, not separate global lists of files and paychecks.
- Keep past employments accessible after leaving a job; allow a separate employment period if someone rejoins an employer.

**Done when:** A household member can select an employer and find a persistent overview of that employment.

## Phase 2 — Documents and correspondence

**Goal:** Preserve the evidence and context that currently live in scattered folders and inboxes.

- Upload and retrieve contracts, offer letters, employment letters, promotion or salary letters, and other employment-specific documents.
- Save important email exports and discussions with dates, participants when useful, and explanatory notes.
- Associate a record with its employment; optionally connect a letter or discussion to a role or compensation change later.
- Preserve the original uploaded file rather than replacing it with a note or extracted summary.

**Done when:** Important documents and discussions remain findable under the correct employment without relying on an employer portal or original inbox.

## Phase 3 — Paychecks and pay stubs

**Goal:** Keep a structured pay history backed by original pay stubs.

- Record pay date and pay-period start/end dates.
- Enter gross pay, itemized earnings, income tax, CPP, EI, other deductions, and net pay as shown on the stub.
- Attach the original pay stub to its paycheck; allow a paycheck to exist while its stub is still missing.
- Display paychecks chronologically within an employment, with basic totals and visible missing attachments.
- Keep the line-item model flexible enough for different employer pay-stub formats without attempting to process payroll.

**Done when:** A person can enter and review each paycheck and tell which recorded paychecks still need their original PDFs.

## Phase 4 — Compensation history

**Goal:** Show how agreed compensation changes over time, separately from actual paychecks.

- Record effective-dated annual salary or hourly rate, with an optional reason or note.
- Show a timeline and calculate dollar and percentage changes between comparable rates.
- Allow a supporting salary letter or other document to be linked to a change.
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

## Phase 6 — Completeness and portability

**Goal:** Reduce recordkeeping gaps and make the archive useful beyond a single job.

- Identify expected pay periods without a recorded paycheck when a pay schedule is known.
- Add simple reminders or review views for missing stubs and important employment records.
- Export or archive an employment's records and attachments together when leaving an employer.
- Improve summaries across paychecks and compensation changes without losing the employer-first navigation.

**Done when:** Missing records are easy to spot and a complete employment history can be retained independently of Tenure's day-to-day UI.

## Later / only if needed

- Faster import of pay stubs or commission reports if manual entry becomes tedious.
- Optional Taxbook handoff of relevant earnings and deduction totals; Tenure remains the owner of paycheck details.
- More detailed role history, benefits, or professional-licensing records if their ownership and workflows become clear.
- Automatic payroll-portal downloads or email synchronization only if the value justifies the maintenance and security cost.

## Boundaries

- **Taxbook:** tax tracking and reporting based on relevant employment figures; avoid two independently maintained paycheck ledgers.
- **Passbook:** financial institutions, accounts, and general statements; employment pay stubs and letters stay in Tenure.
- **Not Tenure:** patient management, clinic scheduling, employer HR operations, payroll processing, or personal budgeting.
