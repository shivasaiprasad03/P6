/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" for the static build that runs all logic in the browser (no API server). */
  readonly VITE_STANDALONE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
