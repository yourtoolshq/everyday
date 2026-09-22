# Your Tools — Platform Consolidation Roadmap

This document is the authoritative plan for consolidating four existing Your Tools applications into a shared development platform. It is intended to be read phase-by-phase when work begins — not all at once.

**This is a consolidation project, not a rewrite.**

---

## 1. Project overview

Your Tools is a collection of open-source, self-hosted applications designed to solve everyday personal and household problems.

Four applications are currently under development and contain varying amounts of real personal data. They share a similar technology stack and philosophy, but their implementations have started diverging.

### Problems being solved

| Problem | Description |
|---|---|
| Repetitive scaffolding | Starting a new app requires rebuilding nearly the same infrastructure each time |
| Implementation drift | Improvements in one app are not carried to others; the first app (Taxbook) has fallen behind |
| Inconsistent storage | Taxbook uses glob storage; later apps use volumes with a common package pattern |
| UI/UX inconsistency | Modal vs. side drawer, plain number fields vs. formatted money/percent inputs |
| Missing QoL behaviors | e.g. inline arithmetic in numeric fields (like YNAB: `10+20+30` → `60.00`) |
| Deployment drift | Docker files diverge between apps |
| Distribution friction | Future concern: bundling, auto-updates, Electron — separate from development ergonomics |

The platform should make it easier for one person, working primarily with AI coding agents, to develop and maintain multiple applications without repeatedly solving the same problems.

### Primary objective

Establish a common platform where applications can remain independent while benefiting from shared infrastructure, consistent development practices, reusable components, and reliable data management.

Improvements should be developed in one application, validated through real use, and progressively adopted by others — without breaking the entire suite at once.

**Guiding idea:** Build a common platform from four real applications that already solve real problems — not a framework for hypothetical future applications.

---

## 2. Applications in scope

| Application | Purpose | Status |
|---|---|---|
| **Taxbook** | Personal tax records, receipts, tax returns, and planning | Existing |
| **Tenure** | Employment history, compensation, pay stubs, and documents | Existing |
| **Passbook** | Financial institutions, accounts, statements, and receipts | Existing |
| **First Aid** | Healthcare records, appointments, benefits, and claims | Existing |

Future applications (Roof, Garage, Pantry, Envelop, etc.) should be able to benefit from the platform, but migrating or developing them is **not** part of the initial consolidation.

During Phase 1, the **original individual repositories remain the production environments**. This monorepo is an experimental development workspace until proven stable.

---

## 3. Technical direction

### Updated architectural decision: Turborepo-first, T3-inspired

Your Tools will use **Turborepo and pnpm workspaces** as its monorepo foundation.

[create-t3-turbo](https://github.com/t3-oss/create-t3-turbo) will serve as a **reference implementation** for relevant architectural patterns — not an upstream dependency we expect to remain maintained.

The final initialization approach (adapt template vs. fresh Turborepo) will be selected at the start of Phase 1 after comparing actual setup effort.

### Technology stack

| Concern | Direction |
|---|---|
| Monorepo | Turborepo |
| Package management | pnpm workspaces |
| Reference architecture | create-t3-turbo |
| Language | TypeScript |
| Web framework | Next.js |
| API | tRPC where appropriate |
| UI | shadcn/ui + Tailwind |
| Database | SQLite per application |
| ORM | Drizzle |
| Shared code | Workspace packages (introduced as needed) |
| Local deployment | Docker Compose |
| CI/CD | GitHub Actions |
| Task management | GitHub Issues / Projects (established in Phase 2) |
| Distribution | Docker first; Electron evaluated later |

Existing implementations should be evaluated before deciding what needs to change. The monorepo is intended to simplify development — not force every application to share its database, domain model, or deployment lifecycle.

Exact framework and dependency versions should be selected during initialization rather than inherited blindly from an older template.

### create-t3-turbo maintenance status

As of September 2026, official merged maintenance appears to have stalled:

- Last commit to `main`: December 12, 2025
- No confirmed announcement of discontinuation
- Community contributions continue (e.g. [PR #1532](https://github.com/t3-oss/create-t3-turbo/pull/1532), September 2026 modernization)
- [Discussion #1514](https://github.com/t3-oss/create-t3-turbo/discussions/1514) ("Still maintain?") has no maintainer response

**Decision:** Treat create-t3-turbo as effectively dormant for upstream maintenance purposes, not confirmed dead. Adopt useful patterns without planning around regular upstream updates.

What we want from the architecture does **not** depend on T3 Turbo being maintained:

| What we want | Dependency on T3 Turbo |
|---|---|
| Turborepo monorepo | None |
| pnpm workspaces | None |
| Next.js / TypeScript | None |
| Shared tRPC API | None |
| Shared Drizzle database package | None |
| Shared shadcn/ui components | None |
| Multiple applications | None |
| Shared configurations and tooling | None |

We were already going to make significant changes regardless:

- Adapt database configuration for local Docker environment
- Build our own app conventions and development workflow
- Add local domain routing
- Introduce applications incrementally
- Avoid unnecessary Expo, TanStack Start, and Supabase-oriented setup from the template

### Architectural principle

**Reference implementations are not architectural dependencies.**

Your Tools may adopt useful conventions from external projects without requiring those projects to remain actively maintained. External templates should be evaluated for their architectural ideas, not treated as permanent sources of truth.

---

## 4. Implementation roadmap

Each phase owns a specific outcome. Later phases build on earlier ones rather than redefining them. See [Phase ownership](#phase-ownership) for what each phase does and does not own.

---

### Phase 1 — Workspace consolidation and foundation selection

**Goal:** Establish a maintainable monorepo and incorporate the four existing applications without changing their functionality.

#### Step 1 — Evaluate the initialization approach

Compare two options before committing:

**Option A: Adapt create-t3-turbo**

- Start from the existing template
- Remove unnecessary applications and integrations (Expo, TanStack Start, Supabase config, etc.)
- Update dependencies
- Adapt database and Docker configuration
- Incorporate existing applications

*Advantage:* More architecture is already assembled.

*Trade-off:* Additional work to remove unnecessary functionality and modernize dependencies.

**Option B: Start from a fresh Turborepo** *(initial preference)*

- Initialize a current Turborepo workspace
- Configure pnpm workspaces
- Incorporate the existing applications
- Reference create-t3-turbo for useful architectural patterns
- Introduce shared packages as they become necessary

*Advantage:* Introduce only the infrastructure Your Tools actually needs.

*Trade-off:* Some initial configuration must be assembled ourselves.

**Decision rule:** Compare actual setup effort, dependency compatibility, and unnecessary migration work before selecting either option.

#### Step 2 — Establish the experimental monorepo

Incorporate:

- Taxbook
- Tenure
- Passbook
- First Aid

Preserve the original repositories as production environments. Do not introduce major refactoring or shared-package extraction during this step.

#### Step 3 — Verify existing functionality

- Confirm all four applications can run independently from the monorepo
- Preserve existing databases, uploaded files, and configuration
- Verify backups before modifying existing data or production deployments
- Establish a migration and rollback strategy

**Completion criteria:** Cursor can inspect all four applications within one workspace, and each application runs successfully without relying on the original repositories for its source code.

---

### Phase 2 — Development workflow and governance

**Goal:** Establish a consistent development lifecycle before substantial architectural changes begin.

**Scope:**

- Define the Your Tools development philosophy
- Establish Git branch and pull request conventions
- Introduce GitHub Issues and potentially GitHub Projects
- Establish documentation ownership and conventions (see [Planned documentation structure](#planned-documentation-structure))
- Define how agents should work across the monorepo
- Establish basic CI checks
- Define the development-to-production promotion process
- Establish the shared-candidate discovery convention (below)
- Define release notes and changelog conventions *(convention only — automation comes in Phase 8)*

The existing per-app `roadmap.md` files may eventually be replaced by GitHub Issues and Projects for active work tracking. Product and domain documentation should remain in the repository.

**Completion criteria:** Every development task has a consistent lifecycle, and potentially reusable functionality can be discovered and tracked without prematurely abstracting it.

#### Shared-candidate convention

When an AI agent encounters functionality that could benefit multiple applications, it should **flag it rather than automatically extract it**.

Examples:

- A monthly coverage grid in Passbook that could be used in Tenure
- A money input with inline calculations
- A file storage utility
- A reusable document upload workflow
- A common empty-state component

**Workflow:**

1. **Discover** — Agent identifies potentially reusable functionality while implementing a feature
2. **Flag** — Agent records it as a shared candidate, including where it currently exists and which applications might benefit
3. **Validate** — Continue using the implementation in its original application; refine based on actual usage
4. **Promote** — Once mature, create or move it into an appropriate shared package
5. **Adopt** — Migrate other applications incrementally, tracking adoption until the candidate can be closed

**Tracking:**

- **Eventually:** GitHub Issues with label `shared-candidate`
- **During early migration:** Temporary `SHARED_CANDIDATES.md` file is acceptable
- **Rule:** Agents must record promising shared functionality, but must not automatically abstract it
- Once GitHub Issues are established, migrate candidates there and avoid maintaining two sources of truth

Example issue:

```
Label: shared-candidate
Title: Extract monthly coverage grid

Currently implemented in: Passbook
Potential consumers: Tenure, Taxbook
Reason: Multiple applications visualize document availability by month.
Status: Needs validation in Tenure before extraction.
```

This convention applies to UI components, storage utilities, validation, infrastructure, and other potentially reusable functionality — not just UI.

---

### Phase 3 — Architecture inventory and convergence planning

**Goal:** Understand the existing implementations before deciding what should become shared.

Cursor should inspect all four applications and document differences in:

- Dependencies and framework versions
- Database implementations and migrations
- File storage
- Docker configurations
- UI components and interaction patterns
- Validation and error handling
- Logging
- Testing
- Configuration management
- Existing reusable utilities
- Authentication, if applicable

Identify the strongest existing implementation of each concern.

For example, First Aid might have a mature storage implementation while Passbook has a useful monthly document coverage grid. Neither should automatically become the shared standard without evaluation.

Also include an assessment of which create-t3-turbo patterns are worth adopting.

**Completion criteria:** A documented convergence plan identifies duplication, architectural differences, and proposed shared foundations — without premature refactoring.

---

### Phase 4 — Data durability and storage *(critical priority)*

**Goal:** Establish confidence that personal data can survive application failures, upgrades, and accidental mistakes.

Each application should retain ownership of its data, generally consisting of:

- An SQLite database
- A directory containing uploaded files
- Application-specific configuration where needed

Introduce shared storage conventions and supporting infrastructure.

**Scope:**

- Standardized file storage operations
- Consistent storage locations and volume conventions
- Storage usage reporting per application (e.g. total MB of files stored)
- Database-consistent backups
- File backups
- Backup scheduling and retention
- Backup verification
- Tested restore procedures
- Database migration safety
- Recovery from failed migrations
- Documented recovery expectations
- Upgrade rollback procedures

**Critical requirements:**

- **A backup is not considered reliable until a restore has been successfully tested.**
- Existing personal documents must not be deleted simply because they have been imported into an application.
- Until backups and data safety are proven, do not delete original source documents (e.g. previous tax files).

This phase establishes the data-safety capabilities that Phase 8 (release management) will later integrate into automated upgrade and rollback workflows. That is a dependency, not duplication.

**Completion criteria:** Personal data can be backed up, restored, and safely migrated using documented and tested procedures. A failed deployment or corrupted application can be recovered without losing records beyond the explicitly accepted backup interval.

---

### Phase 5 — UI commonality and design system

**Goal:** Establish consistent UI components and interaction patterns across applications.

This is more than extracting shadcn components. We also want documented guidance explaining **when and why** particular patterns should be used.

**Initial candidates:**

| Area | Examples |
|---|---|
| Form controls | Money, percentage, date, and formatted number inputs |
| Numeric interactions | Inline arithmetic, decimal normalization |
| Navigation | Dashboard layout, breadcrumbs, sidebar |
| Data entry | Modal versus side drawer conventions |
| Documents | Upload, preview, download, attachment |
| Data visualization | Monthly coverage grids, timelines |
| Feedback | Loading, empty, error, and success states |
| Destructive actions | Confirmation and deletion patterns |

**Money input behavior example:**

| Input | Output |
|---|---|
| `.89` | `0.89` |
| `147.3` | `147.30` |
| `10+20+30` | `60.00` |

Components should be developed and validated in one application before promotion. The existing shadcn dashboard approach remains sufficient initially. A custom Your Tools visual identity can be introduced later without redesigning every application separately.

**Completion criteria:** Applications have access to consistent UI patterns and agents have documented guidance for common interactions instead of independently inventing implementations.

---

### Phase 6 — Shared technical foundations

**Goal:** Reduce duplicated infrastructure while preserving application independence.

Potential shared concerns:

- Storage utilities established in Phase 4
- Logging
- Error handling
- Validation helpers
- Configuration management
- Database conventions
- Testing utilities
- Common TypeScript configuration

This phase focuses on extracting and adopting technical functionality identified during earlier phases, using T3 patterns where useful.

Not every duplicated implementation needs to become a shared package. Shared packages should emerge from demonstrated needs rather than hypothetical future requirements.

**Completion criteria:** Applications can adopt mature technical foundations without repeatedly implementing the same infrastructure or copying large amounts of code from existing applications.

---

### Phase 7 — Unified deployment

**Goal:** Make local deployment consistent and predictable.

**Scope:**

- Standardized Dockerfile conventions
- Docker Compose configuration
- Persistent volume management
- Environment configuration
- Container health checks
- Restart behavior
- Local networking
- Deployment documentation

Explore local domain routing through Traefik or an equivalent solution:

- `taxbook.localhost`
- `tenure.localhost`
- `passbook.localhost`
- `firstaid.localhost`

Applications should remain independently deployable even when maintained in the same monorepo.

**Completion criteria:** Applications can be deployed consistently without manually managing conflicting ports or reinventing Docker configurations.

---

### Phase 8 — Release management and update safety

**Goal:** Separate active development from stable versions used to manage real personal data.

Introduce a consistent release process:

```
Feature branch
    ↓
Pull request and CI
    ↓
Main branch
    ↓
Versioned release
    ↓
Published container image
    ↓
Local production deployment
```

**Scope:**

- Application-specific versioning
- Changelog and release note generation *(implements conventions defined in Phase 2)*
- GitHub Actions build workflows
- GitHub Container Registry
- Release tagging
- Safe update procedures
- Backup-before-upgrade integration *(uses capabilities from Phase 4)*
- Rollback orchestration
- Manual versus automatic update policies

Avoid automatically deploying every merge to the production environment.

**Completion criteria:** Applications can be upgraded deliberately using identifiable releases, with a tested recovery process if something goes wrong.

---

### Phase 9 — Distribution *(future)*

**Goal:** Make Your Tools accessible to people who do not want to manage a development environment.

Docker Compose remains the initial distribution method. Later, investigate an Electron-based desktop application.

**Considerations:**

- Bundling applications
- SQLite and uploaded-file management inside a desktop wrapper
- Automatic updates
- Backup and restore interfaces exposed to users
- Installation and onboarding
- Installing only selected applications
- Coexistence with Docker distribution

**Completion criteria:** A distribution approach exists that preserves local-first ownership and data durability while reducing installation complexity.

---

## 5. Phase ownership

To avoid an agent implementing the same thing twice across phases:

| Phase | Owns | Does not own |
|---|---|---|
| 1. Workspace consolidation | Monorepo and existing apps | Shared package extraction |
| 2. Development workflow | Issues, branching, documentation conventions, shared-candidate tracking, release note *conventions* | Full release automation |
| 3. Architecture inventory | Discovering existing patterns and differences | Refactoring |
| 4. Data durability | Storage, backup, restore, migration safety | General deployment infrastructure |
| 5. UI system | Shared UI and interaction conventions | General technical utilities |
| 6. Shared foundations | Shared technical packages and adoption | Application-specific business logic |
| 7. Deployment | Docker, networking, runtime configuration | Release management |
| 8. Release management | Versioning, builds, changelogs, updates, rollback orchestration | Distribution packaging |
| 9. Distribution | Docker distribution experience, potential Electron app | Internal development workflow |

---

## 6. Core development principles

These principles apply across all phases and should eventually be referenced by root `AGENTS.md`.

### Develop once, validate, then promote

Larger shared features should generally follow this lifecycle:

```
Identify a need in one application
    ↓
Implement locally
    ↓
Human review
    ↓
Use for several days
    ↓
Refine the implementation
    ↓
Promote to a shared package
    ↓
Adopt in other applications gradually
```

This prevents experimental changes from breaking the entire suite simultaneously.

### Additional principles

| Principle | Meaning |
|---|---|
| Local-first | Core functionality should not depend on external services |
| Data ownership | Applications retain ownership of their domains and records |
| Human validation | Agents implement; the human validates important decisions |
| Small blast radius | Prefer incremental migrations over sweeping changes |
| No premature abstraction | Similar code is not automatically shared code |
| Shared discovery | Agents flag reusable functionality for later evaluation |
| Recoverability | Data migrations and upgrades require a recovery strategy |
| Independent applications | Users should not need to install the entire suite |
| Documentation over repetition | Agent instructions reference authoritative documents |
| Open-source readiness | Avoid coupling applications to personal secrets or environments |
| Reference implementations are not dependencies | Adopt useful conventions without requiring external projects to remain maintained |

---

## 7. Planned documentation structure

These documents will be created during Phase 2. Listed here so the plan is complete when that phase begins.

Avoid maintaining the same information in multiple places.

| Document | Responsibility |
|---|---|
| `README.md` | Introduction to Your Tools, applications, and getting started |
| [Your Tools manifesto](https://your-tools.dev/) | Philosophy and motivation (external, not duplicated) |
| `PRODUCT.md` | Platform objectives, problems being solved, scope, and intended outcomes |
| `ROADMAP.md` | This document — phased plan, dependencies, milestones, completion criteria |
| `DEVELOPMENT.md` | Development lifecycle, branching, agent conventions, shared-candidate tracking, promotion rules |
| `ARCHITECTURE.md` | Actual platform architecture and established technical decisions |
| Design system docs | UI conventions and interaction patterns |
| `AGENTS.md` | Minimal entry point for coding agents — links to authoritative docs, does not duplicate them |
| App `README.md` | Application introduction and setup |
| App `product.md` | Product purpose, scope, and requirements |
| App `domain.md` | Domain model and business rules |
| GitHub Issues | Bugs, features, implementation tasks, shared candidates |
| GitHub Projects | Cross-application roadmap and progress |
| Changelog | Released changes |

**Documentation ownership:**

- PRODUCT explains **why**
- ROADMAP explains **what comes next**
- DEVELOPMENT explains **how we work**
- ARCHITECTURE explains **how the platform is built**
- GitHub Issues track **individual work items**

Do not maintain the same roadmap in both Markdown and GitHub Issues.

---

## 8. AI-assisted development strategy

The project is primarily developed by one person using AI coding agents. Context size, model usage, and implementation cost are important constraints.

### Cursor — primary implementation tool

Use Cursor for:

- Repository inventory
- Mechanical migration
- Bounded refactoring
- Component extraction
- Implementation and testing

Prefer small, well-defined tasks with explicit completion criteria.

### ChatGPT — architectural planning (selective use)

Use more capable models for:

- Domain boundaries
- Architectural decisions
- Migration strategy
- Data safety
- Evaluating trade-offs

Cursor-generated inventories and implementation reports can provide concise context for these discussions.

**Intent:** Avoid repeatedly asking expensive models to rediscover the entire codebase. The monorepo, shared documentation, and GitHub Issues should make agent work more predictable and context-efficient.

---

## 9. Major milestones

Rather than treating all nine phases as one enormous project, group them into four milestones:

### Milestone A — One development environment *(Phases 1–3)*

All four applications are available in one experimental monorepo, development conventions are established, and existing implementations have been inventoried.

**Outcome:** We understand the suite and can develop it efficiently.

### Milestone B — Trustworthy personal data *(Phase 4)*

Storage, backups, restore procedures, and migration safety have been implemented and tested.

**Outcome:** We can confidently manage important personal records.

### Milestone C — One maintainable platform *(Phases 5–6)*

Shared UI patterns and technical foundations are available, with applications adopting them incrementally.

**Outcome:** New development becomes faster and more consistent.

### Milestone D — Reliable releases and distribution *(Phases 7–9)*

Applications have consistent deployment, identifiable releases, safe upgrades, and a documented distribution approach.

**Outcome:** Your Tools becomes a maintainable self-hosted software suite rather than a collection of personal development projects.

---

## 10. Impact on remaining phases after Turborepo decision

| Phase | Changes from original plan |
|---|---|
| 2. Development workflow | No significant change |
| 3. Architecture inventory | Include assessment of which T3 patterns are worth adopting |
| 4. Data durability | No change |
| 5. UI commonality | No change |
| 6. Shared foundations | Extract packages based on actual needs, using T3 patterns where useful |
| 7. Unified deployment | No change |
| 8. Release management | No change |
| 9. Distribution | No change |

---

## 11. Immediate next step

When development begins, the first task is:

**Evaluate the effort of initializing Your Tools from a fresh Turborepo versus adapting create-t3-turbo, then establish the experimental monorepo.**

Before substantial refactoring:

1. Verify backups of existing databases and uploaded files
2. Keep existing production repositories untouched
3. Incorporate the four applications without major refactoring

Once all four applications run successfully from the monorepo, proceed to Phase 2 (development workflow) and Phase 3 (architecture inventory).
