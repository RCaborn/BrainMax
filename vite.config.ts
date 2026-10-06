import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Browser storage is tied to origin (host + port), so the ports are fixed:
// changing them would make the app look like it lost your progress.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'BrainMax',
        short_name: 'BrainMax',
        description: 'Daily mental maths, Spanish vocab and puzzles.',
        theme_color: '#0f1115',
        background_color: '#0f1115',
        display: 'standalone',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,json}'], maximumFileSizeToCacheInBytes: 5_000_000 },
    }),
  ],
  build: { chunkSizeWarningLimit: 800 },
  server: { port: 5199, strictPort: true },
  preview: { port: 5199, strictPort: true },
  test: { environment: 'node' },
})
