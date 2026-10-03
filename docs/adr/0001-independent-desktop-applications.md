# ADR-0001: Independent desktop applications with shared foundations

- **Status:** Proposed
- **Date:** 2026-10-02
- **Scope:** Taxbook, First Aid, Passbook, and Tenure
- **Related:** [ADR-0002](./0002-app-owned-hosts-and-multiple-clients.md),
  [ADR-0003](./0003-managed-releases-and-safe-updates.md)

## Problem

Your Tools contains four applications that solve different personal and
household problems. The current deployment requires development and host
administration work to install and maintain them. Moving to desktop delivery
could improve that experience, but combining all four into one suite would also
couple their installation, presentation, and release lifecycle.

Each application is expected to become a more polished product. Users may need
only one application, and improvements to its onboarding or workflow should not
require redesigning a suite-wide experience.

## What we are trying to solve

- Make each application straightforward to install, open, and maintain.
- Preserve its identity, focused workflow, and ability to evolve independently.
- Allow users to install only the applications they need.
- Avoid implementing the same operational foundations four times.
- Preserve each application's ownership of its domain and records.

## Proposed decision

Deliver four independent desktop applications from the existing monorepo. Each
has its own entry point, onboarding, navigation, settings, release identity, and
data ownership. Installing or using one application does not require installing
the others.

Share proven foundations for desktop lifecycle, connections, data durability,
and managed updates. Shared implementation should support consistent behavior
without imposing a single product experience or requiring all applications to
ship together.

Cross-app integration remains explicit and optional. An application may use
another application's published capabilities while retaining clear ownership of
its own records. Shared foundations do not create a common domain or database.

A mandatory suite launcher or central host manager is outside this proposal.
Revisit such a component only if actual usage demonstrates a benefit that
outweighs its additional installation and lifecycle dependency.

## Alternatives considered

| Alternative                                   | Benefit                                                                       | Tradeoff                                                                |
| --------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| One desktop suite                             | Convenient installation for users who want every app; potential runtime reuse | Couples products and releases, and makes selective adoption harder      |
| Independent apps with duplicated foundations  | Maximum implementation freedom                                                | Repeats operational work and allows safety and update behavior to drift |
| Continue developer-oriented installation only | Smallest immediate change                                                     | Leaves ordinary users responsible for deployment and maintenance        |

Independent apps with shared foundations best balance focused products and
maintainability.

## Consequences

Each app can be polished and released on its own terms. A failure or update in
one app should not require replacing or interrupting the others.

Separate applications require more packaging and verification work and may
duplicate runtime resources. Shared foundation changes can affect several apps,
so compatibility and adoption still require deliberate validation.

Validate foundations in one application and then a second before promoting
shared code, following the repository's existing shared-candidate convention.
Keep existing useful behavior and records intact during adoption.

## Deferred decisions

- Desktop technology, supported operating systems, and packaging formats.
- Repository layout and the exact boundaries of future shared packages.
- How much existing presentation code can be retained during migration.
- Resource usage targets and whether optional runtime sharing is warranted.
- Detailed onboarding, visual polish, and any optional ecosystem launcher.

Electron was the leading research candidate; its selection and implementation
details belong in a later technical decision.

## Success criteria

A user can install and complete a useful workflow in any one app without the
others. The apps retain their own identities and data, and an app-specific
release can be delivered independently. A second app demonstrates that shared
foundations reduce repeated work without erasing product differences.
