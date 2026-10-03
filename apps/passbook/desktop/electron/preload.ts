import { contextBridge } from "electron";

function readHostUrl() {
  const arg = process.argv.find((entry) =>
    entry.startsWith("--passbook-host-url="),
  );
  if (arg) {
    return arg.slice("--passbook-host-url=".length);
  }
  return process.env.PASSBOOK_HOST_URL ?? "http://127.0.0.1:3847";
}

contextBridge.exposeInMainWorld("passbookDesktop", {
  hostUrl: readHostUrl(),
});
