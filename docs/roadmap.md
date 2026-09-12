# Roadmap

Tax Book should be built in small phases that solve an immediate personal tax problem.

Each phase should leave the app usable even if no later phase is ever built.

Before starting implementation of any phase, have a short conversation with the user to confirm the smallest useful workflow for that phase.

## Phase 1 — Tax Year Tracker

### Goal

Create a usable place to maintain the household's current tax-year picture.

### Includes

* Household
* People
* Tax Year
* Manual Tax Items
* Owner: Person or Household
* Optional tax line/reference
* Expected amount
* Actual amount
* Status
* Notes

### Example Tax Items

* Employment income
* FHSA deduction
* RRSP deduction
* Medical expenses
* Professional expenses
* Business income
* Business expenses
* Federal or Manitoba credits

### Useful Outcome

The household can start maintaining 2026 tax information immediately instead of keeping it across notes and spreadsheets.

### Explicitly Deferred

* Paycheque tracking
* Record uploads
* Tax Document tracking
* tax calculations
* refund estimates
* CRA integrations
* tax filing

---

## Phase 2 — Paycheques

### Goal

Accurately track employment income throughout the year, especially variable income.

### Includes

Manual Paycheque entry for each Person.

Each Paycheque may include:

* pay date
* gross pay
* income tax withheld
* CPP
* CPP2
* EI
* other deductions
* net pay

### Calculated Values

* year-to-date gross income
* year-to-date tax withheld
* year-to-date CPP
* year-to-date EI
* average pay
* projected annual income

Each employer is tracked as a separate Employment for a Person and Tax Year.
An Employment creates a calculated employment-income Tax Item. Its actual value
is the gross pay recorded so far, and its expected value is a transparent
projection based on its pay frequency and average gross pay. A typical-pay
override is available when the average is not representative. Ended employments
contribute actual income but no projected future pay.

### Useful Outcome

Employment income no longer needs to be estimated manually.

Variable employment income can be tracked as new Paycheques arrive.

### Explicitly Deferred

* payslip parsing
* payroll integrations
* automatic bank imports
* advanced projection models

---

## Phase 3 — Records

### Goal

Keep the supporting information the household may need to prove tax-related amounts later.

### Includes

Records attached to Tax Items.

A Record may contain:

* date
* amount
* description
* Person
* uploaded document or image
* notes

In the implemented workflow, date, description, and a positive amount are
required. A Record may include one PDF or image attachment and an optional
Person for household-owned items. Record amounts are summed into the Tax Item's
actual amount; status remains manually managed. Paycheque-calculated Tax Items
do not accept Records because their value already has a source of truth.

Attachments are stored in SQLite so the existing database backup and restore
workflow includes the supporting files.

### Example

```text
Medical Expenses

Dentist        $300   Record ✓
Glasses        $450   Record ✓
Prescription    $80   Record ✓

Total          $830
```

### Useful Outcome

Tax Items that depend on household-managed proof can be supported directly inside the app.

If CRA asks about a claim later, the related Records can be found from the original Tax Year.

### Explicitly Deferred

* OCR
* automatic receipt extraction
* automatic categorization
* external document-storage integrations

---

## Phase 4 — Tax Documents

### Goal

Know which official tax documents are expected and whether the household is ready to file.

### Includes

Track Tax Documents such as:

* T4
* T5
* RRSP contribution receipts
* FHSA tax documents
* other relevant tax slips

A Tax Document may move through simple states:

```text
Expected
→ Received
→ Ready to File
→ Used for Filing
```

In the implemented workflow, each Tax Document belongs to one Tax Item and has
a type, issuer, status, optional notes, and one optional PDF or image attachment.
Person-owned items pass their owner to the document, while household-owned items
may identify a household member. A year is ready when every tracked document is
Ready to File or Used for Filing; an empty document list is not reported as
ready. Tax Item and Tax Document statuses remain independent.

### Useful Outcome

The app can answer:

> Are we still waiting for anything before filing?

### Explicitly Deferred

* CRA Auto-fill integration
* automatic slip extraction
* automatic reconciliation between Paycheques and T4s

---

## Phase 5 — Tax Estimate

### Goal

Provide a useful planning estimate of the household's tax result.

### Includes

Start only with tax rules relevant to the household.

Potential inputs include:

* employment income
* self-employment income
* tax withheld
* CPP
* EI
* RRSP deductions
* FHSA deductions
* selected credits
* selected expenses

### Outputs

* projected annual income
* estimated taxable income
* estimated tax payable
* estimated tax already paid
* estimated refund
* estimated amount owing

### Useful Outcome

The household can make tax-planning decisions before filing season.

### Important Constraint

This is a planning estimate.

Tax Book is not intended to replace tax filing software.

### Explicitly Deferred

* complete Canadian tax-rule coverage
* every federal and provincial tax form
* generic tax-rule engine
* tax-filing submission

---

## Phase 6 — Filing History, Adjustments, and Assessment

### Goal

Complete the lifecycle of a Tax Year while preserving what was filed originally,
what changed later, and how CRA responded.

A Tax Year remains one calendar year. Adjustments are not represented as
separate years such as `2025.1` or `2025.2`. Instead, each Tax Year has a
chronological Filing History.

```text
Tax Year
├── Original Return
│   └── Notice of Assessment
└── Adjustment 1
    └── Notice of Reassessment
```

### Includes

The original Tax Filing may contain:

* filing date
* submitted T1 return
* expected Tax Result
* the Tax Item values used for filing
* notes

An Assessment records CRA's response to a Filing:

* Notice of Assessment or Notice of Reassessment
* assessment date
* assessed refund or amount owing
* refund or payment date
* relevant notes

An Adjustment belongs to the same Tax Year and records:

* why the return needs to change
* affected Tax Items
* supporting Records and Tax Documents
* expected change to the refund or amount owing
* status: Preparing, Submitted, or Reassessed
* submission date and submitted adjustment document
* the resulting Notice of Reassessment and actual result

Tax-year information describes the facts and supporting material for that
calendar year. Each Filing or Adjustment preserves what was submitted at that
point in time so that later corrections do not silently rewrite the original
filing history.

### Tax Year Lifecycle

```text
Tracking
→ Preparing
→ Filed
→ Assessed
→ Archived
```

### Useful Outcome

A completed Tax Year becomes a reliable historical snapshot.

Opening 2026 in a future year should make it clear:

* what was reported originally
* what supported the claims
* what was changed through any adjustment
* what CRA assessed or reassessed after each submission
* what refund or payment resulted

For an older return currently being corrected, the household can open the
original Tax Year, organize the missing item and its supporting material, track
the adjustment through submission, and retain the resulting reassessment in one
place.

### Explicitly Deferred

* automatic comparison or reconciliation of complete tax returns
* generalized audit or case-management workflows
* CRA account synchronization
* direct tax filing

---

## Phase Principle

Build vertically, not broadly.

Prefer:

> A complete small workflow that can be used today.

Avoid:

> A partially implemented version of every future capability.

Examples:

* Finish manual Tax Item tracking before building tax automation.
* Finish Paycheque entry before considering payslip parsing.
* Finish Record storage before considering OCR.
* Track expected Tax Documents manually before considering CRA integrations.

The app should become more useful with each phase, not merely more sophisticated.

## Scope Check

When a new idea appears, ask:

> Does this solve a current tax problem for the household?

If yes, consider whether it belongs in the current phase.

If not, document it for later and keep the current phase small.
