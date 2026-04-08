import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import type { Plugin } from 'vite'
// Note: SW Firebase config uses import.meta.env — VitePWA injectManifest runs through Vite so values are replaced at build time

/** Dev-only: proxy /api/fuel-prices to Servo Saver (Service Victoria) to avoid CORS */
function fuelPriceDevProxy(consumerId: string): Plugin {
  return {
    name: 'fuel-price-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/fuel-prices', async (_req, res) => {
        if (!consumerId) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'VITE_SERVO_SAVER_CONSUMER_ID not set' }))
          return
        }
        try {
          const upstream = await fetch('https://api.fuel.service.vic.gov.au/open-data/v1/fuel/prices', {
            headers: {
              'x-consumer-id': consumerId,
              'x-transactionid': crypto.randomUUID(),
              'User-Agent': 'Routed/1.0',
            },
          })
          if (!upstream.ok) {
            res.writeHead(502, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: `upstream ${upstream.status}` }))
            return
          }
          const data = await upstream.json() as {
            fuelPriceDetails: Array<{
              fuelPrices: Array<{ fuelType: string; price: number; isAvailable: boolean }>
            }>
          }
          const petrolCents: number[] = []
          const dieselCents: number[] = []
          for (const station of data.fuelPriceDetails) {
            for (const fp of station.fuelPrices) {
              if (!fp.isAvailable || typeof fp.price !== 'number' || fp.price <= 0) continue
              if (fp.fuelType === 'U91') petrolCents.push(fp.price)
              if (fp.fuelType === 'DSL') dieselCents.push(fp.price)
            }
          }
          if (petrolCents.length === 0 || dieselCents.length === 0) {
            res.writeHead(502, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'no price data' }))
            return
          }
          const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ petrol: avg(petrolCents) / 100, diesel: avg(dieselCents) / 100 }))
        } catch {
          res.writeHead(502, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'upstream failed' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      fuelPriceDevProxy(env.VITE_SERVO_SAVER_CONSUMER_ID ?? ''),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw-firebase-messaging.js',
        injectManifest: {
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
