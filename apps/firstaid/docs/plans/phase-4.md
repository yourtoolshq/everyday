# Phase 4 — Benefits, claims, and real cost

## Purpose

Make insurance coverage visible while planning the healthcare year, then connect
that coverage to the actual cost of visits.

This phase combines the roadmap's current Phase 4 and Phase 5 work. Benefits
without claims would require maintaining usage separately from the visits that
caused it, while claims without benefits would not provide the remaining-coverage
view needed during yearly planning. Implementing the two workflows together keeps
one source of truth and makes the first release immediately useful.

The implementation should remain a lightweight personal record. It must not try
to reproduce insurer eligibility, adjudication, coordination-of-benefits, or
claim-submission rules.

## Confirmed product decisions

- An insurance plan contains benefits.
- A benefit covers either one household member or the household as a shared pool.
- Benefit periods follow the calendar year.
- Benefits use dollar limits only. Visit-count and other insurer-specific limits
  are deferred.
- A visit records its total cost.
- A visit can have multiple claims against different benefits. For example, part
  of a visit may be paid from a service-specific benefit and another part from a
  shared health spending account.
- Only the final amount paid from a benefit is required. Submitted and approved
  amounts are not tracked separately.
- A claim has a simple status: submitted, paid, or denied.
- Benefit allocation is manual. First Aid calculates totals automatically but
  does not decide how a visit should be distributed among benefits.
- The sum of paid claims cannot exceed the visit cost.
- The unclaimed portion of a visit cost is its out-of-pocket amount.
- Care items do not select or consume benefits. They summarize the financial
  results of their linked visits.
- Benefit usage comes from paid claims, with a manual opening adjustment for
  benefit usage not represented by visits in First Aid.

## Smallest usable workflow

1. Create an insurance plan for a calendar year.
2. Add the benefits worth actively tracking.
3. Mark each benefit as either shared by the household or assigned to one person.
4. Enter its annual dollar limit and, when necessary, an opening used amount.
5. Record a visit and its total cost.
6. Add one or more claims to the visit, selecting a benefit and entering the final
   amount paid.
7. See the visit's total reimbursement and automatically calculated out-of-pocket
   amount.
8. See updated used and remaining amounts on the Benefits page.
9. See aggregate cost, reimbursement, and out-of-pocket amounts on the linked
   care item.

## Domain model

### Insurance plan

An insurance plan groups benefits for one calendar year. V1 should allow multiple
plans in a year so coverage from more than one source does not require combining
unrelated benefits.

Fields:

- id
- name
- year
- optional notes
- created and updated timestamps

The name is user-provided and does not require storing an insurer name or policy
number.

### Benefit

A benefit is a dollar pool available through an insurance plan.

Fields:

- id
- insurance plan id
- name
- coverage scope: `person` or `household`
- person id when the scope is `person`
- annual limit in integer cents
- opening used amount in integer cents, defaulting to zero
- optional notes
- created and updated timestamps

Rules:

- A person-scoped benefit must reference a person.
- A household-scoped benefit must not reference a person.
- Limits and opening usage cannot be negative.
- Opening usage cannot exceed the annual limit.
- The period is derived from the insurance plan year: January 1 through December
  31. Separate period rows are unnecessary for this phase.
- Remaining amount is derived and is never stored directly.

### Claim

A claim records the final amount a benefit paid, or is expected to pay, for one
visit. Multiple claims may belong to the same visit.

Fields:

- id
- visit id
- benefit id
- status: `submitted`, `paid`, or `denied`
- amount in integer cents
- optional notes
- created and updated timestamps

Rules:

- A claim references exactly one visit and one benefit.
- A claim amount must be greater than zero.
- Only `paid` claims consume a benefit and contribute to reimbursement totals.
- Submitted and denied claims remain visible in visit history but do not reduce
  the benefit's remaining amount.
- The benefit's year must match the calendar year of the visit.
- A person-scoped benefit can only be used for a visit belonging to that person.
- A household-scoped benefit can be used for any household member's visit.
- The total of paid claims for a visit cannot exceed its cost.
- Changing a claim to `paid`, changing its amount, or reducing a visit's cost must
  revalidate the visit total.
- Deleting a visit deletes its claims.
- Benefits and insurance plans referenced by claims cannot be deleted. The UI
  should explain the dependency rather than silently removing financial history.

### Visit additions

Add a nullable visit cost stored as integer cents.

A missing cost means the financial details have not been recorded. It is distinct
from a known zero-dollar visit.

Derived values:

```text
reimbursed = sum of paid claim amounts
out of pocket = visit cost - reimbursed
pending = sum of submitted claim amounts
```

Financial totals should only be shown when a visit cost is present. The claim
editor requires a visit cost because the reimbursement ceiling cannot otherwise
be validated.

### Benefit calculations

```text
used = opening used amount + sum of paid claims
remaining = max(annual limit - used, 0)
```

The UI should also expose an over-limit amount if imported or edited historical
data ever causes usage to exceed the limit. It should not hide the discrepancy by
showing only zero remaining.

Submitted claims may be shown separately as pending, but must not be subtracted
from remaining coverage.

### Care item summaries

A care item derives financial totals from all of its linked visits:

```text
total cost = sum of known visit costs
reimbursed = sum of paid claims on those visits
out of pocket = total cost - reimbursed
```

The summary should indicate when some linked visits have no recorded cost so the
numbers are not presented as complete when they are only partial.

Care items do not reference benefits directly. They are planning goals; actual
visits and claims are the source of financial activity.

## User experience

### Benefits area

Enable the existing Benefits navigation item and add a dedicated Benefits page.

The page should provide:

- year selection consistent with the Care Plan
- insurance-plan creation and editing
- benefit creation and editing within a plan
- clear labels for shared and person-specific benefits
- annual limit, used, pending, remaining, and reset date
- a progress indicator that does not encourage spending merely to exhaust a
  benefit
- an empty state explaining that only benefits useful for planning need to be
  tracked
- access to the visits and paid claims contributing to each used total

The primary summary should read naturally, for example:

> Massage therapy — $290 remaining — resets January 1, 2028

The opening used amount should be described as usage that happened outside First
Aid, not as an arbitrary balance override.

### Visit create and edit flows

Add an optional cost field to the existing visit form. Currency input should be
entered in dollars, parsed safely, and stored as integer cents.

Do not crowd the general visit dialog with the complete claim workflow. Cost may
be entered while creating or editing a visit; claims should be managed from the
visit detail page where there is enough context to review totals.

### Visit detail

Add a financial section showing:

- visit cost
- paid by benefits
- pending claims
- out of pocket
- the list of claims and their statuses
- actions to add, edit, and delete a claim

When adding a claim, the benefit selector should:

- show benefits from the visit's calendar year
- include shared benefits
- include person-specific benefits for the visit's person
- exclude benefits belonging to another person
- show the remaining amount next to each option

After each edit, automatically update the visit totals and affected benefit
summary. The user chooses the benefit and amount; First Aid performs arithmetic
and validation only.

### Care plan

Add a compact financial summary to care items that have linked visits with costs.
The existing planning and progress information remains primary. Financial values
are supporting context and should not turn the Care Plan into an accounting view.

### Claims navigation

Enable the Claims navigation item only if a household-wide claims page provides a
real advantage beyond the visit detail and Benefits page. If included, keep it a
simple history with filters for year, status, benefit, and person. It must not be
a prerequisite for the core workflow.

## API shape

Add a benefits router with operations for:

- year overview
- insurance-plan create and update
- insurance-plan delete when it has no referenced claims
- benefit create and update
- benefit delete when it has no referenced claims
- benefit detail with contributing claims

Extend the visits router with:

- visit cost on create and update
- financial totals in visit detail responses
- claim create, update, and delete operations

Extend planning responses with care-item financial summaries. Keep all money
calculations and authorization-style scope checks in server-side domain helpers so
the page components only render validated results.

Mutation responses should provide field-level validation messages for invalid
money values, mismatched people or years, and reimbursement totals above the
visit cost.

## Database migration

Create one generated Drizzle migration that:

1. Adds `insurance_plans`.
2. Adds `benefits`.
3. Adds nullable `cost_cents` to `visits`.
4. Adds `claims` with foreign keys and indexes for visit, benefit, and status.

Use integer cents for every monetary value. Do not use floating-point database
columns or calculations.

No backfill is required for existing visits; their costs remain unknown.

## Implementation sequence

1. Add money parsing, formatting, and calculation helpers with unit tests.
2. Add schema changes and generate the migration.
3. Implement insurance-plan and benefit validation and API operations.
4. Implement the Benefits page and its year-based overview.
5. Add visit cost to visit forms and detail responses.
6. Implement claims and visit financial totals.
7. Add care-item financial summaries.
8. Add the optional household claims history only if the core screens do not make
   claim records sufficiently discoverable.
9. Update `docs/DOMAIN.md` and `docs/ROADMAP.md` to reflect the combined phase and
   the final claim-allocation model.
10. Complete unit, router, integration, and end-to-end verification.

## Verification

### Domain and unit tests

- money input parses dollars to integer cents without floating-point errors
- shared and person-specific benefit eligibility
- calendar-year matching between visits and benefits
- submitted and denied claims do not consume benefits
- paid claims update benefit usage and visit reimbursement
- opening usage contributes to used and remaining amounts
- multiple paid claims can split one visit cost across benefits
- paid claims cannot total more than the visit cost
- changing visit cost cannot invalidate existing paid claims
- care-item totals aggregate linked visits and disclose missing costs
- remaining and over-limit calculations are correct

### Router tests

- create, update, list, and safe-delete insurance plans and benefits
- reject invalid scope/person combinations
- reject cross-person and cross-year claims
- claim status transitions recalculate all affected totals
- referenced plans and benefits cannot be deleted
- deleting a visit removes its claims

### End-to-end scenarios

1. Create a calendar-year plan with one person-specific benefit and one shared
   HSA benefit.
2. Enter opening usage and confirm the remaining amount.
3. Record a visit with a cost.
4. Add a paid claim against the person-specific benefit.
5. Add a second paid claim against the shared HSA.
6. Confirm that reimbursement, out-of-pocket cost, and both benefit balances are
   updated automatically.
7. Confirm that the linked care item displays the aggregate financial summary.
8. Add a submitted claim and confirm it appears as pending without reducing the
   remaining balance.
9. Attempt to over-allocate the visit and confirm the mutation is rejected with a
   useful message.

Run the complete project verification suite:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

## Acceptance criteria

- The user can see annual coverage, usage, pending amounts, and remaining dollars
  for the benefits they choose to track.
- Both household-shared and person-specific benefits are supported.
- A visit can split reimbursement across multiple benefits.
- The user enters allocations manually and all totals update automatically.
- Only paid claims reduce remaining coverage.
- Visit and care-item summaries clearly show cost, reimbursement, and out of
  pocket without requiring manual arithmetic.
- Existing care planning, visit history, provider, and document workflows continue
  to work for records with no financial data.
- No insurer rule engine, automatic allocation, or claim submission is introduced.

## Explicitly deferred

- automatic claim submission
- insurer portal integrations
- eligibility verification
- automatic selection or ordering of benefits
- coordination-of-benefits rules
- submitted-versus-approved amount tracking
- visit-count, percentage, deductible, family maximum, and lifetime limits
- benefit periods that do not follow the calendar year
- multiple currencies and currency conversion
- receipt parsing or automatic extraction
- tax and accounting reports
- predictions about whether an insurer will pay a claim

