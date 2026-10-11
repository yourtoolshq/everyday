# Your Tools design language

Use this as the short decision guide for the apps. The [Phase 5 implementation plan](./docs/phase-5/ui-plan.md) holds code locations, migration order, and proof; this page holds only choices an implementer must repeat.

## Character

Quiet, readable, local-first tools for personal records. Show the record's context and next action. Use the app's own name, accent, and domain words. Prefer existing shadcn/Tailwind primitives and semantic tokens over custom ornament.

## Surface and navigation

- Use `background`, `foreground`, `card`, `muted`, `border`, `primary`, `destructive`, and sidebar tokens for meaning. Each app owns accent values; all tokens must work in light and dark. Appearance is light, dark, or system, and that choice persists. Color never carries status alone: include text or an accessible label.
- Keep the sidebar for primary app areas and the header for the current page. The collapsing shell is shared; each app fills the sidebar and header. Put records under their owning person, employment, account, tax item, or visit. Use breadcrumbs only when the hierarchy is deep enough that a page title and back action are unclear.
- Use a compact card or section for one related task. Prefer a list/table for scannable records and a grid only when position itself conveys meaning, as with period coverage. Preserve a usable list view on narrow screens.

## Entry and actions

- Use a sheet for simple, bounded create/edit/upload tasks while the parent context matters. Use a guided dialog for large or complicated creation (see below), and a compact dialog for a short decision or read-only preview. Use a page for sustained work that needs its own navigation or a resumable workspace. A destructive action uses an alert dialog naming the record and consequence.
- Every field has a visible label; required and optional meaning is clear. Put help and validation beside the field. Keep entered data during a failed save, disable duplicate submit while pending, and show the result where the user can act on it. A toast can confirm a completed action.
- Pick a calendar date with the shadcn date picker input: type a date such as June 01, 2025, or open the calendar. Do not reinterpret a date-only value as an instant. Show money and percent with `InputGroup` and `InputGroupText` (`$`, `%`). The adornment is presentation only and is not stored in the value. A money field that allows arithmetic shows a trailing icon and accepts a number or a simple `+ - * /` expression such as `10+12+34.5`; on commit, show the total formatted as money. It is not arbitrary code. The app still decides allowed range and rounding.
- Documents are opened from their owning record. Show file identity and available open, edit, and delete actions with the shared document action row when the file is already stored. Keep original files and domain relationships visible; use the existing shared file UI where it fits.

## Guided creation

Use a guided, multi-step flow when adding a major domain record or when intake combines conditional fields, several related sections, or a document and substantial metadata. Roof property creation is the reference. Future examples include adding a Passbook account and adding an investment statement with optional details; a routine statement upload can remain a short form.

- Open a large, almost full-screen shadcn `Dialog` to remove distractions. Keep the actual content centered at a readable width, with a clear title, named steps, a scrolling body, and consistent Back/Continue/Save actions. Fit the dialog to narrow screens and preserve keyboard navigation, focus management, and light/dark contrast.
- Ask for choices that determine later fields first, then show only applicable fields in small, coherent groups. Keep record type separate from lifecycle status. Derive known context from the parent record, and let optional enrichment be skipped or completed later.
- Preserve entered values across Back/Continue and changes of branch. Validate the current step before continuing, and validate the complete applicable payload before saving. Show actionable errors beside their fields; retain the draft after a failed save and prevent duplicate saves while pending.
- End with a readable review and actions to revisit each section. Name the final action for the record being created. Confirm before discarding an unsaved draft; do not silently save partial domain records on Continue. Where an app already supports persisted drafts or separate file/detail saves, retain those explicit boundaries and explain what has been saved.
- Show a selected image as a real preview beside the fields on wider screens and below them on narrow screens, with replace/remove actions. For document intake, show file identity and an appropriate preview; keep the source visible when entering facts from it. An attachment filename alone is insufficient feedback for a property photo.
- Keep focused edits simple rather than forcing every edit through the creation steps. Apps own step content, branching, schemas, terminology, uploads, persistence, and mutations. Reuse shadcn primitives now; promote a small shared presentation shell only after a second real consumer proves the same interaction needs.

Track adoption and possible sharing in the [architecture candidate register](./docs/phase-3/architecture-audit.md#guided-creation-follow-up). This guidance does not require immediately rebuilding existing app flows.

## States and status

- Loading preserves page structure; empty states say what is absent and offer the relevant next action; errors say what failed and provide retry or recovery when possible. A route that fails, is missing, or is still loading says so in the page instead of going blank. Success feedback is brief. Never rely on an indefinite spinner or a toast alone for a blocked form.
- Period coverage shows year, frequency, summary, legend, and each period's text status/action through the shared period coverage presentation. A status must remain understandable by keyboard and screen reader. Domain rules decide whether a period is missing, waiting, complete, or not applicable.

## Before promotion

Check keyboard and focus, accessible names, narrow viewport, light/dark contrast, pending/error/empty cases, and a second real app consumer. Keep domain rules, queries, mutations, and copy in the app adapter.
