# Phase 5 — remaining UI work

The migrations in [ui-plan.md](./ui-plan.md) are adopted. This is the handoff for what that plan left open. Do not repeat the primitive, theme, period-coverage, document-action, route-state, or money-expression work.

## Sidebar frame

Optional. Do this only if a shared frame stays smaller than the four shells it replaces.

The four `layout/app-shell.tsx` files already use `SidebarProvider`, `--sidebar-width: 17rem`, and `--header-height: 3.5rem`. Passbook, Tenure, and First Aid then render sidebar, header, and `BackupStatusBanner`. Taxbook adds `TenureConnectionBanner` and wraps children in `<main>`. The sidebars differ in nav items, group labels, icons, and active-route rules. The headers differ in title maps and the private-storage label.

Share a frame that accepts the sidebar, the header, and optional banners. Apps keep nav items, route titles, banners, and contextual controls. Do not share a nav config, breadcrumbs, or one header title helper. Breadcrumbs stay guidance.

Proof: desktop and narrow nav, active item, focus and escape, page title, backup banner, Taxbook's Tenure banner, and the header on a narrow viewport. Stop if the shared component needs app conditionals for those differences.

## Percent expressions

Wait until a percent field needs the same on-blur commit as money. The `%` prefix is already in place. `normalizeDecimalEntry` in `@yourtoolshq/ui/decimal-entry` is the parser; do not add a second one.

Candidates, still prefix-only today:

- Tenure commission percentage on the compensation change sheet and the employment form.
- Passbook interest rate and promotional interest rate on account terms.

Adopt in one of those forms, then the other, only if both want expressions. Keep the 0–100 commission check, basis-point conversion, and any Passbook rate range in the app. Empty stays empty. Show the same inline failure for a bad expression or division by zero. Do not use `eval`.

## Dates and one-off visuals

Leave these in the apps.

Date fields stay native `type="date"`. Extract a picker only after a repeated calendar-date problem shows up in two apps. Saved dates must not shift timezone.

Tenure's compensation timeline and First Aid's care and benefit panels answer different questions. Reuse typography, status color, and empty-state guidance. Do not add a chart or timeline package for one screen.
