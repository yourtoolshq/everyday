import crypto from "node:crypto";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const requireFromUpdater = createRequire(
  require.resolve("electron-updater/package.json"),
);
const semver = requireFromUpdater("semver") as {
  parse: (version: string) => { version: string } | null;
};

const { GitHubProvider } =
  require("electron-updater/out/providers/GitHubProvider") as {
    GitHubProvider: new (
      options: { owner: string; repo: string; channel?: string },
      updater: {
        allowPrerelease: boolean;
        channel?: string;
        currentVersion: { version: string };
        fullChangelog: boolean;
      },
      runtimeOptions: {
        platform: string;
        executor: {
          request: (options: unknown, token: unknown) => Promise<string | null>;
        };
      },
    ) => {
      getLatestVersion: () => Promise<{
        tag: string;
        version: string;
        files: { url: string; sha512: string }[];
      }>;
      resolveFiles: (updateInfo: {
        tag: string;
        version: string;
        files: { url: string; sha512: string }[];
      }) => { url: URL; info: { url?: string } }[];
    };
  };

const { findFile } = require("electron-updater/out/providers/Provider") as {
  findFile: (
    files: { url: URL; info: { url?: string } }[],
    extension: string,
    not?: string[],
  ) => { url: URL; info: { url?: string } } | undefined;
};

const { MacUpdater } = require("electron-updater/out/MacUpdater") as {
  MacUpdater: {
    filterFilesForArch: (
      files: { url: URL; info: { url?: string } }[],
      isArm64Mac: boolean,
    ) => { url: URL; info: { url?: string } }[];
  };
};

const { AppUpdater } = require("electron-updater/out/AppUpdater") as {
  AppUpdater: new (
    options: null,
    app: {
      version: string;
      name: string;
      isPackaged: boolean;
      appUpdateConfigPath: string;
      userDataPath: string;
      baseCachePath: string;
      whenReady: () => Promise<void>;
      relaunch: () => void;
      quit: () => void;
      onQuit: (handler: (exitCode: number) => void) => void;
    },
  ) => {
    allowDowngrade: boolean;
    isUpdateAvailable: (updateInfo: { version: string }) => Promise<boolean>;
  };
};

class TestAppUpdater extends AppUpdater {
  doDownloadUpdate() {
    return Promise.resolve([]);
  }

  quitAndInstall() {
    return undefined;
  }
}

const PASSBOOK_TAG = "v0.2.0-passbook.20260101.2";
const PASSBOOK_VERSION = "0.2.0-passbook.20260101.2";
const PASSBOOK_CHANNEL_FILE = "passbook-mac.yml";
const ZIP_NAME = `Passbook-${PASSBOOK_VERSION}-arm64.zip`;
const DMG_NAME = `Passbook-${PASSBOOK_VERSION}-arm64.dmg`;

const FIXTURE_ZIP_SHA512 = crypto
  .createHash("sha512")
  .update("passbook-fixture-zip-bytes")
  .digest("base64");
const FIXTURE_DMG_SHA512 = crypto
  .createHash("sha512")
  .update("passbook-fixture-dmg-bytes")
  .digest("base64");

function atomFeed() {
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Taxbook 0.9.0</title>
    <link href="https://github.com/yourtoolshq/everyday/releases/tag/v0.9.0-taxbook.20260101.1" />
    <content>Taxbook release</content>
  </entry>
  <entry>
    <title>Passbook ${PASSBOOK_VERSION}</title>
    <link href="https://github.com/yourtoolshq/everyday/releases/tag/${PASSBOOK_TAG}" />
    <content>Passbook release</content>
  </entry>
</feed>`;
}

function passbookChannelYaml() {
  return [
    `version: ${PASSBOOK_VERSION}`,
    "files:",
    `  - url: ${ZIP_NAME}`,
    `    sha512: ${FIXTURE_ZIP_SHA512}`,
    `    size: 128`,
    `  - url: ${DMG_NAME}`,
    `    sha512: ${FIXTURE_DMG_SHA512}`,
    `    size: 256`,
    `path: ${ZIP_NAME}`,
    `sha512: ${FIXTURE_ZIP_SHA512}`,
    "",
  ].join("\n");
}

function createRecordingExecutor() {
  const requests: string[] = [];
  const executor = {
    request: (options: unknown, _token: unknown) => {
      const request = options as { path?: string; href?: string };
      const target = String(request.path ?? request.href ?? "");
      requests.push(target);
      if (target.endsWith(".atom")) {
        return Promise.resolve(atomFeed());
      }
      if (target.includes(PASSBOOK_CHANNEL_FILE)) {
        return Promise.resolve(passbookChannelYaml());
      }
      if (target.includes("latest-mac.yml")) {
        return Promise.resolve("version: 0.0.0\nfiles: []\n");
      }
      throw new Error(`Unexpected request: ${target}`);
    },
  };
  return { executor, requests };
}

function createFakePassbookApp(version: string) {
  return {
    version,
    name: "Passbook",
    isPackaged: true,
    appUpdateConfigPath: "/tmp/passbook-app-update.yml",
    userDataPath: "/tmp/passbook-user",
    baseCachePath: "/tmp/passbook-cache",
    whenReady: () => Promise.resolve(),
    relaunch: () => undefined,
    quit: () => undefined,
    onQuit: () => undefined,
  };
}

function createPassbookGitHubProvider(currentVersion: string) {
  const { executor } = createRecordingExecutor();
  return new GitHubProvider(
    { owner: "yourtoolshq", repo: "everyday", channel: "passbook" },
    {
      allowPrerelease: true,
      channel: "passbook",
      currentVersion: semver.parse(currentVersion) ?? {
        version: currentVersion,
      },
      fullChangelog: false,
    },
    { platform: "darwin", executor },
  );
}

describe("installed GitHubProvider", () => {
  it("selects passbook-mac.yml and resolves download URLs under the Passbook tag", async () => {
    const { executor, requests } = createRecordingExecutor();
    const provider = new GitHubProvider(
      { owner: "yourtoolshq", repo: "everyday", channel: "passbook" },
      {
        allowPrerelease: true,
        channel: "passbook",
        currentVersion: semver.parse("0.2.0-passbook.20260101.1") ?? {
          version: "0.2.0-passbook.20260101.1",
        },
        fullChangelog: false,
      },
      { platform: "darwin", executor },
    );

    const latest = await provider.getLatestVersion();
    expect(latest.tag).toBe(PASSBOOK_TAG);
    expect(latest.version).toBe(PASSBOOK_VERSION);

    const resolved = provider.resolveFiles(latest);
    const arm64Resolved = MacUpdater.filterFilesForArch(resolved, true);
    const zipFile = findFile(arm64Resolved, "zip", ["pkg", "dmg"]);

    expect(zipFile?.info.url).toBe(ZIP_NAME);
    expect(zipFile?.url.href).toBe(
      `https://github.com/yourtoolshq/everyday/releases/download/${PASSBOOK_TAG}/${ZIP_NAME}`,
    );
    expect(requests.some((url) => url.includes(PASSBOOK_CHANNEL_FILE))).toBe(
      true,
    );
    expect(requests.some((url) => url.includes("latest-mac.yml"))).toBe(false);
  });

  it("uses findFile and filterFilesForArch to pick the arm64 zip asset", async () => {
    const provider = createPassbookGitHubProvider("0.2.0-passbook.20260101.1");
    const latest = await provider.getLatestVersion();
    const resolved = provider.resolveFiles(latest);
    const filtered = MacUpdater.filterFilesForArch(resolved, true);
    const zip = findFile(filtered, "zip", ["pkg", "dmg"]);
    expect(zip?.url.pathname).toContain(`${PASSBOOK_TAG}/${ZIP_NAME}`);
  });
});

describe("installed AppUpdater.isUpdateAvailable", () => {
  it("returns false for an older Passbook feed version", async () => {
    const updater = new TestAppUpdater(
      null,
      createFakePassbookApp("0.2.0-passbook.20260101.2"),
    );
    updater.allowDowngrade = false;

    await expect(
      updater.isUpdateAvailable({ version: "0.2.0-passbook.20260101.1" }),
    ).resolves.toBe(false);
  });

  it("returns true for a newer Passbook feed version", async () => {
    const updater = new TestAppUpdater(
      null,
      createFakePassbookApp("0.2.0-passbook.20260101.1"),
    );
    updater.allowDowngrade = false;

    await expect(
      updater.isUpdateAvailable({ version: "0.2.0-passbook.20260101.2" }),
    ).resolves.toBe(true);
  });
});
