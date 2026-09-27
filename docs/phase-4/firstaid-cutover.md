# First Aid cutover

A checklist for the computer that runs First Aid. It moves First Aid from the image built from the `yourtoolshq/firstaid` repository to the image built from this repository, on the same `firstaid-data` volume. On first start the image takes a verified backup of the data, then upgrades it.

The rollback point is a tar of the volume taken while First Aid is stopped. If anything goes wrong, the tar goes back into the volume and the legacy image starts again.

Production and feature development may run on the same local computer, but they must use separate data. The production container keeps the named `firstaid-data` and `firstaid-backups` volumes and is reachable through Traefik at `https://firstaid.tools.local`; it does not publish an application port on the host. Run the development server against its local `.data` directory, or use isolated test volumes for a development container. Never point development or test code at the production volumes.

First Aid keeps running through "Prepare". It is down from "Take the rollback copy" until the new container is healthy or rollback finishes.

## 1. Prepare

First Aid keeps running during this section.

- [ ] Record the live container, image, Compose directory, networks, and mounts:

  ```sh
  docker ps --format '{{.Names}}\t{{.Image}}\t{{.Ports}}' | grep -i firstaid
  legacy=<container name>
  docker inspect "$legacy" --format '{{range .Mounts}}{{.Type}} {{if .Name}}{{.Name}}{{else}}{{.Source}}{{end}} -> {{.Destination}}{{println}}{{end}}'
  docker inspect "$legacy" --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}  {{.Config.Image}}'
  ```

  Expect the live database and files on the named volume `firstaid-data` mounted at `/data`. Record the directory as `legacy_dir` and the image name as `legacy_image`. If the mount layout differs, stop and do not continue.

- [ ] Tag the running image so the new build cannot replace it. Legacy and monorepo images can share the name `<directory>-app`:

  ```sh
  docker tag "$(docker inspect "$legacy" --format '{{.Image}}')" firstaid-legacy
  ```

- [ ] Check out the reviewed monorepo commit (this is "get latest from main" once the adoption PR is on main), then build:

  ```sh
  git clone git@github.com:yourtoolshq/everyday.git ~/everyday   # or: git -C ~/everyday fetch && git -C ~/everyday checkout main && git -C ~/everyday pull
  cd ~/everyday/apps/firstaid
  APP_VERSION=$(git rev-parse --short HEAD) docker compose build
  ```

- [ ] Optional host backup directory instead of the named backup volume:

  ```sh
  echo 'FIRSTAID_BACKUP_DIR=/path/to/backups/firstaid' >> ~/everyday/apps/firstaid/.env
  ```

- [ ] Confirm the built Compose file publishes no host port, joins only the external `web` network, sets `traefik.docker.network=web`, and routes `https://firstaid.tools.local`.

## 2. Take the rollback copy

Stop the legacy app. Never pass `-v` to `docker compose down`; that deletes the volume.

- [ ] Stop First Aid and confirm nothing is using the data volume:

  ```sh
  (cd "$legacy_dir" && docker compose down)
  docker ps --filter volume=firstaid-data   # expect no containers
  ```

- [ ] Tar `/data` while it is stopped, so `firstaid.db` and `documents/` are one point in time. Checksum it, list the archive, then copy the tar and checksum off the computer and outside any Git checkout:

  ```sh
  mkdir -p "$HOME/firstaid-cutover"
  docker run --rm -v firstaid-data:/volume:ro -v "$HOME/firstaid-cutover":/out alpine:3.20 \
    sh -c 'tar -C /volume -cf /out/firstaid-data.tar . && cd /out && sha256sum firstaid-data.tar > firstaid-data.tar.sha256'
  tar -tf "$HOME/firstaid-cutover/firstaid-data.tar" | head
  docker run --rm -v "$HOME/firstaid-cutover":/out alpine:3.20 sh -c 'cd /out && sha256sum -c firstaid-data.tar.sha256'
  ```

  The listing should include `./firstaid.db` and `./documents/…`, and the checksum check should print `OK`.

## 3. Start the monorepo image on the existing data volume

- [ ] Start First Aid on the existing `firstaid-data` volume:

  ```sh
  cd ~/everyday/apps/firstaid
  docker compose up -d
  until curl -fsS https://firstaid.tools.local/api/health | grep -q '"status":"ok"'; do sleep 2; done
  curl -fsS https://firstaid.tools.local/api/health
  docker compose exec app yt-data list
  ```

  While the migration runs, `https://firstaid.tools.local` shows "Upgrading your data". `yt-data list` must show one verified `pre-migration` backup. Health must include `"backup":{"status":"ok"` and `"sharesDataDir":false`. If health shows `"state":"blocked"`, or the container keeps restarting, run `docker compose logs app` and roll back.

- [ ] On the real site, with fictional spot checks only where new writes are required:

  - Records and files match the pre-cutover state. Open representative files of each stored type (PDF and image). First Aid does not store EML or audio.
  - Data & backups → Integrity → Scan now. The first scan records checksums. Database structure, relationships, and stored files are intact.
  - Back up now. Verify that backup. Download the `.ytbackup` and confirm `tar -tf` lists `manifest.json`, the database, and the documents.
  - Restart: `docker compose restart`. Data remains, and `yt-data list` shows no extra `pre-migration` backup.
  - `docker compose exec app yt-data backup` prints `Created backup <id>: verified`. `yt-data verify <id>` agrees.
  - `pnpm dev` on port 3001 with `DATA_DIR=./.data` runs while production is up and does not see `firstaid-data`.
  - No production host port is published. `docker ps` shows no `0.0.0.0` or `127.0.0.1` mapping for this app.

## 4. Roll back if validation fails

- [ ] Stop the monorepo app, keep a copy of the failed volume, restore the rollback tar, and start the legacy image:

  ```sh
  cd ~/everyday/apps/firstaid && docker compose down
  docker run --rm -v firstaid-data:/volume:ro -v "$HOME/firstaid-cutover":/out alpine:3.20 \
    tar -C /volume -cf /out/firstaid-data-failed.tar .
  docker run --rm -v firstaid-data:/volume -v "$HOME/firstaid-cutover":/in:ro alpine:3.20 \
    sh -c 'find /volume -mindepth 1 -maxdepth 1 -exec rm -rf {} + && tar -C /volume -xpf /in/firstaid-data.tar'
  docker tag firstaid-legacy "$legacy_image"
  (cd "$legacy_dir" && docker compose up -d)
  ```

- [ ] Confirm the legacy app loads and representative files open. Keep both archives. Do not retry against production until the failure is understood.

## 5. Close out

- [ ] Keep the off-computer tar for at least 30 days. Record the deployed commit on the Phase 4 tracking issue. Remove the `firstaid-legacy` image tag only after that hold. The host manager keeps pinning that commit; a later host rebuild must not move production forward by itself.

  ```sh
  docker image rm firstaid-legacy
  ```
