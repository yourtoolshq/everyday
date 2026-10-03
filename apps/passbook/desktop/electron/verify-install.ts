import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

export interface ElectronInstallStatus {
  ok: boolean;
  electronDir: string;
  message?: string;
}

export function verifyElectronInstall(
  requireFrom: NodeRequire = createRequire(import.meta.url),
): ElectronInstallStatus {
  const electronDir = path.dirname(
    requireFrom.resolve("electron/package.json"),
  );
  const pathTxt = path.join(electronDir, "path.txt");

  try {
    const relativePath = fs.readFileSync(pathTxt, "utf-8").trim();
    const executable = path.join(electronDir, "dist", relativePath);
    if (!fs.existsSync(executable)) {
      return {
        ok: false,
        electronDir,
        message:
          `Electron binary is missing at ${executable}. ` +
          "Reinstall with: pnpm --filter @passbook/desktop rebuild electron",
      };
    }
    return { ok: true, electronDir };
  } catch {
    return {
      ok: false,
      electronDir,
      message:
        "Electron postinstall did not complete (path.txt is missing). " +
        "On Node 24.16+ or 26+, ensure the monorepo yauzl override is applied, " +
        "then reinstall: rm -rf node_modules && pnpm install",
    };
  }
}

export function assertElectronInstalled(
  requireFrom?: NodeRequire,
): ElectronInstallStatus {
  const status = verifyElectronInstall(requireFrom);
  if (!status.ok) {
    throw new Error(status.message);
  }
  return status;
}
