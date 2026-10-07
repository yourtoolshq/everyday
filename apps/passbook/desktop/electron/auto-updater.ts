import { createRequire } from "node:module";
import type * as ElectronUpdaterModule from "electron-updater";

const require = createRequire(import.meta.url);

const updater = require("electron-updater") as typeof ElectronUpdaterModule;

export const autoUpdater = updater.autoUpdater;
