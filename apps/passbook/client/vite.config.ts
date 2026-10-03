import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(import.meta.dirname), "");
  const hostUrl = env.PASSBOOK_HOST_URL ?? "http://127.0.0.1:3847";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "~/trpc/react": path.resolve(
          import.meta.dirname,
          "./src/trpc/react.tsx",
        ),
        "~": path.resolve(import.meta.dirname, "../src"),
        "next/image": path.resolve(
          import.meta.dirname,
          "./src/shims/image.tsx",
        ),
        "next/link": path.resolve(import.meta.dirname, "./src/shims/link.tsx"),
        "next/navigation": path.resolve(
          import.meta.dirname,
          "./src/shims/navigation.ts",
        ),
        "next/headers": path.resolve(
          import.meta.dirname,
          "./src/shims/headers.ts",
        ),
        "server-only": path.resolve(
          import.meta.dirname,
          "./src/shims/server-only.ts",
        ),
      },
    },
    server: {
      host: "127.0.0.1",
      port: Number(env.VITE_DEV_PORT ?? 5173),
      strictPort: true,
      proxy: {
        "/api": {
          target: hostUrl,
          changeOrigin: true,
        },
      },
    },
    define: {
      __PASSBOOK_HOST_URL__: JSON.stringify(hostUrl),
    },
  };
});
