# First Aid Changelog

User-visible changes only. See [DEVELOPMENT.md](../../DEVELOPMENT.md) for changelog policy.

## Unreleased

### Added

- Data & backups settings for storage, verified backups, restore, and integrity checks.

### Changed

- Visit documents are stored with the shared data platform. Production is served at https://firstaid.tools.local and does not publish a host port.
- Benefit, visit cost, and claim amount fields show a `$` prefix. The prefix is visual only.
- File upload progress uses a thinner bar.
- Appearance is on General in the sidebar. Light, dark, or system is saved. Data & backups stays storage, backups, and restores.
- A page that fails to load, is missing, or is still loading explains that and offers a way back.

### Fixed
