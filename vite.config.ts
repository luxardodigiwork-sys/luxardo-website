import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { defineConfig, loadEnv } from 'vite';

const FIREBASE_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_FIREBASE_MEASUREMENT_ID',
];

export default defineConfig(({ mode }) => {
  const env       = loadEnv(mode, '.', '');
  const buildTime = new Date().toISOString();

  // Split builds: default (and `production`) → dist/ = B2C (luxardo-fashion-website),
  // `--mode loom` → dist-loom/ = Loom production system (luxardo-flow).
  // Keep the two outputs fully separate so deploying one never touches the other.
  const isLoom    = mode === 'loom';
  const outDir    = isLoom ? 'dist-loom' : 'dist';

  const define: Record<string, string> = {
    'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    '__BUILD_TIME__': JSON.stringify(buildTime),
  };

  if (isLoom) {
    // Vite's loadEnv() lets process.env VITE_* vars override parsed env files.
    // The dev shell exports B2C VITE_FIREBASE_* values, which would defeat
    // .env.loom. Parse .env.loom directly (bypassing process.env) and force the
    // exact keys via define so the Loom bundle is always luxardo-flow.
    const loomRaw = fs.existsSync('.env.loom')
      ? dotenv.parse(fs.readFileSync('.env.loom'))
      : {};
    for (const key of FIREBASE_ENV_KEYS) {
      const val = loomRaw[key];
      if (!val) {
        throw new Error(`vite.config: .env.loom is missing required key ${key}`);
      }
      define[`import.meta.env.${key}`] = JSON.stringify(val);
    }
  }

  return {
    plugins: [react(), tailwindcss()],

    define,

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },

    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },

    build: {
      manifest: true,
      outDir,
      emptyOutDir: true,

      rollupOptions: {
        output: {
          entryFileNames : 'assets/[name].[hash].js',
          chunkFileNames : 'assets/[name].[hash].js',
          assetFileNames : 'assets/[name].[hash][extname]',

          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('firebase'))                return 'vendor-firebase';
              if (id.includes('motion') || id.includes('framer')) return 'vendor-motion';
              if (id.includes('react-phone-input'))       return 'vendor-phone-input';
              return 'vendor';
            }
          },
        },
      },

      chunkSizeWarningLimit: 800,
    },
  };
});