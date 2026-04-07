import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import type { Plugin } from 'vite'

/** Dev-only: proxy /api/fuel-prices to fuelprice.io server-side to avoid CORS */
function fuelPriceDevProxy(): Plugin {
  return {
    name: 'fuel-price-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/fuel-prices', async (req, res) => {
        const apiKey = process.env.VITE_FUELPRICE_API_KEY
        if (!apiKey) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'VITE_FUELPRICE_API_KEY not set' }))
          return
        }
        const url = new URL(req.url ?? '/', 'http://localhost')
        const city = url.searchParams.get('city') ?? 'Melbourne'
        try {
          const [pRes, dRes] = await Promise.all([
            fetch(`https://fuelprice.io/api/?key=${apiKey}&action=get_city_average&fuel_type=unleaded&city=${encodeURIComponent(city)}`),
            fetch(`https://fuelprice.io/api/?key=${apiKey}&action=get_city_average&fuel_type=diesel&city=${encodeURIComponent(city)}`),
          ])
          if (pRes.ok && dRes.ok) {
            const [pd, dd] = await Promise.all([pRes.json() as Promise<{ average?: number }>, dRes.json() as Promise<{ average?: number }>])
            if (typeof pd.average === 'number' && pd.average > 0 && typeof dd.average === 'number' && dd.average > 0) {
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ petrol: pd.average / 100, diesel: dd.average / 100 }))
              return
            }
          }
        } catch { /* fall through */ }
        res.writeHead(502, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'upstream failed' }))
      })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    fuelPriceDevProxy(),
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
          { src: '/routed-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ]
})
