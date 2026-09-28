/**
 * Next.js application ESLint preset.
 *
 * Preserves the previous per-app `next/core-web-vitals` + `next/typescript`
 * surface via FlatCompat so we do not introduce type-checked or stylistic
 * upgrades during preset adoption. `restrictEnvAccess` stays opt-in.
 *
 * Callers must pass `import.meta.dirname` so FlatCompat resolves
 * `eslint-config-next` from the consuming package.
 */
import { FlatCompat } from "@eslint/eslintrc";
import { defineConfig } from "eslint/config";

export const nextAppIgnores = [
  ".next/**",
  "next-env.d.ts",
  "coverage/**",
  "drizzle/meta/**",
  "playwright-report/**",
  "test-results/**",
  "generated/**",
];

export function createNextAppConfig(
  baseDirectory: string,
  options?: { extraIgnores?: string[] },
) {
  const compat = new FlatCompat({ baseDirectory });

  return defineConfig(
    {
      ignores: [...nextAppIgnores, ...(options?.extraIgnores ?? [])],
    },
    ...compat.extends("next/core-web-vitals", "next/typescript"),
  );
}
