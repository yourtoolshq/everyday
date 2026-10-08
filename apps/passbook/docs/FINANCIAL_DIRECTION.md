# Passbook — Financial direction discussion

> **STILL NEEDS THINKING — exploratory direction, not an approved roadmap.**
> Observe actual household workflows and clarify what makes this product useful
> and distinctive before committing to scope, architecture, or implementation.

This note captures the product discussion. [PRODUCT.md](./PRODUCT.md),
[DOMAIN.md](./DOMAIN.md), and [ROADMAP.md](./ROADMAP.md) remain authoritative for
the current application.

## Proposed direction change

Passbook currently centres on financial accounts and statement completeness.
The proposed direction is broader: help a household understand its financial
position, plan toward goals, allocate money, and verify what actually happened.
Wealth planning and follow-through would become the centre of the experience;
accounts, transactions, relationships, and documents would support it.

Envelope budgeting remains desirable, initially with a small subset of monthly
assignments, spending, moving allocations, carryover, and funding targets.
Historical transactions should also be useful without reconstructing past
budgets, supporting account, vendor, and long-term spending reports.

The distinctive idea to explore is assigning **investment value to purposes**,
alongside cash envelopes. For example, part of an investment account could be
earmarked for a family-support goal eight years away. It remains invested and
part of net worth, but cannot independently fund another goal. Goals may span
accounts; accounts may support multiple goals. Fixed-dollar versus proportional
allocations, gains and losses, and funding shortfalls still need decisions.

Track contribution room separately from goal funding and account balances.
Distinguish planned contributions, actual contributions, and reallocating
existing investments. TFSA and RRSP rules require separate, verified treatment;
record each starting figure's source and date.

## Connected experience and boundaries

These capabilities should form connected workflows, rather than isolated
sections. Follow meaningful links between a paycheck, deposit, budget allocation,
goal contribution, and supporting evidence. Show relevant context locally and
allow a jump to the full source record; automatic matches must be inspectable
and correctable, without duplicating transactions or counting money twice.

Keep focused applications for employment, healthcare, vehicles, properties, and
other domains. From an asset in Roof, a user could link an existing Passbook
transaction or enter purchase details independently. Other apps should remain
useful without Passbook. Record ownership, document references, and cross-app
access still need design; no shared framework or app consolidation is decided.

Passbook may also expand relationships beyond banks to lenders, subscriptions,
service providers, and vendors, connecting terms changes, correspondence,
expected bills or receipts, and payments. These relationships share patterns but
should retain their differences; a one-time payee need not become a managed
relationship.

## Potential roadmap candidates

Candidates only, without priority or phase commitments:

- [ ] Financial position and net-worth history, with dated valuations.
- [ ] Long-term goals and investment earmarking, including valuation behaviour.
- [ ] A minimal envelope budget and recurring funding targets.
- [ ] Contribution-room tracking across accounts, per person and plan type.
- [ ] Planned transfers and contributions linked to actual movements.
- [ ] Historical transaction entry/import, reconciliation, and completeness-aware reports.
- [ ] Account and vendor views connecting transactions, receipts, and agreements.
- [ ] Terms history, agreement comparison, and relevant deadlines.
- [ ] Contextual links to Tenure, First Aid, Roof, and Garage where real workflows need them.

## Distribution and monetization

Continue evaluating this as a desktop, local-first product. A paid application,
paid updates, or optional managed sync, backup, and document processing are
possible models; desktop distribution does not require hosted financial data.
Open versus closed source and the commercial offering remain undecided.
Personal usefulness should guide scope, with monetization explored alongside it.

Next discussion: use observed workflows to refine the product's distinctive
promise, especially how investment goals, cash envelopes, and contribution
planning work together.
