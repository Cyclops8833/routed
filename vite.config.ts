import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import type { Plugin } from 'vite'

/** Dev-only: proxy /api/fuel-prices to fuelprice.io server-side to avoid CORS */
function fuelPriceDevProxy(apiKey: string): Plugin {
  return {
    name: 'fuel-price-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/fuel-prices', async (req, res) => {
        if (!apiKey) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'VITE_FUELPRICE_API_KEY not set' }))
          return
        }
        const url = new URL(req.url ?? '/', 'http://localhost')
        const city = url.searchParams.get('city') ?? 'Melbourne'
        const browserHeaders = {
          'User-Agent': 'Mozilla/5.0 (compatible; Routed/1.0)',
          'Accept': 'application/json',
        }

        // Attempt 1: v1 Bearer endpoint
        try {
          const citiesRes = await fetch('https://api.fuelprice.io/v1/cities', {
            headers: { ...browserHeaders, Authorization: `Bearer ${apiKey}` },
          })
          if (citiesRes.ok) {
            const cities = await citiesRes.json() as Array<{ id: string; name: string }>
            const melbourne = cities.find((c) => c.name.toLowerCase().includes('melbourne'))
            if (melbourne) {
              const avgRes = await fetch(`https://api.fuelprice.io/v1/cities/${melbourne.id}/average`, {
                headers: { ...browserHeaders, Authorization: `Bearer ${apiKey}` },
              })
              if (avgRes.ok) {
                const avg = await avgRes.json() as { unleaded?: number; diesel?: number }
                if (typeof avg.unleaded === 'number' && avg.unleaded > 0 && typeof avg.diesel === 'number' && avg.diesel > 0) {
                  const petrol = avg.unleaded > 10 ? avg.unleaded / 100 : avg.unleaded
                  const diesel = avg.diesel > 10 ? avg.diesel / 100 : avg.diesel
                  res.writeHead(200, { 'Content-Type': 'application/json' })
                  res.end(JSON.stringify({ petrol, diesel }))
                  return
                }
              }
            }
          }
        } catch { /* fall through */ }

        // Attempt 2: legacy endpoint
        try {
          const [pRes, dRes] = await Promise.all([
            fetch(`https://fuelprice.io/api/?key=${apiKey}&action=get_city_average&fuel_type=unleaded&city=${encodeURIComponent(city)}`, { headers: browserHeaders }),
            fetch(`https://fuelprice.io/api/?key=${apiKey}&action=get_city_average&fuel_type=diesel&city=${encodeURIComponent(city)}`, { headers: browserHeaders }),
          ])
          if (pRes.ok && dRes.ok) {
            const [pdj, ddj] = await Promise.all([pRes.json() as Promise<{ average?: number }>, dRes.json() as Promise<{ average?: number }>])
            if (typeof pdj.average === 'number' && pdj.average > 0 && typeof ddj.average === 'number' && ddj.average > 0) {
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ petrol: pdj.average / 100, diesel: ddj.average / 100 }))
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      fuelPriceDevProxy(env.VITE_FUELPRICE_API_KEY ?? ''),
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
  }
})
