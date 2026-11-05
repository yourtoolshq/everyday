const path = require("node:path");
const { createRequire } = require("node:module");

const desktopPackageJson = path.join(__dirname, "../../desktop/package.json");
const requireFromDesktop = createRequire(desktopPackageJson);
const updaterPackageJson = requireFromDesktop.resolve(
  "electron-updater/package.json",
);
const requireFromUpdater = createRequire(updaterPackageJson);

/** js-yaml bundled with electron-updater (via app-builder dependency graph). */
const yaml = requireFromUpdater("js-yaml");

module.exports = { yaml };
