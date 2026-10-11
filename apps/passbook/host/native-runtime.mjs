import { createRequire } from "node:module";

// Match libsql's loader, including its Bun/glibc correction. Resolve the
// loader's dependencies from libsql itself so this also works with pnpm.
export function libsqlNativePackage(target, libcFamily, glibcFamily) {
  if (
    libcFamily === glibcFamily &&
    (target === "linux-x64-musl" || target === "linux-arm64-musl")
  ) {
    target = target.replace(/-musl$/, "-gnu");
  }
  return `@libsql/${target}`;
}

export function resolveLibsqlNativeRuntime(clientEntry) {
  const clientRequire = createRequire(clientEntry);
  const libsqlRequire = createRequire(clientRequire.resolve("libsql"));
  const { currentTarget } = libsqlRequire("@neon-rs/load");
  const { familySync, GLIBC } = libsqlRequire("detect-libc");
  const packageName = libsqlNativePackage(currentTarget(), familySync(), GLIBC);
  return { packageName, entry: libsqlRequire.resolve(packageName) };
}
