# First Aid — Roadmap

This roadmap is intentionally organized around making First Aid useful as early as possible.

Each phase should solve a real problem on its own.

The roadmap is not a feature-completeness plan for a healthcare product. If using First Aid changes what is important, the roadmap should change with it.

## Phase 1 — Plan the healthcare year

### Goal

Replace the loose mental list of healthcare things we should remember with one usable yearly view.

### Scope

- household members
- yearly care plan
- care items
- basic categories/types
- timing such as:
  - one-time
  - yearly
  - recurring interval
  - seasonal
  - as-needed
- simple states such as:
  - to consider
  - planned
  - scheduled
  - completed
  - skipped
  - not due
- source/reason for a care item
- notes
- due date or approximate planning period where useful

### Example use

Create a 2027 plan containing:

- dental cleaning
- eye exam
- seasonal flu vaccination
- annual health review
- repeat bloodwork after a provider-specified date
- massage therapy planned periodically

Then revisit that plan at any point in the year.

### Useful outcome

I can open First Aid and understand what healthcare we intend to think about or complete this year.

### Explicitly deferred

- insurance calculations
- documents
- detailed provider records
- claims
- advanced recurrence engine
- automated medical recommendations
- appointment booking

---

## Phase 2 — Schedule and record visits

### Goal

Connect the plan to what actually happens.

### Scope

- target visit count for a care item
- care-item progress inferred from linked visits:
  - planned
  - in progress
  - completed
  - not pursuing as a manual override
- visits
- scheduled date/time
- scheduled, completed, and cancelled visit states
- optional link from a visit to a care item
- standalone visits for unplanned or urgent care
- reusable care organizations such as clinics, institutes, pharmacies, and labs
- reusable providers, optionally associated with a care organization
- basic visit notes
- visit history for a person/provider
- dedicated Care Plan, Visits, and Care Providers areas

### Example use

A planned dental cleaning becomes a scheduled visit.

After the visit, mark it complete and keep basic notes without losing its connection to the yearly plan.

A massage-therapy goal can target several visits and show progress as those
visits are scheduled and completed. An emergency visit can be recorded directly
without creating a care item.

### Useful outcome

First Aid becomes both a planning tool and a lightweight history of care.

### Explicitly deferred

- appointment booking with providers
- external calendar feeds or synchronization
- full calendar UI
- automated reminders
- detailed clinical records

---

## Phase 3 — Keep the documents with the event

### Goal

Stop healthcare paperwork from being scattered across folders, email, portals, and paper.

### Scope

Attach documents to visits, and support simple document labels such as:

- intake form
- receipt
- prescription
- referral
- requisition
- report
- result
- claim record
- explanation of benefits
- other

Documents should primarily belong to the healthcare event that explains why they exist.

### Example use

Open a past physiotherapy visit and find the intake form, receipt, claim result, and personal notes together.

### Useful outcome

First Aid becomes the place to look when I need the records from a previous healthcare interaction.

### Explicitly deferred

- OCR-heavy document ingestion
- automatic medical-document extraction
- generic document management
- complex document taxonomies
- external health-record integrations

---

## Phase 4 — Track insurance benefits

### Goal

Know what healthcare coverage is available before the year disappears.

### Scope

- insurance plan
- benefit categories
- benefit period
- limit
- reset/renewal date
- simple usage
- remaining amount
- link relevant care/visits to a benefit

The model should support common limits without attempting to reproduce every insurer rule.

### Example use

See:

> Massage therapy — $290 remaining — benefit year ends December 31

and use that information while reviewing the care plan.

### Useful outcome

Insurance coverage becomes a visible planning input instead of something checked only after an expense occurs.

### Explicitly deferred

- insurer-specific rule engines
- eligibility verification
- automatic portal login
- automated claim submission
- coordination of benefits
- prediction of insurer adjudication

---

## Phase 5 — Record claims and real cost

### Goal

Understand what a completed visit actually cost and how it affected available benefits.

### Scope

- visit cost
- claim
- amount submitted
- amount reimbursed
- out-of-pocket amount
- claim status if useful
- related claim/EOB documents
- calculate benefit usage from recorded claims where possible

### Example use

Massage visit:

- cost: $110
- insurer paid: $100
- out of pocket: $10
- massage benefit automatically reflects the $100 usage

### Useful outcome

The remaining-benefit picture is based on actual healthcare activity instead of manual mental arithmetic.

### Explicitly deferred

- accounting system
- tax deduction/credit calculations
- reimbursement automation
- insurer API integrations unless a real need appears

---

## Phase 6 — Close the care loop

### Goal

Make recommendations from past care reliably appear in future planning.

### Scope

A completed visit can create a future care item or follow-up, for example:

- repeat bloodwork after a date
- next dental cleaning in six months
- provider wants another review next year
- vaccination/booster should be reconsidered later

Prefer the simplest domain model that works.

A follow-up may simply become a new Care Item with a reference to the originating visit instead of requiring a separate long-lived Follow-up entity.

### Example use

A doctor visit in June creates:

> Repeat bloodwork after September 1

That item remains visible in the care plan until handled.

### Useful outcome

Important future care no longer disappears inside historical notes.

### Explicitly deferred

- clinical workflow engines
- medical decision support
- automated interpretation of provider notes

---

## Later — only if usage creates the need

Potential areas should remain uncommitted until the current tool exposes a real problem.

Examples include:

- recurring-plan templates
- smarter year-review workflow
- trustworthy preventive-care guidance/reference library
- richer vaccination history
- medication tracking
- lab/test tracking
- referral tracking
- reminders
- email/document ingestion
- insurance portal integrations
- Apple Health or other health-data integrations
- family sharing or multi-user access
- structured export/backup

A later idea should not move into the roadmap simply because other medical applications have it.

The question remains:

> What problem are we experiencing while using First Aid, and what is the smallest change that solves it?
