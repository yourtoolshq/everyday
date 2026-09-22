# Your Tools — Platform Product

Your Tools is a collection of open-source, self-hosted applications for everyday personal and household problems.

## Purpose

Provide a shared development platform where four real applications can evolve independently while benefiting from consistent practices, tooling, and eventual shared infrastructure.

## Applications

| Application   | Problem space                                          |
| ------------- | ------------------------------------------------------ |
| **Taxbook**   | Personal taxes, receipts, returns, and tax planning    |
| **First Aid** | Healthcare records, benefits, appointments, and claims |
| **Passbook**  | Financial institutions, accounts, and statements       |
| **Tenure**    | Employment history, compensation, and pay stubs        |

Each application has its own product documentation under `apps/<app>/docs/` (or equivalent paths). Read those for product scope, domain rules, and app-specific roadmaps.

## Boundaries

**In scope for this repository:**

- The four applications listed above
- Monorepo tooling (`tooling/`), future shared packages (`packages/`), and platform workflow
- Experimental development and verification against isolated data

**Out of scope:**

- Production deployment from this repository until Phase 4 cutover (legacy repos remain production)
- Shared-package extraction before a pattern is validated in real use
- Hypothetical future applications (Roof, Garage, etc.) — they may benefit later but are not part of consolidation

## Philosophy

See the [Your Tools manifesto](https://your-tools.dev/) for motivation and principles. This document does not duplicate that content.

## Production boundary

Until Phase 4 is complete, the legacy per-app repositories run production. This monorepo is the development source of truth. Production changes are frozen except for emergencies; emergency fixes land here first and are minimally backported to legacy repos with both commit references recorded.
