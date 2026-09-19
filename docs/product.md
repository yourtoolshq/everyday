# Tenure — Product

Tenure is a local-first place to keep the history of your employment: what you were paid, how your compensation changed, and the documents and conversations worth preserving. It is for individuals and households keeping their own records, not employers managing staff.

## The problem

Employment records end up scattered across payroll portals, inboxes, downloads, and folders. Pay stubs are easy to miss, important discussions can disappear when access to an account ends, and salary changes are hard to see across years. Tenure keeps those records together under the employer they belong to.

## Product principles

- **Employer first.** Open an employer to find its pay history, compensation, documents, and discussions. Avoid making users navigate separate global document libraries.
- **Keep the originals.** Preserve pay stubs, letters, and exported emails alongside any structured entries or notes.
- **Record facts; derive summaries.** Enter the agreed pay rate and actual paychecks separately. Calculate comparable changes and totals from those records.
- **Useful without integrations.** Manual entry and local file uploads must be sufficient. Automatic collection can come later.
- **Small and personal.** Do not build a payroll processor, HR platform, or general-purpose document manager.

## MVP

| Area | What the user can do |
| --- | --- |
| Employment | Create an employer and record a person's employment period, status, and current role. Return to that employer for all related records. |
| Paychecks | Record pay dates and periods; enter gross pay, itemized earnings and deductions (including tax, CPP, and EI), and net pay; attach the original pay stub. |
| Compensation | Record effective-dated salary or hourly-rate changes; view a timeline and dollar/percentage changes between comparable rates. |
| Documents | Upload and organize contracts, offer letters, employment letters, and other official records under an employment. |
| Discussions | Record important conversations, meetings, and email context with dates, participants, and notes. |

## Main workflow

1. Choose the person and employer.
2. Open that employment's overview to see its current details and recent records.
3. Add a paycheck, compensation change, document, or discussion as it occurs.
4. Review pay history and check which paychecks still need their original stubs attached.
5. Retain the employment and its records after leaving the employer.

## What success looks like

- An employer's important records are findable from one place.
- Every entered paycheck can be checked against its original stub, and missing attachments are visible.
- A person can understand how their agreed compensation changed over time without confusing it with variable take-home pay.
- Important employment discussions remain available independently of the original inbox or payroll portal.

## Outside the MVP

Automatic payroll-portal downloads, email sync, commission reconciliation, detailed benefits or professional-licensing management, and advanced analytics. These are potential later features, not prerequisites for a useful first version.

## Related apps

Tenure is the source of detailed employment and paycheck records. Taxbook may use relevant earnings and deduction totals for taxes; Passbook remains the home for financial accounts and statements. See [domain.md](domain.md) for concepts, relationships, and ownership rules.
