# Architecture decision records

These records capture the problems, intended outcomes, and architectural
proposals for Your Tools. They complement the current architecture in
[ARCHITECTURE.md](../../ARCHITECTURE.md) and the phase plan in
[ROADMAP.md](../../ROADMAP.md).

## Release and desktop proposals

| Record                                                     | Proposal                                                 | Status   |
| ---------------------------------------------------------- | -------------------------------------------------------- | -------- |
| [ADR-0001](./0001-independent-desktop-applications.md)     | Independent desktop applications with shared foundations | Proposed |
| [ADR-0002](./0002-app-owned-hosts-and-multiple-clients.md) | App-owned hosts with local and remote clients            | Proposed |
| [ADR-0003](./0003-managed-releases-and-safe-updates.md)    | Prebuilt releases with managed, recoverable updates      | Proposed |

Read these together: product independence defines what users install;
client/host separation defines where records live and how devices access them;
managed releases define how installed applications evolve safely.

The proposals apply to Taxbook, First Aid, Passbook, and Tenure. They record a
future direction for discussion, not the architecture already implemented or
authorization to migrate applications or change production. The roadmap remains
the source of truth for phase sequencing. The current deployment and promotion
contracts continue to apply until an implementation and cutover plan is agreed.

## Record convention

Each record uses the same structure:

- **Problem:** the current difficulty and why it matters.
- **What we are trying to solve:** the outcomes that guide the decision.
- **Proposed decision:** the architectural direction and ownership boundaries.
- **Alternatives considered:** the other approaches and their tradeoffs.
- **Consequences:** benefits, costs, and limitations.
- **Deferred decisions:** questions for later technical or product discussions.
- **Success criteria:** evidence needed before considering the direction proven.

Records begin as **Proposed**. Mark a record **Accepted** only after its direction
is explicitly agreed; acceptance does not imply implementation or production
readiness. Preserve accepted decisions when they are superseded and link their
replacements.

## Reference

[T3 Code's remote architecture](https://github.com/pingdotgg/t3code/blob/8ed276c246b624631e7d39241ebfd22d8314cb68/docs/internals/remote.md)
and
[release workflow](https://github.com/pingdotgg/t3code/blob/8ed276c246b624631e7d39241ebfd22d8314cb68/.github/workflows/release.yml)
were research references for this discussion. They are examples to evaluate,
not an upstream dependency or a requirement to reproduce their technology stack.
