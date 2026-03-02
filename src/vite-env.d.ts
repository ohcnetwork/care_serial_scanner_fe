/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SCANNER_BRIDGE_DOWNLOAD_MACOS: string;
  readonly VITE_SCANNER_BRIDGE_DOWNLOAD_WINDOWS: string;
  readonly VITE_SCANNER_BRIDGE_DOWNLOAD_LINUX: string;
  readonly VITE_SCANNER_BRIDGE_GITHUB: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
