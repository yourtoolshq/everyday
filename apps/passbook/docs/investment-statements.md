# Investment statement understanding

Passbook provides optional manual detail entry for investment, TFSA, RRSP, and
FHSA statements. Keep the original document, enter useful statement-reported
figures beside it, and understand the account through saved historical facts.
The goal is useful context, not transcription of every printed field.

[PRODUCT.md](./PRODUCT.md) and [DOMAIN.md](./DOMAIN.md) own product and domain
boundaries. [ROADMAP.md](./ROADMAP.md) owns sequencing. The follow-up task brief
and design decisions are in
[investment-statement-ux-tasks.md](./investment-statement-ux-tasks.md).

## Upload and entry

Upload remains a fast, independent workflow. Save statement keeps the upload-only
path; Save and enter details opens the workspace. Uploading satisfies a period
cell whether or not investment details have been entered. Legacy files need no
rework, and one document still belongs to one account and one period.

The workspace follows Dates → Summary → Holdings, with free section navigation
and the PDF visible on the left on wide screens. PDF page and zoom controls remain
available. Narrow screens offer a View PDF toggle above entry; the holdings table
scrolls independently when needed.

- Dates are suggested from monthly, quarterly, or annual period keys. Users check
  and edit them against the statement. Issue date, actual coverage, and valuation
  date remain distinct. Irregular periods without usable keys are not guessed.
- Summary starts with currency, opening value, closing market value, and book value.
  Add fields reveals cash, contributions, withdrawals, transfers, income, fees,
  and reported value change. Account preferences remember enabled fields, currency,
  and selected aliases. Populated historical fields always remain visible.
- Hardcoded aliases change labels, not fact keys or meanings. Opening cash is not
  opening portfolio value; closing cash is not closing portfolio value; investment
  purchases are not external withdrawals. Custom aliases/fields remain deferred.
- Money inputs format on blur and support restricted decimal + − * / expressions.
  Quantity remains precise, and unit prices preserve up to the domain's supported
  decimal precision. Currency codes are explicit.
- Holdings support the reusable catalog, symbol/exchange or fund-code/issuer search,
  and inline instrument creation. Printed labels remain separate from identities.
- Quantity × price is an explicit suggestion only when currencies match; users
  can enter the reported value instead. It never replaces an existing market value.
- Market − book pills show signed differences and optional percentages, with
  definitions on hover/focus. They are not investment return or tax gains.
- Holding details retain identifiers, series, and currency controls. Manual source
  page/note inputs and routine coverage selectors are hidden. Existing provenance
  is preserved through edits.

## Draft and saved facts

Drafts are persisted separately in `investment_entry_drafts`, associated with the
owning document. Incomplete numeric text, blank dates, and unfinished rows can be
stored without replacing the saved financial snapshot. Date inputs still commit
only a valid date or an explicit blank; invalid date text stays in the input until
corrected.

Committed edits autosave after a short debounce, on field blur, and section
changes. Draft writes are serialized and use an opaque revision token. The
workspace displays Saving draft, Draft saved, or an error with retry. A local
recovery copy protects edits pending a host write; successful writes clear it.
Navigation through the account back link awaits the flush, unmount attempts a
flush, and closing with unsaved changes triggers the browser's unload protection.
This does not introduce a new native Electron close protocol.

Save details validates financial inputs and atomically replaces the saved snapshot
and clears the matching draft. The separate Review interaction is removed.
Internally saved details retain the existing `reviewed` header status so existing
holding readers remain compatible. Legacy `save` / `review` procedures remain for
compatibility; the new workspace uses `saveDraft` / `publish`.

Editing a saved statement leaves its previous saved facts available to history,
comparisons, and Holdings until Save details succeeds. Discard draft restores the
saved facts, or a fresh suggested form if no saved facts exist. Conflicts preserve
local edits and offer Reload latest rather than silently overwriting another
window. Reload explicitly replaces local work with the host version.

New manual saves use conservative partial coverage when facts are present.
Filling visible fields does not establish whole-portfolio completeness. Existing
historical coverage metadata remains stored, and omission never implies a sale.
The document's period-completion rule is unchanged.

## Remembered holdings

New entry reuses holding identities, labels, series, and currencies from earlier
saved statements for that account. Quantity, price, market value, book value, and
source references start blank. Repeated rows remain separate.

Omitted rows in a later partial statement do not erase remembered holdings.
No longer held explicitly records zero quantity, market value, and book value
(cash has no quantity), and removes that row from subsequent entry defaults after
saving. It does not change prior statements. A zero market value with nonzero
quantity does not retire a holding. Add line can reintroduce a previously held
instrument.

Seeding uses only statements before the new valuation date, so a backdated edit
does not overwrite an account-wide mutable holding list. Ambiguous same-date
history blocks automatic seeding rather than choosing a source arbitrarily.

## Account overview

The overview leads with the latest saved statement's closing market value,
valuation date, and previous-statement change pill. It appears above the statement
period grid. Unfinished drafts do not replace it.

- Balance history has 3M, 6M, 1Y, and All ranges ending at the latest valuation date.
  Points are statement observations, not live daily prices. Missing periods are
  not zero balances.
- Holdings distribution uses the latest saved statement and selected value currency,
  with separated, bordered donut segments and a numeric legend. Summary cash is
  included only when there is no cash position in that currency, avoiding duplication.
- Percentages describe entered valued lines, not verified whole-portfolio coverage.
  Missing holding values are called out. Different currencies are never summed.
- Full saved history and detailed two-statement comparison are available in a
  secondary expandable section. Historical inspection does not replace the default
  latest-statement distribution.
- Conflicting latest same-date snapshots show a resolution prompt instead of an
  arbitrary balance. A missing latest total is shown as missing, not silently
  replaced with an older figure. Ambiguous historical dates are excluded from the
  history chart.

The account change pill compares matching currency/account-total scopes. Its detail
shows both dates and values; zero earlier values suppress the percentage. Change
in account value includes contributions and withdrawals and is not investment return.

Global Holdings and individual holding exposure continue using saved snapshots,
with native currencies, source dates, and conservative completeness rules. They
are not a live household portfolio total.

## Persistence and ownership

The document enrichment header stores kind, schema version, entry method, legacy
review status, and saved revision. Financial facts remain in typed snapshot,
summary-total, and position tables. No generic field engine or per-field fact
schema is introduced.

Ownership: total/position → snapshot → enrichment → document → account. Drafts
belong to documents; presentation preferences belong to accounts. Both new tables
cascade with their owners. Existing uploads, saved snapshots, and optional source
references require no guessed backfill. Migration `0014_wet_mandarin` adds only
the draft and preference tables.

Saved edits are atomic and reject stale saved revisions. Draft tokens prevent
stale draft writes, commits, and discards, including after a draft was discarded
and recreated. Financial arithmetic uses exact decimals in the domain; conversion
to JavaScript numbers is limited to chart coordinates.

Summary totals retain explicit currency and `account_total` / `currency_component`
scope. Converted totals and native components are never added together. A USD
unit price can coexist with a CAD reported holding value; automatic FX conversion
is not performed. Institution-reported book cost is not tax-adjusted cost base.

### Implementation reference

- `shared/modules/investment-statements/`: lifecycle, validation, persistence,
  comparisons, reconciliation, entry assistance, and exact decimal calculations.
- `shared/modules/investments/`: instrument catalog and holding exposure readers.
- `shared/components/investment-statements/`: workspace, account overview, charts,
  and holding entry.
- `shared/server/api/routers/investment-statements.ts`: existing get/list/save/review/
  remove, plus entry, saveDraft, publish, discardDraft, and savePreferences.
- `/statements/:documentId/investments`: guided entry.
- `/holdings`: catalog and source-linked observations.

## Deferred

AI extraction/explanations, activity rows, live prices, bank sync, automatic FX,
return analytics, household net worth, tax filing, custom field/alias management,
and additional enrichment kinds remain separate work. Agreement changes should
retain their effective date and source document in their own future slice.

## Verification

Run `pnpm check:passbook` and the investment entry E2E suite. Domain/repository tests
cover decimal assistance, dates, retirement, historical isolation, saved/draft
revision guards, discard/recreation, preferences, and migration compatibility.
Use fictional statements and data only.
