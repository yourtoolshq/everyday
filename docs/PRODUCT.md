# Product

## What Passbook is

Passbook is a self-hosted app for managing household financial accounts and the records associated with them.

The core problem is not file storage. It is knowing whether the household's financial records are complete.

Passbook should make it easy to answer:

- What accounts do we have or have we had?
- Who owns each account?
- Is the account active or closed?
- How often should this account produce a statement?
- Which statement periods are complete?
- Which statements are missing?
- What other important documents belong to this account?

## Why this exists

A folder system can store statements, but it does not know what is missing.

A spreadsheet can track expected statements, but then the spreadsheet and the actual files have to be maintained separately.

Passbook combines those concerns around the account itself.

Instead of manually maintaining a checklist such as:

```text
January   ✓
February  ✓
March     ✕
April     ✓
```

the user defines the account and its statement schedule once. Passbook determines which periods should exist and whether a statement has been recorded for each one.

## Product goal

The first meaningful version should answer one question very well:

> Which financial statements am I missing?

Everything in the initial product should support that outcome.

## Main workflows

### Keep an account inventory

Create financial institutions and the accounts held with them.

An account may include:

- institution;
- display name;
- account type;
- one or more household owners;
- optional account identifier suffix;
- opened date;
- closed date;
- active or closed status;
- notes.

Closed accounts remain part of the historical record.

### Define expected statements

Each account can define how often statements are expected.

Initial options:

- monthly;
- quarterly;
- annually;
- irregular;
- none.

The user should not manually create every expected month or quarter.

Passbook derives the expected periods from the account configuration.

### Add statements

Adding a statement should be quick.

A typical flow should be close to:

```text
Upload PDF
Choose account
Choose statement period
Save
```

The app should infer everything it already knows from the account, such as institution and ownership.

### Find missing records

Passbook should clearly surface incomplete account histories.

For example:

```text
Momentum Visa
2026

Jan  ✓
Feb  ✓
Mar  Missing
Apr  ✓
May  ✓
Jun  ✓
Jul  Missing
Aug  ✓
```

The app should also distinguish between:

- a statement that is genuinely missing;
- a statement that is not expected to be available yet;
- a future period.

### Keep other account documents

Accounts can also hold non-recurring records such as:

- account agreements;
- opening documents;
- closure documents;
- interest-rate notices;
- fee changes;
- correspondence;
- financing documents;
- other account-level records.

These records do not need to participate in statement completeness tracking.

## What belongs in Passbook

Passbook owns records whose primary meaning comes from a financial account or financial obligation.

Examples include:

- bank accounts;
- credit cards;
- lines of credit;
- investment accounts;
- registered accounts;
- mortgages;
- loans;
- financing accounts;
- similar account-based financial relationships.

The important question is not whether money is involved.

The question is:

> Is this fundamentally a financial account or ongoing financial relationship?

## What does not belong in Passbook

Passbook should not become the new version of a generic `Finance` folder.

Records should live with the domain that gives them meaning.

Examples:

```text
Property maintenance invoice
→ property/home app

Vehicle insurance policy
→ Garage

Payslip
→ employment app

Professional liability insurance
→ employment/professional app

Medical receipt
→ First Aid

Tax slip
→ Taxbook

TV receipt and warranty
→ household item / property app
```

Passbook may still reference or integrate with those domains later, but it should not duplicate ownership of their records.

## Receipts

Passbook is not intended to be a generic receipt archive.

Receipts should generally live where they remain useful.

For example:

- a household purchase receipt belongs with the item;
- a medical receipt belongs with the healthcare workflow;
- a professional expense receipt belongs with the professional/employment workflow;
- a transaction receipt may eventually belong in a budgeting app.

If a receipt is directly part of an account-level financial record, it may belong in Passbook.

Otherwise, it should stay with the relevant domain.

## Relationship to budgeting

Passbook is not initially a YNAB or Actual Budget replacement.

A future budgeting app may manage:

- transactions;
- categories;
- budgets;
- cash-flow planning;
- transaction imports;
- transaction receipts.

Passbook and budgeting may eventually share or reference the same financial accounts, but they answer different questions.

Passbook asks:

> What financial relationships exist, and are their records complete?

Budgeting asks:

> What money moved, and how should it be planned or categorized?

## Relationship to other Your Tools apps

Passbook should fit cleanly alongside the other apps rather than absorbing their responsibilities.

Examples:

- Taxbook owns tax records and filing workflows.
- First Aid owns health-related records, expenses, and claims.
- Employment owns employers, contracts, payslips, compensation, and professional records.
- Garage owns vehicles and vehicle-specific documents.
- A property/home app owns homes, rentals, maintenance, improvements, appliances, and household items.
- A future budgeting app owns transactions and budgets.

Cross-app references can be added when they solve a real workflow.

They should not be designed upfront as a universal system.

## Non-goals for the initial product

Do not prioritize:

- budgeting;
- transaction tracking;
- bank synchronization;
- Open Banking integrations;
- automatic transaction imports;
- investment analytics;
- stock-price tracking;
- tax filing;
- generic receipt storage;
- property management;
- vehicle management;
- insurance policy management;
- AI financial advice.

Some of these may become relevant later, but they are outside the current product goal.

## Product principles

### Solve the current problem first

Prefer the smallest useful workflow over a broad personal-finance platform.

### Accounts provide context

A financial document should derive its meaning from the account it belongs to.

### Preserve history

Closed accounts and historical documents remain valuable and should not disappear.

### Avoid duplicate ownership

If another domain owns a record, Passbook should reference it rather than copy it.

### Keep data portable

Financial records are long-lived. The app should make backups, exports, and recovery straightforward.

### Grow from actual use

Future features should come from real household workflows rather than from copying feature lists from commercial finance apps.

## Success criteria

Passbook is successful when it becomes easier to answer:

> What financial accounts do we have, and are their records complete?

than it is with folders and a manually maintained spreadsheet.
