import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Browser storage is tied to origin (host + port), so the ports are fixed:
// changing them would make the app look like it lost your progress.
// GitHub Pages serves the app from /BrainMax/; local builds stay at the root.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'BrainMax',
        short_name: 'BrainMax',
        description: 'Daily mental maths, Spanish vocab and puzzles.',
        theme_color: '#0f1115',
        background_color: '#0f1115',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,json,png}'], maximumFileSizeToCacheInBytes: 5_000_000 },
    }),
  ],
  build: { chunkSizeWarningLimit: 1200 },
  server: { port: 5199, strictPort: true },
  preview: { port: 5199, strictPort: true },
  test: { environment: 'node' },
})
