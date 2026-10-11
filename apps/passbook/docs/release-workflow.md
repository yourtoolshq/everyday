# Passbook release workflow audit

Tracks [issue #121](https://github.com/yourtoolshq/everyday/issues/121): installable
Passbook releases, signed publication, and recoverable updates.

This document describes how Passbook desktop releases move from CI toward installed
apps, what the repository validates today, and how to wire Apple signing without
putting secrets in git or chat.

## End-to-end flow

```mermaid
flowchart LR
  schedule[Scheduled or manual workflow] --> preflight[Resolve version and tag]
  preflight --> quality[Host release gate and tests]
  quality --> package_mac[Signed macOS package]
  package_mac --> validate_local[Artifact and codesign checks]
  validate_local --> artifact[Upload CI artifact]
  artifact --> publish_validate[Re-validate downloaded set]
  publish_validate --> draft[Draft GitHub release]
  draft --> finalize[Publish and mark latest]
  finalize --> feed[passbook-mac.yml on tag]
  feed --> provider[electron-updater GitHubProvider]
  provider --> download[ZIP download and checksum verification]
  download --> backup[Verified backup checkpoint]
  backup --> stage[Native Squirrel signature validation and staging]
  stage --> stop[Await owned host exit]
  stop --> runtime[Replace app bundle and restart]
  runtime --> trial[Verify target shell version and host readiness]
  trial --> commit[Commit update intent]
```

| Stage            | What happens                                                                      | Automated evidence                                     |
| ---------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Release decision | Six-hour gate or manual dispatch                                                  | `check-scheduled-release.cjs`                          |
| Identity         | Passbook channel semver tag `v{base}-passbook.{date}.{run}`                       | `resolve-release-meta.cjs`                             |
| Quality          | Bundled host gate (not native installer proof)                                    | `pnpm release:gate`                                    |
| Packaging        | arm64 DMG + ZIP + blockmaps + `passbook-mac.yml`                                  | `pnpm --filter @passbook/desktop package:mac:ci` in CI |
| Signing          | Developer ID + notarization + staple                                              | `verify-mac-release-signing.cjs`                       |
| Contract         | Version, filenames, SHA512, sizes                                                 | `validate-release-artifacts.cjs`                       |
| Publication      | Draft upload, validate, then finalize                                             | `.github/workflows/passbook-release.yml`               |
| Client feed      | `GitHubProvider` + `passbook` channel                                             | `desktop/src/release-provider.test.ts`                 |
| Update download  | HTTP payload and checksum in lifecycle harness; real provider resolves asset URLs | `desktop/src/update-lifecycle.integration.test.ts`     |
| Data safety      | Production controller → real backup API → host exit → new host → commit / failure | `desktop/src/update-lifecycle.integration.test.ts`     |

## Findings from the latest public release

Evidence: [GitHub Actions run 38091363985](https://github.com/yourtoolshq/everyday/actions/runs/38091363985).

| Issue                                         | Impact                                                                                                                                                      |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS artifacts were **unsigned**             | Gatekeeper and auto-update cannot treat the build as a trusted baseline.                                                                                    |
| Feed published **`latest-mac.yml`**           | The provider requests `passbook-mac.yml`, then falls back to `latest-mac.yml`. The fallback works today; explicit channel metadata removes that dependency. |
| **`fail_on_unmatching_files`** typo           | softprops input ignored; missing assets would not fail the step.                                                                                            |
| **`release:gate`** only restarts bundled host | Proves backup/recovery around version env, not native DMG/ZIP installation.                                                                                 |

This branch addresses the packaging feed, validation, signing gates, and draft-then-finalize publication.

The desktop also had a five-second failure timer that started before native
staging completed, ignored native install errors, and did not await host shutdown.
The corrected sequence preserves the running host until staging succeeds. It
records native failures, restores the owned host if quit handoff fails, and
requires the target shell and ready host versions before committing. Diagnostic
events are kept in `{dataDir}/.update-history.log`; intent remains in
`{dataDir}/.update/intent.json` until committed or dismissed.

## Harness vs production (honest coverage)

| Concern                             | Harness (`release:gate`, unit tests)                                                                                                         | Production signed bundle                  |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Host startup                        | Same bundled `passbook-host.cjs` with version env                                                                                            | Inside signed `.app`                      |
| Update metadata                     | Fixture HTTP + real `GitHubProvider` code                                                                                                    | GitHub release assets                     |
| Native staging protocol             | Installed MacUpdater serves its real Squirrel proxy; native adapter simulates completion and errors; controller harness covers the lifecycle | macOS `MacUpdater` + native `autoUpdater` |
| **Native packaged app replacement** | **Not covered** by CI or release scripts                                                                                                     | DMG/ZIP install + Squirrel swap of `.app` |
| Signing                             | CI macOS job with secrets (when configured)                                                                                                  | Developer ID + notarized staple           |

Do not treat green CI as proof that a downloaded update replaces the installed
application bundle on disk until that path is tested on Apple Silicon hardware.

Run the lifecycle harness with:

```bash
pnpm --filter @passbook/desktop test -- src/update-lifecycle.integration.test.ts
pnpm check:passbook
```

It creates disposable data, backup directories, and loopback ports; exercises
real backups and persistence of fictional records and a PDF; and covers corrupt
downloads, backup failure, staging failure, old-version relaunch, host-version
mismatch, and recovery after quit handoff failure. Native bundle replacement is
simulated at the updater boundary.

For the signed rehearsal, use a disposable macOS account on Apple Silicon with
no installed Passbook or existing user data. Install signed release A into
Applications, create fictional records and upload a PDF, then publish signed
release B through the normal release workflow. In A, check, download, and
install B. Confirm the old process exits, B reopens automatically, both sidebar
and `/api/data/status` report B, the records and PDF still open, and the backup
remains verified. Confirm `.update/intent.json` clears only after readiness.
Keep the update history and native ShipIt log as evidence. Repeat with an
invalid signature in a separate isolated feed to confirm staging fails while A
stays usable. This rehearsal remains outstanding until signing is configured.

## First signed baseline (manual)

Existing installs that were bootstrapped from **unsigned** CI builds cannot safely
auto-update into the first **signed** channel release without operator action:

1. Back up data (`Data & backups` or `yt-data backup`).
2. Install the first **signed** DMG manually (drag to Applications).
3. Open Passbook once and confirm version in the sidebar matches the signed tag.
4. Only then rely on auto-update for subsequent Passbook-channel releases.

Do not mark a release `latest` until artifact validation and signing checks pass in CI.

## Apple signing and notarization setup

**Signing** (Developer ID Application) and **notarization** (Apple notarytool) are
separate steps. electron-builder 25.1.8 signs with `CSC_*` variables, then notarizes
when `mac.notarize` is true and Apple ID env vars are present.

### 1. Create the Developer ID Application certificate

Follow Apple’s documentation:

- [Create Developer ID certificates](https://developer.apple.com/help/account/certificates/create-developer-id-certificates)
- [Code signing overview](https://developer.apple.com/support/code-signing/)

On a Mac you can also use **Xcode → Settings → Accounts → [Team] → Manage Certificates**
and add **Developer ID Application**. Confirm the certificate appears in **login**
keychain as `Developer ID Application: …`.

### 2. Export a password-protected `.p12`

Export the certificate **and private key** from Keychain Access as a `.p12` file.
Apple documents exporting identities in
[Export certificates](https://developer.apple.com/help/account/manage-certificates/export-certificates).
Choose a strong export password (stored later as `MAC_CSC_KEY_PASSWORD`).

### 3. Prepare notarization credentials

1. Use the Apple ID email that accepted developer agreements.
2. Create an [app-specific password](https://support.apple.com/en-us/102654) for notarytool.
3. Note the **Team ID** from [Membership details](https://developer.apple.com/account).

### 4. Store GitHub Actions secrets (never commit values)

Run from a trusted machine with `gh` authenticated to `yourtoolshq/everyday`.
Use `gh secret set` interactively so values are hidden and never echoed to the shell
history. Do not paste secrets into issues, chat, or the repo.

```bash
# Base64-encode the .p12 locally, then paste the single line when prompted:
gh secret set MAC_CSC_LINK --repo yourtoolshq/everyday

gh secret set MAC_CSC_KEY_PASSWORD --repo yourtoolshq/everyday

gh secret set APPLE_ID --repo yourtoolshq/everyday

gh secret set APPLE_APP_SPECIFIC_PASSWORD --repo yourtoolshq/everyday

gh secret set APPLE_TEAM_ID --repo yourtoolshq/everyday
```

Optional: encode the certificate file without printing it to the terminal (macOS):

```bash
base64 -i ~/Downloads/DeveloperID.p12 | pbcopy
```

Then paste from the clipboard when `gh secret set MAC_CSC_LINK` prompts.

The workflow maps `MAC_CSC_*` into electron-builder’s `CSC_LINK` / `CSC_KEY_PASSWORD`
and checks all five variables are non-empty before packaging (`check-mac-signing-secrets.cjs`).

### 5. Local unsigned builds (unchanged)

Developers can still produce unsigned artifacts for local testing:

```bash
pnpm package:passbook:mac
```

CI alone uses `pnpm --filter @passbook/desktop package:mac:ci` with
`--config.forceCodeSigning=true` and the secrets above.

## Validation scripts

| Script                              | Purpose                                                                                             |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| `check-mac-signing-secrets.cjs`     | Fail fast when required secrets are missing (names only in logs).                                   |
| `sync-release-channel-metadata.cjs` | Stamp file sizes into `passbook-mac.yml` after electron-builder (sizes are not emitted by default). |
| `verify-mac-release-signing.cjs`    | `codesign --verify --deep --strict`, Developer ID authority, `xcrun stapler validate`.              |
| `validate-release-artifacts.cjs`    | `passbook-mac.yml`, arm64 ZIP/DMG/blockmaps, semver match, SHA512, sizes, safe filenames.           |

Sample builder metadata shape: `scripts/release/fixtures/electron-builder-passbook-mac.sample.yml`.

## Related commands

```bash
pnpm --filter passbook test -- scripts/release/
pnpm --filter @passbook/desktop test -- src/release-provider.test.ts
pnpm check:passbook-desktop
```
