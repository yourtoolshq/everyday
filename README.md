# Passbook

Passbook is a self-hosted app for keeping track of household financial accounts and the records that belong to them.

The main problem it solves is simple:

> Know which accounts exist, which statements should exist, and which ones are missing.

Passbook is not meant to be a generic document manager or a full budgeting app. It focuses on financial relationships such as bank accounts, credit cards, investment accounts, loans, mortgages, and similar account-based records.

## Current focus

The first version is centered on:

- financial institutions;
- household account ownership;
- active and closed accounts;
- statement schedules;
- uploaded statements;
- missing statement detection;
- other important account-level documents.

For example, Passbook should be able to show that an account has monthly statements and that March and July are missing without requiring a manually maintained spreadsheet.

## Boundaries

Not every document involving money belongs in Passbook.

A mortgage account may live here, while property maintenance belongs in the home app. A vehicle loan may live here, while the vehicle insurance policy belongs with the vehicle. Payslips belong in the employment domain, and medical receipts belong in First Aid.

The app should stay focused on the financial relationship itself.

## Future direction

Passbook may eventually connect with other Your Tools apps, including a budgeting app, property management, Garage, Taxbook, and employment tracking.

Those integrations should be added only when they solve a real workflow.

## Project docs

- `docs/PRODUCT.md` — product goals and scope
- `docs/DOMAIN.md` — domain model and boundaries
- `docs/ROADMAP.md` — phased implementation plan
- `AGENTS.md` — guidance for coding agents
