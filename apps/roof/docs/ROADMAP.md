# Roof — Roadmap

## Phase 0 — Foundation (complete)

- [x] Monorepo app package with shared `@yourtoolshq/data`, `@yourtoolshq/data-ui`, `@yourtoolshq/ui`
- [x] Next.js shell, theme, settings, data & backups UI
- [x] Docker and CI wiring
- [x] Draft domain schema for properties, events, and documents
- [x] Property list and detail workflows
- [x] Event CRUD and document upload on a property

## Phase 1 — First vertical slice (implemented, awaiting real use)

Usable workflows for:

- Under-construction home (purchase/build records)
- Current rental (lease, insurance metadata, documents)
- Past rentals (archive + events)
- Planned property visits, local appointment time, notes, and supporting images/documents
- Purchase-to-owned stages on one continuous property record
- Rental-owned leases and renewals with supporting files, explicit month-to-month terms, and date-derived status
- Guided property creation, optional photo preview, and property-owned insurance records

Acceptance: create and edit records, empty states, upload/open/delete documents owned by a property or event.

## Phase 2 — Later

- Parties directory
- Projects and quotations
- Assets and location history
- Maintenance and reminders

Non-goals until needed: landlord SaaS features, full insurance management, and production deployment of Roof.
