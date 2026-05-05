import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env       = loadEnv(mode, '.', '');
  const buildTime = new Date().toISOString(); 

  return {
    plugins: [react(), tailwindcss()],

    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
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