# Intentional Exclusions

This document records product decisions to **not** build certain features in Tax
Book. These are deliberate scope boundaries, not oversights.

Agents working in this repository should read this document before adding new
tracking workflows, Tax Document types, or document-storage features. If a
request matches an exclusion below, push back and point here unless the user has
identified a concrete exception case described in that section.

## How to use this document

When someone asks to add a feature that appears here:

1. Confirm whether their situation matches the **exception** case, if one exists.
2. If not, explain why it is out of scope for Tax Book and what to do instead.
3. Do not implement "just in case" support without an explicit decision to
   revisit the exclusion.

Add new entries here when the household makes a deliberate scope decision during
development or tax prep. Keep each entry focused on one exclusion with enough
context that a future reader understands the reasoning without reopening the
discussion from scratch.

---

## TFSA annual statements and transaction summaries

**Decision:** Tax Book does not track TFSA annual statements, issuer transaction
summaries, or per-account TFSA document workflows.

**Reviewed:** 2026-03-19

### What these documents are

Canadian financial institutions (for example, a brokerage) send TFSA holders annual
or periodic statements showing contributions, withdrawals, fair market value, and
account activity. Issuers also report this information to CRA through the
[TFSA annual information return](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/tax-free-savings-account-tfsa-issuers/filing/tfsa-annual-information-return.html).

These statements often arrive during tax season alongside slips such as T4s and
T5s, which makes them feel like "tax documents." They are not the same thing.

### Why they are excluded

For a normal T1 filing, TFSA activity does not belong on the return:

- Contributions, withdrawals, and investment growth inside a TFSA are generally
  **not reported** on the income tax and benefit return.
- CRA receives TFSA transactions from issuers and updates contribution room in
  My Account, normally in the spring after year-end reporting.
- In most situations there is **no TFSA tax payable** and therefore no TFSA
  return to file. CRA's
  [TFSA guide for individuals (RC4466)](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc4466/tax-free-savings-account-tfsa-guide-individuals.html)
  states that a TFSA return is required only when specific TFSA taxes apply.

Because of that, TFSA statements do not help Tax Book answer its core questions:

- They do not feed the tax estimate.
- They do not change refund or amount owing on a standard return.
- They do not determine whether the household is ready to file the T1.

Tax Book also distinguishes **Tax Documents** (official slips that provide filing
values for Tax Items) from **Records** (evidence the household retains). Routine
TFSA statements fit neither role cleanly for a standard tax year.

Tracking them would also open a broader product surface: non-registered brokerage
statements, RESP statements, bank summaries, and other institution-account
archives. That is closer to general personal-finance document management than to
the household's T1 preparation workflow. See
[Non-Goals in the product overview](./product.md#non-goals).

### What to do instead

For routine years:

- Archive TFSA statements outside Tax Book (for example, a folder per institution).
- Use them to verify contribution room or reconcile against CRA's TFSA Transaction
  Summary when contributing, not when filing the T1.
- Do not create Tax Items or Tax Documents in Tax Book solely because a TFSA
  statement was received.

### Exception: when TFSA material does belong in Tax Book

Add TFSA-related information only when a **specific tax obligation or dispute**
exists, not for ordinary account maintenance. Examples:

- CRA correspondence about excess TFSA amounts or other TFSA tax.
- Filing or preparing an
  [RC243 TFSA Return](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/rc243.html)
  for excess contributions, non-resident contributions, prohibited or
  non-qualified investments, or an advantage.
- Supporting Records attached to a Tax Item created for that problem.

In those cases, track the **tax issue and its evidence**, not a standing
per-account TFSA document checklist for every year.
