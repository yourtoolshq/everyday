# Investment statements — UX follow-up tasks

Status: implementation brief for [issue #118](https://github.com/yourtoolshq/everyday/issues/118).
The implemented behavior is documented in [investment-statements.md](./investment-statements.md).

This brief records the investment statement follow-up discussion. It supplements
[investment-statements.md](./investment-statements.md), which describes the shipped
feature. [PRODUCT.md](./PRODUCT.md) and [DOMAIN.md](./DOMAIN.md) remain authoritative
for product and domain boundaries; [ROADMAP.md](./ROADMAP.md) owns phase sequencing.
Create bounded implementation issues from these tasks when work begins, rather
than maintaining another roadmap here.

## Goal and scope

Make statement entry a repeatable workflow that captures enough context to explain
an account over time. The goal is not to transcribe every printed field. Preserve
the original documents so users, and eventually AI, can inspect deeper context.

In scope:

- Dates-first guided entry beside the PDF.
- Minimal summary fields, remembered optional fields, and account-specific aliases.
- Formatted inputs and useful, explicit holding calculations.
- Automatically remembered holdings with independent historical snapshots.
- Autosaved drafts and an explicit saved version.
- A compact account overview based on the latest saved statement.

Out of scope:

- AI extraction or explanations, live prices, automatic FX conversion, bank sync,
  transaction reconstruction, investment return analytics, and tax gain calculations.
- Generic custom fields, a universal facts engine, and user-managed alias catalogs.
- Structured agreement-change entry in this investment slice. Later work can model
  what changed, its effective date, and its source document separately.
- Shared-package extraction or production deployment.

Use fictional data for documentation, tests, previews, and screenshots. The real
statement supplied during discussion is reference context only; do not commit it,
its identifiers, personal details, or its extracted contents.

## Decisions and proposals

Confirmed direction:

- Remove duplicate inputs where they represent the same fact and scope.
- Keep the PDF on the left during guided entry.
- Remove manual source-page/source-note inputs and the separate Review step.
- Remove routine summary/holdings coverage controls and repeated status badges.
- Remember optional fields and selected aliases per account.
- Remember holdings automatically; explicitly record a holding as zero when no
  longer held, then omit it from future entry without changing older statements.
- Account overview uses the latest saved statement, including its distribution.
- Autosave draft edits on field changes being committed and on leaving entry.

Recommended details requiring resolution in the relevant task:

- Basic summary fields: currency, opening value, closing market value, and book value.
- Keep cash behind Add fields, or make it basic for accounts that consistently report it.
- Start remembered holdings with fresh numeric fields; decide whether previous
  quantities should appear as suggestions or editable carried values.
- Use a donut with separated, bordered segments for distribution, with a compact
  legend; compare this with horizontal bars when there are many holdings.
- Preserve published/saved facts while editing a separate draft. This is the
  proposed implementation of the requested draft-versus-saved-copy experience.

## Task 1 — Define field semantics and persistence contracts

Purpose: prevent the simpler UI from merging different financial facts or losing
historical meaning. Complete this contract before schema and lifecycle changes.

Work:

- Map supported fields to canonical meaning, currency, scope, aliases, and required
  facts for saving. Keep the existing typed investment payload approach.
- Treat closing value and closing market value as one field when they refer to the
  same account/currency total. Keep opening market value distinct by date.
- Allow Book value / Book cost aliases only where their meanings match. Do not
  describe institution-reported book value as tax-adjusted cost base.
- Keep cash balances distinct from total portfolio balances. An opening cash
  balance cannot populate opening portfolio value.
- Keep external withdrawals distinct from cash paid out for investment purchases.
- Define blank as unreported/unentered and zero as an explicit reported or confirmed
  zero. Hiding a field never clears its existing value.
- Preserve account-total versus currency-component scope even if its technical
  selector moves behind an advanced action. Never sum converted totals and native
  components together.
- Define which data is statement fact, account entry preference, remembered holding
  membership, draft content, and a derived display value.
- Audit all readers that currently depend on reviewed status or section coverage:
  account history, comparisons, period badges, global Holdings, holding exposure,
  and reconciliation.

Acceptance:

- A field/alias mapping and save contract are documented in the implementation issue.
- No alias maps a cash-flow subtotal to an external contribution or withdrawal.
- Multiple currencies and summary-only statements remain supported.
- Draft and saved readers have explicit eligibility rules; omissions never imply sales.

## Task 2 — Autosaved draft and explicit saved version

Purpose: make entry durable without publishing unfinished edits to account insights.
Depends on Task 1. This is functional persistence work, not just button relabeling.

Work:

- Maintain an editable draft separately from the statement's saved facts.
- Autosave on field blur/commit, section changes, and workspace navigation. Coalesce
  rapid edits and serialize saves so older responses cannot overwrite newer edits.
- Support incomplete drafts, including unfinished rows and dates. Apply strict
  financial validation when publishing saved details, rather than discarding edits
  that do not yet meet the current save command's validation.
- Provide Save statement details as the explicit commit action. Remove Review.
- When editing a saved statement, account and Holdings views continue using the
  saved version until the new draft is explicitly saved.
- Show compact Saving, Draft saved, and Couldn't save feedback with retry.
- Preserve entered content on failures. Prevent duplicate commits and stale writes.
- Keep revision/concurrency protection, including conflicts between windows.
- Handle navigation with pending or failed writes: await the flush for app navigation
  and provide recovery for failure. Define desktop-close behavior; do not rely only
  on an asynchronous unload request to guarantee persistence.
- Define draft discard/reset behavior and distinguish it from removing saved details.
- Migrate existing reviewed facts to saved facts without inventing values. Preserve
  existing drafts as drafts and retain old provenance metadata.

Acceptance:

- Reopening after successful autosave restores the latest committed draft edits.
- A failed autosave keeps local edits visible and provides retry.
- Editing, abandoning, or discarding a draft does not change the saved overview.
- Save validates and atomically publishes the intended revision, then refreshes
  affected account/holding views.
- Two-window conflicts cannot silently overwrite facts.
- Existing saved history survives migration; document upload/period completion is unchanged.

## Task 3 — Dates-first guided workspace

Purpose: present the statement's context before its amounts. Depends on Tasks 1–2.

Work:

- Order sections Dates → Summary → Holdings; allow free navigation and resume.
- Suggest coverage start/end from the selected monthly, quarterly, or annual period.
  Suggest valuation date from period end, clearly editable rather than a confirmed fact.
- Keep issue date, coverage dates, and valuation date semantically separate.
- Avoid guessing dates for irregular documents without enough period information.
- Keep PDF page/zoom controls available throughout, with independent scrolling.
- Reduce header badges to statement identity and compact draft/save feedback.
- Remove the dedicated Checks section and Review action. Put actionable validation
  and useful discrepancies beside the relevant fields.
- Remove source page and source note from summary and holding entry, while preserving
  already-stored provenance through edits.
- Make narrow layouts usable with a PDF/entry toggle or stacked presentation.

Acceptance:

- First entry starts with dates, then basic summary, then holdings.
- Users can correct suggestions and revisit sections without losing edits.
- PDF stays visible on desktop; entry remains usable at narrow widths.
- Keyboard navigation, focus, and errors work without hover-only interaction.

## Task 4 — Minimal summary and remembered optional fields

Purpose: show what the account regularly needs rather than every supported field.
Depends on Tasks 1–3.

Work:

- Start with currency, opening value, closing market value, and book value, subject
  to the cash-default decision above. Opening value may remain blank if unreported.
- Replace the current expandable block of all period flows with Add fields.
- Offer cash, contributions, withdrawals, transfers in/out, income, fees, and reported
  value change as supported optional fields.
- Persist enabled fields per account, isolated from other accounts.
- Reveal any populated field when reopening older statements, regardless of current
  account preferences. Hiding a populated field must not destroy its value.
- Remember explicitly selected currency defaults without converting existing amounts.
- Keep additional currencies/components available behind a clear secondary action.

Acceptance:

- Adding Fees makes it visible in the next statement for that account.
- Another account keeps its own field setup.
- Historical optional values remain visible and editable.
- Changing display preferences does not rewrite historical facts.

## Task 5 — Account-specific aliases and contextual help

Purpose: let users match the institution's terminology without duplicating facts.
Depends on Tasks 1 and 4.

Work:

- Introduce a code-owned alias list for supported fields; no custom field builder.
- Show the selected alias as the visible label and retain the canonical field key.
- Use a tooltip for definitions/alternate wording and a menu/popover for changing
  the alias. Make both accessible by keyboard and touch.
- Remember the selection per account. Store preferences separately from facts.
- Explain meaningful scope distinctions, particularly portfolio versus cash balances.

Acceptance:

- A changed alias persists for future account entry without creating another amount.
- Alias changes never change currency, scope, stored value, or calculation meaning.
- Definitions and alias selection are accessible without a mouse.

## Task 6 — Numeric inputs and holding calculations

Purpose: improve entry clarity and reduce avoidable arithmetic. Depends on Task 1;
integrate with Tasks 2–5.

Work:

- Adopt existing money input patterns: currency prefix, formatted commit/blur,
  tabular numbers, and restricted arithmetic expressions where supported.
- Use explicit codes for ambiguous currency symbols. Keep visible field labels.
- Give quantity and unit price suitable precision; do not round fractional holdings
  to money precision. Use exact decimal arithmetic for financial calculations.
- Offer quantity × unit price when both inputs exist and currencies match the value.
- Mark calculated values and allow a reported market value to override them.
- Specify the calculation interaction: a reported override must not be silently
  replaced when quantity or price changes. Preserve reported/calculated distinction.
- Keep unit-price, market-value, and book-value currencies distinct. A foreign
  unit price cannot directly produce a domestic reported market value without FX.
- Add Market − book difference with direction icon, signed amount, and optional
  percentage using book value as denominator. Suppress percentage at zero book value.
- Tooltip/focus details show both values, currency, and calculation. Use neutral
  language: this is neither investment return nor tax gain.
- Handle reported total versus entered-lines differences as contextual hints. Keep
  reported totals authoritative; rounding mismatches do not block saving.

Acceptance:

- Missing amounts remain blank rather than becoming zero.
- Calculations work with fractional quantities and decimal money deterministically.
- Mismatched currencies disable the relevant calculation/comparison with an explanation.
- Reported overrides survive later edits and reopening.
- Differences are understandable without color alone, and available on keyboard focus.

## Task 7 — Remembered holdings and historical snapshots

Purpose: make recurring holdings part of normal entry, replacing an obligatory copy
action. Depends on Tasks 1–2; integrates with Task 3.

Work:

- Seed a new statement from the account's active remembered holding list, initially
  derived from appropriate earlier saved facts. Do not copy stale prices or values.
- Remember instrument identity, printed label, and currencies. Preserve support for
  multiple lines of the same instrument; do not collapse distinct source rows.
- Decide whether quantity is blank, suggested, or carried forward with confirmation.
- Provide No longer held to explicitly record zero in the current snapshot and
  retire that row from future entry after saving.
- Do not copy historical book value onto a zero position. Define which amount fields
  become zero and which remain unreported; unit price need not be invented.
- Omit retired rows from later default lists, but allow reactivation when held again.
- Do not interpret blank, hidden, or deleted draft rows as a sale or confirmed absence.
- Define behavior for editing/backdating older statements: saving an older snapshot
  must not accidentally reset the current account's remembered active list.
- Existing saved statements remain independent snapshots. Changes to instrument
  membership or entry preferences never mutate their quantities or amounts.

Acceptance:

- A newly saved holding appears automatically in the next statement's entry list.
- Explicitly retiring it records zero in that snapshot and removes future entry clutter.
- Older statements retain their original rows and values.
- An untouched remembered row remains unentered, not zero.
- Backdated edits, duplicate instrument lines, reactivation, and draft discard behave
  predictably and do not alter current membership unintentionally.

## Task 8 — Simplify statuses without inventing completeness

Purpose: remove manual bookkeeping while retaining trustworthy read models.
Depends on Tasks 1–2 and 7.

Work:

- Remove routine section coverage selectors and repeated coverage/review badges.
- Retain the independent distinction between uploaded PDF and entered/saved details.
- Determine safe comparison behavior when holdings completeness is unknown. Do not
  automatically mark a list complete merely because all visible rows are filled.
- Treat explicit No longer held as evidence for that holding; omission alone is not.
- Suppress unsupported disappearance, zero-exposure, or whole-portfolio claims.
- Label distributions as entered holdings when full coverage cannot be established.
- Keep only short contextual messages where missing facts prevent an insight.
- Update global Holdings/exposure readers along with account and statement readers.

Acceptance:

- Users do not need to select summary/holdings status during ordinary entry.
- Partial/manual data does not imply a sale or complete portfolio allocation.
- Summary-only saved statements remain useful in balance history.
- Upload completeness continues to depend on document presence, not enrichment.

## Task 9 — Minimal account overview

Purpose: answer where the account stands using its latest saved statement.
Depends on Tasks 2, 6, and 8.

Work:

- Lead with latest saved closing market value, currency, and valuation date.
- Show a compact previous-statement change pill, balance chart, and latest holdings
  distribution. Replace the current stack of text, lists, and comparisons.
- Use latest valuation date, not upload order. Define tie handling for multiple saved
  statements on the same date; do not arbitrarily choose conflicting snapshots.
- If the latest statement lacks a total, show that absence; do not silently portray
  an older amount as current. Any fallback must carry its actual date.
- Add 3M, 6M, 1Y, and All chart ranges. Points represent saved observations, not live
  daily values; missing periods are not zero balances.
- Separate currencies and never silently convert or sum incompatible scopes.
- Show latest holdings distribution including entered cash, with bordered/separated
  segments and a compact legend, or bars if they communicate many holdings better.
- Define denominator explicitly: allocation among entered lines versus coverage of
  the reported account total. Do not present partial entry as the whole portfolio.
- Keep full history and detailed comparison available as secondary views. Historical
  inspection does not replace the default latest-statement distribution.
- Cover empty, one-statement, missing-value, loading, and error states.

Acceptance:

- Account overview stays on the latest saved facts while a draft is edited.
- Value and distribution show their actual statement date and currency.
- Range controls work without inventing observations.
- Historical details remain reachable without dominating the default page.
- Distribution supports light/dark themes, keyboard-accessible detail, and narrow screens.

## Task 10 — Previous-statement change pill

Purpose: provide a compact historical comparison without implying performance.
Depends on Tasks 2 and 9.

Work:

- Compare closing values for the same account, currency, and scope from compatible
  saved statements. Use the previous statement, not necessarily the previous month.
- Show direction, signed amount, and percentage when the earlier value is nonzero.
- Tooltip/focus content shows both dates, both values, and the meaning of the change.
- Describe this as account value change, including the effects of contributions and
  withdrawals. Do not call it return, earnings, or profit.
- Hide or explain unavailable comparisons instead of substituting zeros.
- Reuse the behavior on a saved statement overview where useful. Keep it distinct
  from the holding-level market-versus-book difference.

Acceptance:

- Quarterly schedules and missing months have accurate comparison wording.
- Zero earlier values, missing totals, mixed currencies, and date ties are handled.
- Amount and percentage are exact decimal calculations with display rounding only.

## Implementation surfaces

Start with these existing files/modules; keep runtime routes thin and changes app-local:

- `shared/components/investment-statements/investment-statement-workspace.tsx`
- `shared/components/investment-statements/investment-summary-panel.tsx`
- `shared/components/investment-statements/investment-positions-panel.tsx`
- `shared/components/investment-statements/investment-form-state.ts`
- `shared/components/investment-statements/investment-labels.ts`
- `shared/components/investment-statements/money-field-group.tsx`
- `shared/components/investment-statements/account-investment-panel.tsx`
- Existing chart, comparison, badge, reconciliation, and instrument-picker components.
- `shared/modules/investment-statements/` for lifecycle, validation, persistence,
  comparisons, reconciliation, and exact decimal arithmetic.
- `shared/modules/investments/` for catalog and holding exposure readers.
- `shared/server/api/routers/investment-statements.ts`, `shared/server/db/schema.ts`,
  and generated migrations when persistence contracts change.
- `client/src/routes/investment-statement.tsx` and existing statement/upload entry points.

Do not assume the current single enrichment revision and reviewed/draft status can
represent two independently retained copies without changes. Review atomic save,
revision, removal, and migration behavior before selecting the persistence design.

## Delivery and verification

Suggested issue grouping, rather than one large rewrite:

1. Semantics and lifecycle contracts: Task 1, followed by Task 2.
2. Guided entry and account preferences: Tasks 3–5.
3. Numeric assistance and remembered holdings: Tasks 6–8.
4. Account insights: Tasks 9–10.

Before implementation, resolve each task's open choices in its issue and include
dependencies, acceptance criteria, migration implications, and validation. These
briefs do not authorize automatically implementing an entire roadmap phase.

For application changes:

- Run `pnpm check:passbook` and targeted investment entry E2E when flows change.
- Add meaningful domain/service tests for drafts versus saved facts, concurrency,
  retirement, backdated edits, currency guards, differences, and comparison eligibility.
- Verify migration from fictional legacy draft/reviewed examples without lost facts.
- Exercise autosave recovery, navigation, reopen, explicit Save, and overview updates
  end to end. Test the desktop close behavior if changed.
- Check visible labels, keyboard/focus, touch-accessible help, light/dark contrast,
  narrow layout, and pending/error/empty states. No component tests unless requested.
- Update shipped product/domain/feature docs as behavior lands and add a Passbook
  changelog entry for user-visible changes. Keep this brief linked to implementation
  issues rather than duplicating their live status.

Completion means recurring entry works without repeating field setup, saved
history remains stable during edits, retired holdings retain their history, and
the account overview communicates the latest statement clearly without overstating
what the entered data proves.
