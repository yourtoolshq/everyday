/**
 * Ensures macOS release signing/notarization secrets are present without logging values.
 * Used by GitHub Actions before a signed CI package build.
 */

const REQUIRED_SECRET_ENV_VARS = [
  "MAC_CSC_LINK",
  "MAC_CSC_KEY_PASSWORD",
  "APPLE_ID",
  "APPLE_APP_SPECIFIC_PASSWORD",
  "APPLE_TEAM_ID",
];

/**
 * @param {Record<string, string | undefined>} env
 */
function findMissingMacSigningSecrets(env) {
  /** @type {string[]} */
  const missing = [];
  for (const name of REQUIRED_SECRET_ENV_VARS) {
    const value = env[name];
    if (typeof value !== "string" || value.trim().length === 0) {
      missing.push(name);
    }
  }
  return missing;
}

/**
 * @param {Record<string, string | undefined>} [env]
 */
function assertMacSigningSecretsPresent(env = process.env) {
  const missing = findMissingMacSigningSecrets(env);
  if (missing.length > 0) {
    throw new Error(
      `Missing macOS signing/notarization secrets: ${missing.join(", ")}. See apps/passbook/docs/release-workflow.md.`,
    );
  }
}

if (require.main === module) {
  try {
    assertMacSigningSecretsPresent();
    console.log("macOS signing/notarization secrets are configured.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = {
  REQUIRED_SECRET_ENV_VARS,
  assertMacSigningSecretsPresent,
  findMissingMacSigningSecrets,
};
