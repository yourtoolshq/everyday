# Your Tools — Development Workflow

Practical workflow for the monorepo maintainer and contributors. Platform purpose lives in [PRODUCT.md](./PRODUCT.md); structure in [ARCHITECTURE.md](./ARCHITECTURE.md); phased plan in [ROADMAP.md](./ROADMAP.md).

## Local verification

| Command               | Scope                                                     |
| --------------------- | --------------------------------------------------------- |
| `pnpm check`          | Format + lint + typecheck + test + build for all packages |
| `pnpm check:taxbook`  | Quality gates for Taxbook only                            |
| `pnpm check:firstaid` | Quality gates for First Aid only                          |
| `pnpm check:passbook` | Quality gates for Passbook only                           |
| `pnpm check:tenure`   | Quality gates for Tenure only                             |

When E2E or Docker verification is warranted:

```bash
pnpm turbo run test:e2e -F <app>
pnpm docker:build:<app>
```

## Normal workflow

1. Open a GitHub Issue when work is non-trivial (bugs, features, refactors, shared candidates).
2. Branch: `work/<issue>-<slug>` (e.g. `work/42-passbook-statement-grid`).
3. Implement bounded changes; read root guidance and every affected app's `AGENTS.md`.
4. Run the relevant `pnpm check:<app>` (or `pnpm check` for platform-only changes).
5. Open a PR with title `<app-or-platform>: <imperative summary>`.
6. Wait for `CI / required` on the PR; resolve review threads; squash merge.

**Issues are not required** for typos, documentation corrections, or obvious localized fixes.

## Maintainer fast path

Repository admins may bypass branch protection and push directly to `main` when **all** of the following hold:

- Change is documentation, copy, comments, or an obvious localized correction
- No schema, migrations, dependencies, storage, integrations, CI, Docker, or shared tooling changes
- Verified locally with `pnpm check:<app>` or `pnpm check` for platform docs/config
- Full CI runs on push; any failure is fixed or reverted immediately

Anything uncertain, cross-app, data-sensitive, or architectural uses Issue → branch → PR.

## Branch protection (GitHub settings)

Configure a **repository ruleset** on `main`:

| Rule                                 | Setting                       |
| ------------------------------------ | ----------------------------- |
| Require pull request                 | Yes (default path)            |
| Required status check                | `CI / required`               |
| Require resolved conversations       | Yes                           |
| Block force-push and branch deletion | Yes                           |
| Bypass                               | Repository admin (maintainer) |

### Merge settings

- Squash merge: **enabled**
- Merge commits and rebase merges: **disabled**
- Automatic branch deletion: **enabled**

## GitHub labels

Keep GitHub's default type labels. Add these once (re-run safely; duplicates are ignored):

```bash
gh label create "app:taxbook" --color "1D76DB" --description "Taxbook application"
gh label create "app:firstaid" --color "1D76DB" --description "First Aid application"
gh label create "app:passbook" --color "1D76DB" --description "Passbook application"
gh label create "app:tenure" --color "1D76DB" --description "Tenure application"
gh label create "area:platform" --color "5319E7" --description "Monorepo platform and shared tooling"
gh label create "shared-candidate" --color "FBCA04" --description "Reusable pattern; do not extract yet"
gh label create "blocked" --color "B60205" --description "Blocked on external dependency or decision"
```

Create the active milestone when a platform phase begins:

```bash
gh api repos/:owner/:repo/milestones -f title="Phase 2 — Development workflow" -f state=open
```

Do not pre-create milestones for future phases.

## Changelog policy

Changelogs live at the repository root and under each app (`CHANGELOG.md`). Maintain an `Unreleased` section.

**Require a changelog entry only for user-visible behavior changes.** Documentation, tests, refactors, and internal maintenance may omit entries.

## Shared-candidate discovery

When reusable functionality appears but is not ready to extract, open an Issue with the `shared-candidate` label. Include:

- Current location in the codebase
- Demonstrated need
- Possible consumers
- Validation state

Agents must **flag** candidates, not automatically extract shared packages.

## Agents

See [AGENTS.md](./AGENTS.md). Before changing an app, read that app's `AGENTS.md` and product/domain docs.

## Production promotion

Legacy repositories remain production until Phase 4 cutover. **No routine production promotion from this monorepo in Phase 2.**

**Emergency fixes:** implement in the monorepo first, then minimally backport to the legacy repo. Record both commit SHAs in the PR or Issue.

Validation data for monorepo checks belongs in gitignored `.validation/` — never attach validation containers to production Docker volume names (`taxbook-data`, `passbook-data`, `tenure-data`, `firstaid-data`).
