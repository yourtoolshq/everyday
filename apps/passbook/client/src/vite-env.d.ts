/// <reference types="vite/client" />

declare const __PASSBOOK_HOST_URL__: string;

interface ImportMetaEnv {
  readonly VITE_PASSBOOK_HOST_URL?: string;
  readonly VITE_PASSBOOK_ALLOW_REMOTE?: string;
  readonly VITE_DEV_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
