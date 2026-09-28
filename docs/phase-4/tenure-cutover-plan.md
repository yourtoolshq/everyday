# Tenure Phase 4 migration plan

This plan covers Tenure's adoption of the Phase 4 data platform and its later
production cutover on the computer that owns its data. The application work is a
prerequisite to the production cutover; this checklist does not assume that
Tenure is already wired to `@yourtoolshq/data`.

The operational cutover follows the validated [Passbook cutover
checklist](./passbook-cutover.md) and the [Phase 4 data platform
design](./data-platform.md). Keep host-specific service configuration and
secrets in the host configuration repository.

## Historic Tenure setup (pre-cutover inventory)

The following described Tenure before the Phase 4 platform adoption. It is
retained as historic context for the cutover checklist. Current Compose
publishes no host port, mounts separate `tenure-data` and `tenure-backups`
volumes, and joins only the external `web` network — see
[Phase 7 deployment](../phase-7/deployment.md).

- Docker stored `tenure.db` and `documents/` together under `/data` in the
  `tenure-data` volume.
- Documents had a `storage_key`; paycheck stubs and compensation documents
  pointed to rows in `documents`.
- The previous backup script copied only the SQLite database and left the
  documents directory to be backed up separately.
- Compose previously published `127.0.0.1:3003` and joined both its default
  network and the external `web` network.
- Compose previously lacked a separate backup volume / `BACKUP_DIR`.

## 1. Adopt the data platform in the app

Complete and merge Tenure's platform-adoption change before scheduling a
production cutover.

- [ ] Define the Tenure platform contract with `/data` as the production data
      directory, `/backups` as the separate backup directory, Tenure's schema and
      migration folder, and the approved backup schedule and retention.
- [ ] Keep the existing database and documents in place during the upgrade.
      The migration must backfill platform file rows for every existing document,
      including pay stubs and compensation attachments, and link all domain
      references to those file rows without changing the physical files.
- [ ] Move document upload, claim, read, and remove paths onto the platform
      file APIs. Cover all current upload and read routes, including pay-stub
      uploads and EML rendering.
- [ ] Wire platform boot, readiness gating, health, data API routes, settings,
      integrity/usage views, backup status, and file viewing as described in the
      data platform design.
- [ ] Add the Tenure upgrade fixture and migration checks. Verify existing
      record counts and references, SQLite integrity, foreign keys, and that each
      referenced file remains readable after upgrade.
- [ ] Replace the app-specific database-only backup and restore path with the
      platform's verified archive workflow. Ensure the CLI is available in the
      image and can work with the running app as well as a stopped app.
- [ ] Update production Compose to mount `tenure-data:/data` and a distinct
      `tenure-backups:/backups`, remove the production host port mapping, retain
      the `web` network and Traefik routing, and set
      `traefik.docker.network=web` when attached to multiple networks.
- [ ] Preserve direct port 3003 for local development; development and test
      processes must use `.data` or disposable volumes, never production volumes.
- [ ] Document and verify that the host manager builds the candidate image and
      obtains a verified backup from the running version before replacement. If
      either step fails, it must leave the running container in place.

**Gate:** Do not move production data until the application upgrade path has
been verified on a fictional previous-release fixture and a disposable Docker
volume, including a successful backup restore.

## 2. Prepare the production host

Tenure keeps running during preparation.

- [ ] Identify the current Tenure container, Compose working directory, image,
      networks, and mounts. Confirm the live data is the named `tenure-data`
      volume at `/data`; stop if the actual mount layout differs.
- [ ] Record the current image and tag it for rollback before building the
      monorepo image.
- [ ] Confirm the host service manager owns production startup, restart
      behavior, the pinned monorepo revision, and the build/backup/upgrade flow.
- [ ] Build the candidate image from the reviewed monorepo commit. Confirm the
      production service has no published application port and Traefik serves
      `https://tenure.tools.local`.
- [ ] Confirm production backups will use the separate `tenure-backups` volume
      or an explicitly configured host backup directory.

## 3. Create the rollback copy

Tenure is offline from this point until the new version is healthy or rollback
finishes.

- [ ] Stop the legacy service without deleting its volumes. Confirm no
      container is using `tenure-data`.
- [ ] Archive the full `/data` volume while stopped. This must include
      `tenure.db` and all of `documents/` so they represent the same point in time.
- [ ] Record and verify a SHA-256 checksum; inspect the archive for the
      database and document files.
- [ ] Copy the archive and checksum off the production computer and outside
      the Git checkout.

## 4. Start and validate the monorepo version

- [ ] Start Tenure with the existing `tenure-data` volume and the separate
      backup volume. Do not run development or tests against either volume.
- [ ] Wait for `/api/health` to report ready. If the app blocks, restarts, or
      reports an upgrade error, capture logs and follow the rollback procedure.
- [ ] Confirm `yt-data list` shows a verified `pre-migration` backup.
- [ ] Compare people, employers, employments, compensation history, paychecks,
      discussions, and documents with the pre-cutover state.
- [ ] Open representative documents, EML attachments, pay stubs, and
      compensation attachments; confirm the file association and content are
      intact.
- [ ] Run an integrity scan. Confirm the database and relationships are
      healthy, every referenced file exists, and no unexpected unreferenced files
      are reported.
- [ ] Create a manual backup, verify it, restore it in a disposable volume,
      and confirm the restored data and attachments are readable.
- [ ] Confirm `https://tenure.tools.local` works through Traefik and no
      production host port is published.
- [ ] Run local development at port 3003 against `.data` while production is
      running; verify its data is isolated from production.
- [ ] Restart the production service and confirm records, files, health, and
      scheduled backup status persist.
- [ ] Confirm the host manager still pins the deployed commit and does not
      silently advance production during an ordinary host rebuild.

## 5. Roll back if validation fails

- [ ] Stop the monorepo service without deleting volumes. Keep a copy of the
      failed volume state for diagnosis.
- [ ] Restore the verified pre-cutover tar to `tenure-data` and verify its
      checksum before extraction.
- [ ] Restart the tagged legacy image from its original Compose configuration.
- [ ] Confirm the legacy app loads and representative documents open.
- [ ] Keep both rollback and failed-state archives for investigation; do not
      retry against production until the failure is understood.

## 6. Close out

- [ ] Keep the verified off-computer rollback archive for at least 30 days.
- [ ] After cutover and recovery validation are complete, record the deployed
      commit and outcome on issue #24 and mark the Tenure portion complete.
- [ ] Proceed to First Aid as the next Phase 4 adoption and cutover.
