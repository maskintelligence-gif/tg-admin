import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  // Use '/' for Capacitor/Firebase, '/tg-admin/' only for GitHub Pages
  const base = env.VITE_BASE_URL || '/';

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'icons/apple-touch-icon.png',
          'icons/icon-192.png',
          'icons/icon-512.png',
        ],
        manifest: {
          name: 'TooroGadgets Admin',
          short_name: 'TG Admin',
          description: 'Admin dashboard for TooroGadgets store',
          theme_color: '#2563eb',
          background_color: '#080d1a',
          display: 'standalone',
          orientation: 'portrait',
          scope: base,
          start_url: base,
          icons: [
            { src: 'icons/icon-72.png',   sizes: '72x72',   type: 'image/png' },
            { src: 'icons/icon-96.png',   sizes: '96x96',   type: 'image/png' },
            { src: 'icons/icon-128.png',  sizes: '128x128', type: 'image/png' },
            { src: 'icons/icon-144.png',  sizes: '144x144', type: 'image/png' },
            { src: 'icons/icon-152.png',  sizes: '152x152', type: 'image/png' },
            { src: 'icons/icon-192.png',  sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'icons/icon-384.png',  sizes: '384x384', type: 'image/png' },
            { src: 'icons/icon-512.png',  sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Cache all assets for offline use
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              // Cache Supabase API responses
              urlPattern: /^https:\/\/lpcpporrmoxgaxnxejol\.supabase\.co\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-cache',
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 }, // 1 hour
                networkTimeoutSeconds: 10,
              },
            },
            {
              // Cache Google Fonts
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
          ],
        },
        // Development mode — set to true to test SW locally
        devOptions: { enabled: false },
      }),
    ],
    base,
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
