import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4 MiB — mapbox-gl is large
      },
      manifest: {
        name: 'Routed',
        short_name: 'Routed',
        description: 'Trip planning for the crew',
        theme_color: '#4A6741',
        background_color: '#FAFAF7',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' }
        ]
      }
    })
  ]
})
