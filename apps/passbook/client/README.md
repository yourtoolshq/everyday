# Passbook client

Vite React SPA that connects to the Passbook host.

## Development

```bash
# Terminal 1: host or host-stub
cd apps/passbook/host && DATA_DIR=./.data/client-test pnpm dev

# Terminal 2: client
cd apps/passbook/client
PASSBOOK_HOST_URL=http://127.0.0.1:3847 pnpm dev
```

Default dev URL: `http://127.0.0.1:5173`

## Configuration

| Variable                 | Default                   |
| ------------------------ | ------------------------- |
| `PASSBOOK_HOST_URL`      | `http://127.0.0.1:3847`   |
| `VITE_PASSBOOK_HOST_URL` | same as above for browser |
| `VITE_DEV_PORT`          | `5173`                    |

## Verification

```bash
pnpm check:passbook-client
```
