/**
 * Vercel Edge Function — Servo Saver (Service Victoria) fuel price proxy.
 * Avoids CORS issues with direct browser requests.
 * Called by fuelPrices.ts as /api/fuel-prices
 */
export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  const consumerId = process.env.VITE_SERVO_SAVER_CONSUMER_ID
  if (!consumerId) {
    return Response.json({ error: 'VITE_SERVO_SAVER_CONSUMER_ID not configured' }, { status: 500 })
  }

  try {
    const res = await fetch('https://api.fuel.service.vic.gov.au/open-data/v1/fuel/prices', {
      headers: {
        'x-consumer-id': consumerId,
        'x-transactionid': crypto.randomUUID(),
        'User-Agent': 'Routed/1.0',
      },
    })
    if (!res.ok) return Response.json({ error: `upstream ${res.status}` }, { status: 502 })

    const data = await res.json() as {
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
      return Response.json({ error: 'no price data' }, { status: 502 })
    }

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
    return Response.json({ petrol: avg(petrolCents) / 100, diesel: avg(dieselCents) / 100 })
  } catch {
    return Response.json({ error: 'upstream failed' }, { status: 502 })
  }
}
