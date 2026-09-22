# Phase 7 Plan — Filing History, Adjustments, and CRA Documents

## Purpose

Complete the lifecycle of a Tax Year by preserving what each person filed, what
CRA assessed, what changed later, and the documents that are useful when looking
back at the year.

The first useful version must work for both:

* a current Tax Year that has been tracked in Tax Book; and
* an older Tax Year whose return was prepared elsewhere and whose submitted T1
  is no longer available.

For an older year, a CRA Notice of Assessment is enough to create a useful
filing history. The app must not require the user to reconstruct every Tax Item
or possess the original T1 before the year can be recorded as assessed.

## Confirmed Immediate Use Cases

These are the workflows driving Phase 7 implementation order:

1. **Backfill older assessed years** — retain the NOA (and any known result)
   when the submitted T1 is no longer available.
2. **Track adjustments on past years** — record why a return is being corrected,
   retain supporting material, and preserve the resulting Notice of
   Reassessment in chronological order beneath the original filing.

The current-year filing snapshot workflow (copy Tax Item values, submit, then
attach the NOA) remains in scope but is not the first build priority. It can
wait until filing season unless tracking work for the active year makes it
necessary sooner.

## Confirmed Product Decisions

* A Tax Year remains one calendar year. Adjustments do not create synthetic
  years such as `2025.1`.
* Filing history is per Person because household members file separate Canadian
  income-tax returns.
* A Person may have no filing history for a Tax Year when they did not file
  that year or was not yet in the household. Lifecycle guardrails must not treat
  a missing Original Return as incomplete for persons who did not file.
* An original T1 attachment is optional. A historical copy that cannot be
  obtained is recorded explicitly as `Unavailable`, rather than leaving a
  permanent incomplete-document warning.
* A Notice of Assessment or Reassessment can be retained even when the related
  submitted return is unavailable.
* Past GST/HST returns and Canada Carbon Rebate documents can be retained as CRA
  reference documents for the Tax Year.
* GST/HST and Canada Carbon Rebate documents are not T1 filings, adjustments,
  Tax Items, or inputs to the tax estimate in this phase.
* Documents remain stored in SQLite so the existing backup and restore workflow
  includes them.

## Smallest Complete Workflow

### Record an older return when the T1 is unavailable

1. Create or open the historical Tax Year.
2. Open **Filing History** and choose the Person.
3. Add an Original Return.
4. Mark the submitted T1 as `Unavailable` and optionally explain why in notes.
5. Enter any known filing date and expected refund or amount owing. Unknown
   values may be left blank.
6. Add the Notice of Assessment downloaded from CRA, its assessment date, and
   the assessed refund or amount owing.
7. Add other available CRA reference documents, such as a GST/HST return or a
   Canada Carbon Rebate notice.
8. Mark the Tax Year archived once the retained history is satisfactory.

This workflow does not require Tax Items, paycheques, or a reconstructed tax
estimate for the historical year.

### Record a newly filed return

1. Open the Person's Filing History for the active Tax Year.
2. Review the filing values copied from the current Tax Items.
3. Correct the copied values when the filed value differs from the tracked
   value; the filing copy is a snapshot and does not rewrite the Tax Item.
4. Record the filing date, expected result, notes, and T1 copy status.
5. Upload the T1 when it is available, then mark the filing submitted.
6. Later, attach the Notice of Assessment and record CRA's assessed result.

### Record an adjustment on a past year

1. Open the historical Tax Year and the affected Person's Filing History.
2. Confirm an Original Return exists (with T1 `Attached` or `Unavailable`).
3. Add an Adjustment beneath that filing.
4. Record the reason, affected Tax Items or a plain-language description, and
   expected change in refund or amount owing.
5. Retain supporting Records and Tax Documents using their existing workflows
   in that Tax Year.
6. Record the submission date and attach the submitted adjustment document when
   available, or mark it `Unavailable` when no copy exists.
7. Add the Notice of Reassessment and actual result when CRA responds.
8. Leave the year archived, or return it to an earlier lifecycle stage if the
   adjustment is still open.

## Domain Model

```text
Tax Year
├── Person A filing history
│   ├── Original Return
│   │   ├── snapshot of filed Tax Item values (optional)
│   │   ├── submitted T1 (attached or explicitly unavailable)
│   │   └── Notice of Assessment
│   └── Adjustment 1
│       ├── affected Tax Items (optional)
│       ├── submitted adjustment document (optional)
│       └── Notice of Reassessment
├── Person B filing history
│   └── ...
└── CRA reference documents
    ├── GST/HST return
    ├── Canada Carbon Rebate document
    └── Other CRA document
```

### Filing

A Filing belongs to one Tax Year and one Person.

Fields:

* kind: `Original Return` or `Adjustment`
* status: `Preparing`, `Submitted`, or `Assessed`
* filing/submission date, optional
* expected result in cents, optional and signed
  * positive means refund
  * negative means amount owing
* return-copy status: `Not Added Yet`, `Attached`, or `Unavailable`
* reason, required for an Adjustment and absent for an Original Return
* expected change in cents, optional and signed, for an Adjustment
* notes, optional
* created and updated timestamps

Rules:

* Each Person has at most one Original Return per Tax Year.
* A Person may have multiple Adjustments, shown chronologically.
* An uploaded return or adjustment copy changes the copy status to `Attached`.
* A current Filing cannot be submitted while its copy status is `Not Added Yet`;
  the user must attach the copy or explicitly mark it `Unavailable`.
* Removing an attachment from a submitted Filing requires choosing
  `Unavailable`; there is no ambiguous missing state on a submitted Filing.
* Creating a historical Original Return with `Unavailable` is valid.
* Filing and submission dates remain optional so incomplete historical facts can
  be retained. The current-year workflow warns before submission when the date
  is absent, but the user may confirm that it is unknown.

### Filed-value snapshot

A filed-value snapshot preserves what was reported at that point without
freezing or rewriting live Tax Items.

Each row stores:

* the Filing;
* the Tax Item ID when the source item still exists, otherwise null;
* a copied item name, owner label, and tax-line reference;
* the signed amount used for filing; and
* an optional note explaining a difference from the tracked value.

When preparing a current return, Tax Book offers to copy relevant Person-owned
items plus explicitly selected household items. The user reviews this list
before submission. Historical filings may have no snapshot rows at all.

Deleting or editing a Tax Item later must not alter an existing filing snapshot.

### Assessment

An Assessment belongs to one Filing and represents either an NOA or NOR.

Fields:

* kind: `Notice of Assessment` or `Notice of Reassessment`;
* assessment date;
* assessed result in cents, optional and signed;
* refund or payment date, optional;
* notes, optional; and
* one optional PDF or image attachment.

The kind is determined by the Filing: an Original Return receives an NOA and an
Adjustment receives an NOR. Adding an Assessment moves the Filing to
`Assessed`.

The assessed result is the result stated by CRA for that filing event. Tax Book
does not attempt to derive it from the uploaded document or reconcile every T1
line automatically.

### CRA reference document

A CRA reference document belongs directly to a Tax Year and is not required to
belong to a Tax Item or Filing.

Fields:

* category: `GST/HST Return`, `Canada Carbon Rebate`, or `Other CRA Document`;
* title;
* optional Person;
* optional document date;
* optional reporting-period label, kept as plain text because GST/HST reporting
  periods do not always match the calendar year;
* notes, optional; and
* one PDF or image attachment.

This is deliberately a small archive of relevant CRA material. It does not add
GST/HST calculations, payment tracking, carbon-rebate calculations, or a
general-purpose document-management system.

## Tax Year Lifecycle

Add a stored lifecycle status to each Tax Year:

```text
Tracking → Preparing → Filed → Assessed → Archived
```

The transition is user initiated, with focused guardrails:

* `Filed` warns if a Person with a started or submitted Original Return is still
  incomplete; persons with no filing history for the year are ignored.
* `Assessed` warns if a submitted Filing has no Assessment.
* `Archived` warns if an Adjustment is still `Preparing` or `Submitted`.
* The user may confirm a warning for incomplete historical information. The app
  must not block a real historical archive merely because a document or date is
  unavailable.
* Changing tracked facts in an archived year first requires explicitly moving
  it out of `Archived`.

The active-year selector and lifecycle status are separate concepts. Looking at
or importing an old year must not imply that it is the household's current
tracking year.

## Persistence Plan

Add the following tables:

* `filings`
* `filing_attachments`
* `filing_item_values`
* `filing_affected_tax_items`
* `assessments`
* `assessment_attachments`
* `cra_reference_documents`
* `cra_reference_document_attachments`

Add `status` to `tax_years`, defaulting existing rows to `tracking`.

Important constraints and indexes:

* unique original Filing per Tax Year and Person;
* Filing chronology indexed by Tax Year, Person, and submission date;
* one attachment per Filing, Assessment, or CRA reference document;
* one Assessment per Filing in the first version;
* attachment size limited to the existing 20 MiB maximum;
* accepted file types remain PDF, JPEG, PNG, HEIC, and HEIF;
* foreign keys cascade only for objects wholly owned by the parent Filing or
  Tax Year; deleting a Person referenced by filing history remains restricted.

The migration must not infer filing history from existing Tax Documents.
Existing data remains tracking data until the user records a Filing.

## Application Surface

### Navigation

Add a **Filing History** destination for the active Tax Year. Its header shows
the Tax Year lifecycle and an action to change it.

### Filing History page

Show one section per Person, each containing a chronological timeline:

* Original Return card;
* its NOA, when present;
* Adjustment cards in submission order; and
* each related NOR.

Cards show dates, expected and assessed results, attachment availability, and
notes. Empty historical years lead with **Add past filing** rather than asking
the user to create Tax Items first.

### CRA documents section

Show GST/HST returns, Canada Carbon Rebate documents, and other CRA material in
a compact table below the filing timelines. The reporting period must be visible
for GST/HST documents.

### Overview

Add one filing-status card that summarizes the selected Tax Year, for example:

* `Preparing — 1 return still in progress`
* `Filed — waiting for 2 assessments`
* `Assessed — no open adjustments`
* `Archived`

Do not show missing-T1 warnings when the return-copy status is explicitly
`Unavailable`.

### Historical year creation

Extend the Tax Year creation dialog with a choice between:

* **Start tracking this year**, which behaves as it does now and becomes active;
* **Add a past year**, which creates the year without changing the current active
  year and opens its Filing History.

This prevents importing old CRA documents from disrupting the current workflow.

## Server and Validation Work

Add domain validation and tRPC operations for:

* listing a complete filing timeline for a Tax Year;
* creating and updating Original Returns and Adjustments;
* reviewing and saving filed-value snapshots;
* linking affected Tax Items to an Adjustment;
* uploading, downloading, replacing, and removing each attachment type;
* recording an Assessment or Reassessment;
* creating and maintaining CRA reference documents; and
* changing the Tax Year lifecycle with guardrail results returned to the UI.

Every query and mutation must verify that the requested Tax Year, Person, Tax
Item, Filing, and document belong to the configured household. Attachment HTTP
routes should follow the existing Record and Tax Document download patterns.

## Delivery Slices

Build in this order. Each slice must leave the app usable on its own.

### Slice 1 — Historical filing and NOA *(build first)*

* Tax Year lifecycle status
* per-Person Original Return
* explicit `Attached` or `Unavailable` T1 state
* NOA metadata and attachment
* historical-year creation that does not change the active year
* Filing History timeline

This slice alone solves the central backfill problem.

### Slice 2 — Adjustments and reassessments *(build second)*

* Adjustment reason, affected items or plain-language description, expected
  change, and status
* submitted adjustment attachment or explicit `Unavailable` state
* NOR and actual result
* multiple Adjustments in chronological order beneath the Original Return

This slice completes the past-year correction workflow.

### Slice 3 — Archive safeguards *(build third)*

* lifecycle warnings when moving to `Filed`, `Assessed`, or `Archived`
* archived-year edit protection
* end-to-end regression coverage for backfill and adjustment scenarios

The overview filing-status summary can follow in a later slice once the filing
pages exist and their summaries are stable.

### Slice 4 — CRA reference documents

* GST/HST Return, Canada Carbon Rebate, and Other categories
* reporting-period metadata
* upload, download, edit, and delete workflow

Useful when retaining GST/HST or Carbon Rebate material alongside a Tax Year,
but not required to backfill an assessed T1 or record an adjustment.

### Slice 5 — Current filing snapshot

* copy Tax Item values into a reviewable snapshot
* submit the Original Return from the active tracking year
* show expected versus assessed result

Build when the household is preparing or filing the active Tax Year.

Later slices should not be prerequisites for recording an older NOA or a past
adjustment.

## Test Plan

### Domain and database tests

* allows an Original Return with an unavailable T1;
* prevents a second Original Return for the same Person and Tax Year;
* allows multiple ordered Adjustments;
* preserves snapshot values after the source Tax Item changes or is deleted;
* restricts cross-household references;
* assigns NOA only to an Original Return and NOR only to an Adjustment;
* stores signed refund and amount-owing values correctly;
* accepts a GST/HST reporting period that differs from the Tax Year;
* preserves existing Tax Years as `Tracking` after migration; and
* includes all new attachments in database backup and restore.

### API and attachment tests

* create, edit, list, and delete each filing-history object;
* upload, download, replace, and remove each supported attachment;
* reject unsupported types, oversized files, and empty files;
* return `404` for records outside the household; and
* return lifecycle warnings without silently discarding incomplete history.

### End-to-end scenarios

1. Add a past year without changing the currently active year, record a Person's
   T1 as unavailable, attach an NOA, and archive the year.
2. Add GST/HST and Canada Carbon Rebate documents and download both again.
3. Prepare a current filing from Tax Items, change one snapshot value, submit
   it, and confirm the live Tax Item is unchanged.
4. Add an Adjustment, link an affected item, submit it, attach the NOR, and see
   the complete chronology.
5. Confirm an archived year requires an explicit lifecycle change before its
   tracked tax facts can be edited.

## Acceptance Criteria

Phase 7 is complete when:

* an older assessed year can be usefully recorded with an NOA but no T1;
* the UI clearly says the T1 is unavailable rather than missing;
* each household member has an independent filing history;
* a newly filed return can preserve a reviewed snapshot of filed values;
* adjustments and reassessments appear in chronological order without changing
  the original filing record;
* GST/HST returns and Canada Carbon Rebate documents can be retained and found
  under the relevant Tax Year;
* the current active year does not change when a past year is imported;
* archived years resist accidental edits; and
* backup and restore include every retained attachment.

## Explicitly Deferred

* CRA account connection or automatic download;
* OCR or extraction from T1, NOA, NOR, GST/HST, or carbon-rebate documents;
* complete line-by-line T1 comparison;
* automatic reconciliation of Tax Items against a filed return or assessment;
* GST/HST return preparation, calculations, remittance tracking, or filing;
* Canada Carbon Rebate eligibility or payment calculations;
* direct T1 or adjustment submission;
* generalized audit, correspondence, or case management; and
* a general-purpose household document archive.
