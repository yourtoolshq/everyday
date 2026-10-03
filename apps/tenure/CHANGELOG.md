# Tenure Changelog

User-visible changes only. See [DEVELOPMENT.md](../../DEVELOPMENT.md) for changelog policy.

## Unreleased

### Added

- Employers can have optional PNG or WebP icons, contact details, and structured addresses in different countries. Employer icons appear beside names throughout Tenure, and the employment list shows a flag when the employer has a country.

### Changed

- Compensation amount fields show a `$` prefix, and commission fields show a `%` prefix. The prefix is visual only.
- File upload progress uses a thinner bar.
- Appearance is on General in the sidebar. Light, dark, or system is saved. Data & backups stays storage, backups, and restores.
- Paycheck amounts accept a number or a simple `+ - * /` expression and normalize when you leave the field. A calculator icon marks those fields, and the `$` is not saved.
- Employment, compensation, and paycheck dates can be typed, such as June 01, 2025, or chosen from the calendar. The saved value stays a calendar date.
- Pay periods no longer repeat a paycheck list under the grid. Open a period to view, edit, or delete its paychecks. The list control still switches the whole year.
- A page that fails to load, is missing, or is still loading explains that and offers a way back.

### Fixed

- Saving pay frequency updates the paycheck periods on the employment page without a manual reload.
