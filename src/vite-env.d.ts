/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SPOTIFY_CLIENT_ID: string;
    readonly VITE_SPOTIFY_CLIENT_SECRET: string;
    readonly VITE_API_BASE_URL: string;
    // add more variables as needed
  }
  
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }