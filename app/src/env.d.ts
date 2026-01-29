/// <reference types="vite/client" />

// (Optional but recommended) declare the shape of your variables for type safety:
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SOMETHING?: string;
  // add more VITE_* vars you actually use...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}