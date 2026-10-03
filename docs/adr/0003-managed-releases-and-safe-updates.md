# ADR-0003: Prebuilt releases with managed, recoverable updates

- **Status:** Proposed
- **Date:** 2026-10-02
- **Scope:** Release delivery and installed-application updates
- **Related:** [ADR-0001](./0001-independent-desktop-applications.md),
  [ADR-0002](./0002-app-owned-hosts-and-multiple-clients.md)

## Problem

The current host workflow obtains source code, builds images, and replaces
running applications through the local deployment setup. Routine updates depend
on host administration and local build work, making delivery cumbersome as
multiple applications evolve.

Simply publishing images or adding a desktop installer does not resolve the
whole problem. Users still need an understandable update experience, and
replacing software that owns personal records must account for data changes and
recovery.

## What we are trying to solve

- Remove source builds and routine deployment commands from normal use.
- Give every installed app an identifiable, independently deliverable release.
- Automate repetitive release work after development checks succeed.
- Protect records and documents through updates and failed upgrades.
- Make update availability, interruption, completion, and recovery visible.
- Support appropriate update policies without equating every merge with a live
  production replacement.

## Proposed decision

Produce prebuilt, versioned application releases through an automated release
process. Installed applications consume those releases through managed update
capabilities instead of building source on the user's computer.

Treat code integration, release publication, and installation as distinct
events. Merging a change should enable automatic candidate publication after
verification. Stable promotion and installation follow an explicit policy for
the intended audience and installation.

Each app owns its release identity and update lifecycle. Shared release and
upgrade foundations may provide consistent behavior, but users do not need to
update all four apps together. Shared changes must be validated for the apps
that adopt them.

Updating a data-owning host includes a recoverable checkpoint of records and
documents, controlled interruption of writes, verification of the replacement,
and a defined response to failure. Reuse the existing data-durability foundation
and require recovery evidence before relying on unattended upgrades.

Client updates and host updates have different responsibilities. Replacing a
client does not transfer ownership of data. Compatibility and update notices
must make clear which component needs attention.

Local desktop updates should be presented inside the app. An independently
running host should support an equivalent managed lifecycle. The exact control
surface can vary without changing the data-safety expectations.

## Alternatives considered

| Alternative                                     | Benefit                        | Tradeoff                                                                    |
| ----------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------- |
| Continue source builds on each host             | Preserves the current setup    | Keeps build and deployment work with the user                               |
| Publish artifacts with manual replacement       | Removes local compilation      | Leaves update coordination and recovery to the operator                     |
| Automatically replace production on every merge | Minimal maintainer interaction | Couples integration to interruption and data changes without release policy |
| One suite-wide release and updater              | Fewer delivery units           | Couples independent products and expands the impact of an update            |

Managed per-app updates address both delivery friction and recovery while
preserving independent products.

## Consequences

Users can receive improvements without maintaining a development environment.
Release identities make support and recovery more understandable, and automated
publication reduces repetitive maintainer work.

The platform takes on responsibility for build distribution, compatibility,
upgrade verification, and recovery behavior. A successful download or process
restart alone does not establish a successful upgrade.

Recovery must account for data compatibility as well as software versions.
Returning to older software may require restoring data; restoring an older
checkpoint after new writes can lose those newer records. The product must make
such consequences explicit rather than promise unconditional rollback.

The current production promotion rules continue to apply. Automatically
installing candidates on a maintainer's own host remains an optional policy to
discuss, with the same data-safety requirements as other updates.

## Deferred decisions

- Versioning, release channels, promotion rules, and supported artifacts.
- CI tooling, artifact hosting, signing, and distribution mechanisms.
- Automatic versus user-initiated installation and maintenance timing.
- Update-controller design, compatibility rules, and failure recovery mechanics.
- Migration from existing Nix/Compose installations and continued container
  support.
- Detailed update interface and operational support commitments.

## Success criteria

A user installs and updates one app without compiling source or issuing routine
deployment commands. Its installed release is identifiable. A failed upgrade
has a demonstrated recovery path covering records and documents, and a
successful update reports the actual installed outcome. Release automation does
not bypass the chosen installation policy or require unrelated app updates.
