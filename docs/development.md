# Development and releases

## Local development

Tax Book uses pnpm and Node.js 22 or newer.

    cp .env.example .env
    mkdir -p .data
    pnpm install
    pnpm dev

Open <http://localhost:3000>.

The development command applies committed database migrations before starting
Next.js. This keeps an existing local database aligned with the checked-out
application version.

## Main is releasable

The **main** branch is always expected to build and run as the current
production version. Make changes on short-lived branches, open a pull request,
and squash-merge only after CI passes. Do not use main as an integration branch
for incomplete work.

Version tags and published container images are intentionally deferred.

## Database changes

Change the appropriate file under `src/server/db/schema`, then generate and
review a committed migration:

    pnpm db:generate
    pnpm db:migrate

Never use `db:push` against the production database. Production starts by
applying committed migrations and refuses to start if migration fails.

Tests, screenshots, documentation, and examples must use fictional data only.

## Self-hosting with Docker

```sh
docker compose up --build -d
```

The service binds to `127.0.0.1:3000` by default and stores its SQLite file in
the `taxbook-data` Docker volume.

Set `TAXBOOK_PORT` when port 3000 is already in use:

```sh
TAXBOOK_PORT=3200 docker compose up --build -d
```

## Traefik

Tax Book joins the external `web` Docker network and registers with Traefik at
`taxbook.tools.local`.

Add a hosts entry if needed:

```sh
echo "127.0.0.1 taxbook.tools.local" | sudo tee -a /etc/hosts
```

Then open https://taxbook.tools.local. Traefik serves a locally-trusted mkcert
wildcard certificate for `*.tools.local` (configured in dotfiles).

When Tenure is also running behind Traefik, set the Tenure base URL in Settings
to `https://tenure.tools.local`. The Docker Compose file maps that hostname to
the host gateway so server-side sync works from inside the container.

If your household was created before this hostname convention, update the Tenure
URL once in Settings.
