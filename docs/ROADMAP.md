# Roadmap

Passbook should grow from actual use.

Each phase should solve one clear problem and leave the app usable before the next phase begins.

## Phase 1 — Accounts

### Goal

Create a reliable inventory of household financial accounts.

### Build

- household members;
- institutions;
- accounts;
- account ownership;
- active and closed states;
- opened and closed dates;
- basic notes.

### Outcome

Passbook can answer:

> What financial accounts do we have or have we had?

---

## Phase 2 — Statement schedules

### Goal

Teach Passbook which statements should exist.

### Build

Support statement frequencies such as:

- monthly;
- quarterly;
- annually;
- irregular;
- none.

Use account lifecycle dates to determine when expectations begin and end.

### Outcome

Passbook can derive expected statement periods without a manually maintained checklist.

---

## Phase 3 — Statement uploads

### Goal

Make statement intake fast enough to use regularly.

### Preferred flow

```text
Upload PDF
Choose account
Choose period
Save
```

Avoid asking for information that can already be derived from the account.

### Outcome

Uploading a statement satisfies the matching expected period.

---

## Phase 4 — Missing statement tracking

### Goal

Solve the main product problem.

### Build

Show statement status at both account and household level.

Useful states:

```text
Complete
Waiting
Missing
Future
```

Example:

```text
2026

Jan  ✓
Feb  ✓
Mar  Missing
Apr  ✓
May  ✓
Jun  ✓
Jul  Missing
Aug  ✓
Sep  Waiting
```

### Outcome

Passbook can answer:

> Which financial statements am I missing?

This is the first major milestone.

If this is not clearly better than the previous folder + spreadsheet workflow, stop and revisit the product before expanding scope.

---

## Phase 5 — Other account documents

### Goal

Make each account a useful historical record, not just a statement tracker.

### Build

Support simple account-level document types such as:

- notice;
- agreement;
- opening document;
- closure document;
- financial correspondence;
- other.

These documents do not need recurring expectations.

### Outcome

Important account records can be found alongside the account they belong to.

---

## Phase 6 — Better intake

Only begin this phase after the basic upload workflow is being used regularly.

Possible improvements:

- batch uploads;
- duplicate detection;
- remembered recent selections;
- metadata suggestions;
- statement-period suggestions;
- consistent internal filenames;
- consistent storage paths.

Automation should reduce repetitive work, not make the workflow harder to understand.

---

## Later — Cross-app references

Passbook may eventually connect with other Your Tools apps.

Possible examples:

```text
Home app
→ mortgage account

Garage
→ vehicle loan

Taxbook
→ tax-relevant financial records

Employment
→ income-related references

Budgeting app
→ account identity
```

Keep these integrations loose.

Do not create a shared cross-app framework until an actual workflow requires one.

---

## Later — Budgeting integration

A separate budgeting app may eventually manage:

- transactions;
- categories;
- budgets;
- cash-flow planning;
- transaction imports;
- transaction receipts.

Passbook should not absorb those responsibilities.

If both apps need to refer to the same real-world account, design that integration when the budgeting app actually exists.

---

## Later — Net worth

Potential future work may include:

- account balances;
- assets;
- liabilities;
- balance history;
- net worth.

Do not add this just because other personal finance apps have it.

First define the specific household problem it should solve.

---

## Later — Account details

Passbook may eventually track useful operational details such as:

- interest rate;
- annual fee;
- credit limit;
- renewal date;
- promotional rate expiry;
- payment schedule.

Only add fields that repeatedly help with a real workflow.

---

## Not in the early roadmap

Do not prioritize:

- bank synchronization;
- Open Banking integrations;
- Plaid;
- transaction imports;
- budgeting;
- transaction categorization;
- generic receipt storage;
- investment analytics;
- stock prices;
- tax filing;
- property management;
- vehicle management;
- insurance policy management;
- AI financial advice.

These are either separate domains or future problems.

## Development rule

Before starting a phase:

1. revisit the real problem;
2. confirm the smallest useful version;
3. build that version;
4. use it;
5. only then decide what comes next.

Prefer a focused workflow that is useful now over infrastructure for a hypothetical future finance platform.
