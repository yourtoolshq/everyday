# Passbook host

Standalone Node.js HTTP host for Passbook data and API routes.

## Launch

```bash
cd apps/passbook/host
DATA_DIR=./.data/host-test BACKUP_DIR=./.data/host-test/backups pnpm dev
```

Default bind: `http://127.0.0.1:3847`

## Configuration

| Variable     | Default        |
| ------------ | -------------- |
| `DATA_DIR`   | `./.data`      |
| `BACKUP_DIR` | `<DATA_DIR>/backups` |
| `HOST`       | `127.0.0.1`    |
| `PORT`       | `3847`         |

## Verification

```bash
pnpm check:passbook-host
pnpm check:passbook
curl -s http://127.0.0.1:3847/api/health
```
