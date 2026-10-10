# Investment statement UI evidence

Captured from the running Passbook client using a fictional Northwind Securities
account and fictional April–September 2026 statements. No supplied personal
statement or identifying information is included.

- [Guided summary beside the PDF](./summary.png)
- [Holdings with market/book differences](./holdings.png)
- [Latest saved account overview](./account-overview.png)
- [Summary at a narrower width in dark appearance](./summary-narrow-dark.png)
- [PDF rendered by the production desktop host](./pdf-production-host.png)

The production-host screenshot uses the built client served on `127.0.0.1:3847`,
confirming that the bundled `.mjs` PDF worker loads through the desktop asset
handler with a JavaScript MIME type. This verifies the host path in Chromium;
it is not a packaged Electron app screenshot.

The backup-location banner is the existing development environment warning.
