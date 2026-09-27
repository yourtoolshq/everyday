# Phase 5 — remaining UI work

Adopted. The collapsing frame is `@yourtoolshq/ui/app-frame` and `@yourtoolshq/ui/sidebar`. Money fields are `@yourtoolshq/ui/money-field`. Calendar dates are `@yourtoolshq/ui/date-field`. This page records the decisions those components follow.

## Sidebar frame

Extract the shell behavior every app already relies on. Each app still decides what is inside the sidebar and the header.

Share the collapsing sidebar frame: `SidebarProvider`, `--sidebar-width: 17rem`, `--header-height: 3.5rem`, inset layout, sidebar trigger, and the backup banner slot. Pass children for the sidebar body, the header body, and any extra banners. Taxbook's Tenure connection banner stays a Taxbook slot, not a condition inside the frame.

Do not share nav items, group labels, icons, active-route rules, or header title maps. Do not add breadcrumbs.

Proof: collapse and expand on desktop and a narrow viewport, keyboard focus and escape, the active item, the page title, the backup banner, and Taxbook's extra banner. The shared frame should not branch on which app it is rendering.

## Typed fields and money calculator

The stored value never includes `$`, `%`, or other adornment text. `InputGroup` with `InputGroupText` only shows what kind of field it is.

- Money and percent fields use a leading `$` or `%` addon. That text is not part of the input value.
- A date field uses the shadcn date picker input: a typeable date with a trailing calendar button. It is not a native `type="date"` input and not a text addon.

Money fields that allow arithmetic show a trailing icon so the calculator is visible. With that icon, the field accepts a number or a simple `+ - * /` expression such as `10+12+34.5`. On commit, show the total formatted as money. While the expression is being edited, keep the expression visible. Empty stays empty. A bad expression or division by zero is an inline message. Do not use `eval`. Reuse `normalizeDecimalEntry`; do not add a second parser.

The icon is how a field opts in. Percent fields do not get the calculator unless a later change turns that icon on for them. Range, cents, basis points, and rounding stay in the app.

## Dates

Replace native date inputs with the official shadcn date picker input for this repo's `radix-nova` style: type a date, or open the calendar from the trailing button. Arrow Down opens the calendar. Use it wherever a screen asks for a calendar date. Keep the saved value a calendar date, not an instant, so the day does not shift with timezone.

Tenure's compensation timeline and First Aid's care and benefit panels are separate domain screens, not date pickers. Leave those layouts in the apps. Reuse typography, status color, and empty-state guidance there. Do not add a chart or timeline package for one screen.
