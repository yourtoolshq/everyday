# First Aid

First Aid is a personal, self-hosted tool for helping me manage our healthcare year.

I am building it because I am not particularly good at keeping the whole healthcare picture in one place.

A doctor may tell us to repeat something months later. Routine dental or eye care can slip. Flu season arrives before I think about vaccination. Insurance may include massage, physiotherapy, vision, or other benefits that we paid for but barely use. When appointments do happen, their notes, receipts, intake forms, prescriptions, requisitions, and insurance records end up spread across several places.

I want one tool that helps me answer:

- What healthcare should we think about this year?
- What is due or worth planning?
- What did a provider tell us to do later?
- What have we already scheduled or completed?
- What insurance coverage remains?
- What happened during a previous visit?
- Where are the documents related to it?

First Aid is being built around that personal problem first.

It is **not** currently an attempt to build an electronic medical record, medical recommendation service, insurer platform, or general healthcare product.

## Current direction

The first version is centered around a simple lifecycle:

```text
Care Plan
    ↓
Care Item
    ↓
Visit
    ↓
Documents / Cost / Claim
    ↓
Future Care
```

Insurance benefits sit alongside this workflow and help inform planning, but maximizing insurance usage is not the definition of a healthy year.

See:

- [`PRODUCT.md`](./PRODUCT.md) — the problem First Aid is trying to solve
- [`DOMAIN.md`](./DOMAIN.md) — the V1 domain and relationships
- [`ROADMAP.md`](./ROADMAP.md) — incremental phases focused on making the tool useful
- [`AGENTS.md`](./AGENTS.md) — guidance for AI-assisted development

## Development philosophy

First Aid belongs to the broader **Your Tools** idea: use software and AI to solve real personal problems quickly, keep the tools understandable and self-hostable, and share the work openly when useful.

The code lives under the **yourtoolshq** organization.

The current priority is making First Aid useful for my household. Generalizing it for everyone can happen later if actual use makes that worthwhile.

## Contributing

The repository is open primarily so the implementation and ideas can be shared.

If you find a bug or have an idea, create an issue.

If you want to contribute a change:

1. Fork the repository.
2. Create a branch for the change.
3. Make the smallest change that solves the problem.
4. Add or update tests where appropriate.
5. Open a pull request explaining the problem and the approach.

Please keep contributions aligned with the current scope. Features should solve an observed problem rather than move First Aid toward being a generic healthcare platform.
