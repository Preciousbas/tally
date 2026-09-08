/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NETWORK_ID: string;
  readonly VITE_INDEXER_URL: string;
  readonly VITE_DEFAULT_CONTRACT: string;
  readonly VITE_PROOF_SERVER_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
