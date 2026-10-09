import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// LUXARDO FASHION storefront build -> dist/ (Firebase Hosting, project
// luxardo-fashion-website). LUXARDO FLOW lives in its own repo/app now.
export default defineConfig(() => {
  const buildTime = new Date().toISOString();

  return {
    plugins: [react(), tailwindcss()],

    define: {
      '__BUILD_TIME__': JSON.stringify(buildTime),
    },

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
      outDir: 'dist',
      emptyOutDir: true,

      rollupOptions: {
        output: {
          entryFileNames : 'assets/[name].[hash].js',
          chunkFileNames : 'assets/[name].[hash].js',
          assetFileNames : 'assets/[name].[hash][extname]',

          // Only libraries every page needs get their own long-cached files,
          // so a website update doesn't make returning shoppers re-download
          // them. Everything else (admin-only libraries like markdown, the
          // tour, the AI SDK) is split per page by Rollup and never reaches a
          // shopper who doesn't open that page.
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (/node_modules\/(@firebase|firebase)\//.test(id)) return 'vendor-firebase';
            if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'vendor-react';
          },
        },
      },

      chunkSizeWarningLimit: 800,
    },
  };
});