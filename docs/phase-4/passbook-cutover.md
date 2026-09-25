# Passbook cutover

A checklist for the computer that runs Passbook. It moves Passbook from the image built from the `yourtoolshq/passbook` repository to the image built from this repository, on the same `passbook-data` volume. On first start the image takes a verified backup of the data, then upgrades it.

The rollback point is a tar of the volume taken while Passbook is stopped. If anything goes wrong, the tar goes back into the volume and the legacy image starts again.

## 1. Prepare

Passbook keeps running during this section.

- [ ] Find the legacy container and record its name:

  ```sh
  docker ps --format '{{.Names}}\t{{.Image}}\t{{.Ports}}' | grep -i passbook
  legacy=<container name>
  ```

- [ ] Check what it mounts and where its Compose project lives:

  ```sh
  docker inspect "$legacy" --format '{{range .Mounts}}{{.Type}} {{if .Name}}{{.Name}}{{else}}{{.Source}}{{end}} -> {{.Destination}}{{println}}{{end}}'
  docker inspect "$legacy" --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}  {{.Config.Image}}'
  ```

  Expect exactly one mount, `volume passbook-data -> /data`. Record the directory as `legacy_dir` and the image name as `legacy_image`. If the mounts differ, stop: the rest of this checklist assumes `passbook-data`.

- [ ] Tag the legacy image so the build below cannot replace it. Both repositories name their image `<directory>-app`, so both can be `passbook-app`:

  ```sh
  docker tag "$(docker inspect "$legacy" --format '{{.Image}}')" passbook-legacy
  ```

- [ ] Check out this repository at the commit to deploy, and build:

  ```sh
  git clone git@github.com:yourtoolshq/everyday.git ~/everyday   # or git -C ~/everyday pull
  cd ~/everyday/apps/passbook
  APP_VERSION=$(git rev-parse --short HEAD) docker compose build
  ```

- [ ] Optional: keep backups in a host directory instead of the `passbook-backups` volume, so they can be copied off the computer with ordinary file tools:

  ```sh
  echo 'PASSBOOK_BACKUP_DIR=/path/to/backups/passbook' >> ~/everyday/apps/passbook/.env
  ```

## 2. Take the rollback copy

Passbook is down from here until section 3 finishes.

- [ ] Stop the legacy app. Never add `-v`, which deletes the volume.

  ```sh
  (cd "$legacy_dir" && docker compose down)
  docker ps --filter volume=passbook-data   # expect no containers
  ```

- [ ] Tar the volume and record its checksum:

  ```sh
  mkdir -p "$HOME/passbook-cutover"
  docker run --rm -v passbook-data:/volume:ro -v "$HOME/passbook-cutover":/out alpine:3.20 \
    sh -c 'tar -C /volume -cf /out/passbook-data.tar . && cd /out && sha256sum passbook-data.tar > passbook-data.tar.sha256'
  ```

- [ ] Check the tar. It should list `./passbook.db` and `./documents/…`, and the checksum should print `OK`:

  ```sh
  tar -tf "$HOME/passbook-cutover/passbook-data.tar" | head
  docker run --rm -v "$HOME/passbook-cutover":/out alpine:3.20 sh -c 'cd /out && sha256sum -c passbook-data.tar.sha256'
  ```

- [ ] Copy `passbook-data.tar` and `passbook-data.tar.sha256` off this computer, for example to an external drive. Do not put them in a Git checkout.

## 3. Start Passbook from this repository

- [ ] Start it:

  ```sh
  cd ~/everyday/apps/passbook
  docker compose up -d
  ```

- [ ] Wait for the upgrade to finish. While it runs, https://passbook.tools.local shows "Upgrading your data".

  ```sh
  until curl -fs http://127.0.0.1:3002/api/health | grep -q '"status":"ok"'; do sleep 2; done
  curl -s http://127.0.0.1:3002/api/health
  ```

  If the response shows `"state":"blocked"`, or the container keeps restarting, run `docker compose logs app` and go to section 4.

- [ ] Confirm the upgrade backup. `yt-data list` should show one `pre-migration` backup marked `verified`:

  ```sh
  docker compose exec app yt-data list
  ```

- [ ] Open https://passbook.tools.local. The accounts, statements, activity and documents should match what was there before. Open a few old documents of each type.

- [ ] Go to Data & backups in the sidebar, then Integrity, then **Scan now**. The first scan records a checksum for each existing file ("N files read, N checksums recorded"). All three checks are green.

## 4. Roll back

Only if section 3 fails.

- [ ] Stop Passbook without deleting volumes:

  ```sh
  cd ~/everyday/apps/passbook && docker compose down
  ```

- [ ] Keep the failed state for analysis:

  ```sh
  docker run --rm -v passbook-data:/volume:ro -v "$HOME/passbook-cutover":/out alpine:3.20 \
    tar -C /volume -cf /out/passbook-data-failed.tar .
  ```

- [ ] Put the rollback copy back:

  ```sh
  docker run --rm -v passbook-data:/volume -v "$HOME/passbook-cutover":/in:ro alpine:3.20 \
    sh -c 'find /volume -mindepth 1 -maxdepth 1 -exec rm -rf {} + && tar -C /volume -xpf /in/passbook-data.tar'
  ```

- [ ] Start the legacy image:

  ```sh
  docker tag passbook-legacy "$legacy_image"
  (cd "$legacy_dir" && docker compose up -d)
  ```

## 5. Feature tests

These tests run on the real app but use only a test account and fictional files. Every change except the restore test stays inside that account. The restore test rolls the whole app back to a backup, so make no real edits while it runs.

Prepare these files:

- a PDF, an image, and an audio file (MP3 or M4A)
- an `.eml` email with an HTML body and an attachment
- `fake.pdf`, a text file renamed to `.pdf`: `echo hello > fake.pdf`
- `notes.txt`
- `big.pdf`, larger than 25 MB: `head -c 27000000 /dev/zero > big.pdf`

### Setup

- [ ] Create an account named "Test – delete me".

### Upload box

Use it from any upload sheet.

- [ ] Choose a file. A progress bar shows "Uploading… N%", then "<size> · Uploaded".
- [ ] Drag a file onto the box. It uploads the same way.
- [ ] **Replace**, then pick another file. The new file shows.
- [ ] **Remove**. The box goes back to "Drop a file here, or Choose a file".
- [ ] Save without a file. The sheet shows "Choose a file to upload."
- [ ] `notes.txt` is rejected with "Upload a PDF, an image, an .eml file, or a common audio file (MP3, M4A, WAV, OGG)."
- [ ] `fake.pdf` is rejected with the same message, because its content is not a PDF.
- [ ] `big.pdf` is rejected with "The file must be 25 MB or smaller."
- [ ] Upload a file, then close the sheet without saving. No document appears. The unsaved upload is removed after 24 hours.

### Account documents

- [ ] On the test account, go to Documents, then **Add**. Fill in title, type and date, and upload the PDF. The toast reads "Document uploaded." and the document is listed.
- [ ] Repeat with the image, the audio file and the `.eml`.
- [ ] **Open** each one:
  - The PDF, image and audio file open in a new tab in the browser's own viewer.
  - The `.eml` opens the email page; see "Email viewer" below.
- [ ] Edit a document's title, type and notes. The toast reads "Document updated." and the file still opens.
- [ ] Upload a document with type "Void cheque". The Void cheque section links to it, and Open works.
- [ ] Delete a document and confirm "Delete document?". The toast reads "Document removed." Reloading its open tab now shows 404.
- [ ] The Documents page lists the test account's documents with their account, type and date.

### Statements

- [ ] On the Documents page, choose **Upload statement**. Pick the test account, a period, and the PDF. The toast reads "Statement uploaded."
- [ ] Upload a second statement for the same account and period. It is rejected with "This account already has a statement for that period."
- [ ] Leave out the account, then the period. The errors read "Choose an account." and "Choose a statement period."
- [ ] Open the statement's details. They show the date, size and notes, and Open works.
- [ ] Delete the statement. It disappears, and its file URL shows 404.

### Activity documents

- [ ] On the test account, create an activity, then **Add document**. The toast reads "Document added to activity." and the document opens.
- [ ] Remove that document from the activity. The toast reads "Document removed."
- [ ] Add another document, then delete the activity. The toast reads "Activity deleted." The document stays in the account's Documents list, without the activity link.

### Email viewer

- [ ] The `.eml` page shows From, To, Date and Subject, the formatted HTML body, and the Attachments list.
- [ ] Downloading an attachment works, and so does downloading the original email.
- [ ] In a narrow window, the header rows stack.
- [ ] `https://passbook.tools.local/files/00000000-0000-0000-0000-000000000000` shows a 404 page.

### Data & backups page

- [ ] Storage shows:
  - Database size.
  - Files (N), broken down into PDF, Images, Email and Audio.
  - Backups (N).
  - Free space for the data volume and the backup volume.
- [ ] After an upload and a reload, the Files count has gone up by one.
- [ ] Automatic backups shows "Every day at 02:00, server time.", plus Keeps, Last and Next.
- [ ] **Back up now**. A Manual backup is added and marked verified.
- [ ] **Verify** on that row reports "Backup checked".
- [ ] **Download** saves a `.ytbackup` file. `tar -tf <file>` lists `manifest.json`, the database and the documents.
- [ ] No warning banner shows at the top of the app.
- [ ] The next morning, a Scheduled backup from 02:00 is listed and verified.

### Restore

Make no real edits during this test.

- [ ] **Back up now**.
- [ ] Upload a test document titled "After backup".
- [ ] Open a second tab on the app.
- [ ] Restore the backup you just made, and confirm "Restore this backup?". Both tabs show "Restoring a backup", then reload by themselves.
- [ ] "After backup" is gone, and a "Before a restore" backup is listed.
- [ ] Restore that "Before a restore" backup. "After backup" is back.

### Integrity

Run the commands in `~/everyday/apps/passbook`.

- [ ] **Scan now** shows "Scan finished." and three green checks: "Database structure is intact", "Every relationship is intact" and "Every stored file is in use".
- [ ] **Missing file:**
  1. Upload a PDF to the test account.
  2. Take `<id>` from the URL its Open link goes to, `/api/data/files/<id>`.
  3. Move the file aside:
     ```sh
     docker compose exec app mv /data/documents/<id>.pdf /tmp/
     ```
  4. **Scan now**. It shows "1 file missing on disk" and "Restore the newest verified backup."
  5. Move the file back:
     ```sh
     docker compose exec app mv /tmp/<id>.pdf /data/documents/
     ```
  6. **Scan now**. The scan is clean.
- [ ] **Changed file:**
  1. Append a line to the same file:
     ```sh
     docker compose exec app sh -c 'echo x >> /data/documents/<id>.pdf'
     ```
  2. **Scan now**. It shows "1 file changed since upload".
  3. Delete that document, then **Scan now**. The scan is clean.
- [ ] **Stray file:**
  1. Create a file with no record:
     ```sh
     docker compose exec app sh -c 'echo x > /data/documents/stray.txt'
     ```
  2. **Scan now**. It shows "1 file not used by any record" and lists `stray.txt` with "No file record".
  3. **Move to quarantine**. It reports "Moved 1 file to quarantine." and "1 file in quarantine".
  4. **Delete quarantined files**, then **Delete**. It reports "Deleted 1 quarantined file."
- [ ] **Deleted account:**
  1. Delete the test account.
  2. **Scan now**. Its remaining files are listed under "N files not used by any record", each with the endpoint `document`.
  3. Move them to quarantine and delete them.
  4. **Scan now**. The scan is clean.

### Restarts and the command line

- [ ] `docker compose restart`. Passbook comes back with its data, and `yt-data list` shows no new `pre-migration` backup.
- [ ] `curl -s http://127.0.0.1:3002/api/health` shows `"status":"ok"`, `"backup":{"status":"ok"` and `"sharesDataDir":false`.
- [ ] `docker compose exec app yt-data backup` prints "Created backup <id>: verified", and `yt-data list` shows it.
- [ ] `docker compose exec app yt-data verify <id>` reports the backup verified.
- [ ] Optional: restart the computer. Passbook starts by itself. If the computer was off at 02:00, a catch-up backup runs within a few minutes.

## 6. Finish

- [ ] The test account is gone, the quarantine is empty, and **Scan now** is clean.
- [ ] Keep `~/passbook-cutover/passbook-data.tar` and its off-computer copy for at least 30 days.
- [ ] Remove the legacy tag once the tar's hold ends: `docker image rm passbook-legacy`.
