/**
 * Vercel Edge Function — server-side proxy for fuelprice.io
 * Avoids CORS issues with direct browser requests.
 * Called by fuelPrices.ts as /api/fuel-prices?city=Melbourne
 */
export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  const apiKey = process.env.VITE_FUELPRICE_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'VITE_FUELPRICE_API_KEY not configured' }, { status: 500 })
  }

  const city = new URL(req.url).searchParams.get('city') ?? 'Melbourne'

  // Attempt 1: legacy endpoint
  try {
    const [pRes, dRes] = await Promise.all([
      fetch(`https://fuelprice.io/api/?key=${apiKey}&action=get_city_average&fuel_type=unleaded&city=${encodeURIComponent(city)}`),
      fetch(`https://fuelprice.io/api/?key=${apiKey}&action=get_city_average&fuel_type=diesel&city=${encodeURIComponent(city)}`),
    ])
    if (pRes.ok && dRes.ok) {
      const [pd, dd] = await Promise.all([pRes.json() as Promise<{ average?: number }>, dRes.json() as Promise<{ average?: number }>])
      if (typeof pd.average === 'number' && pd.average > 0 && typeof dd.average === 'number' && dd.average > 0) {
        return Response.json({ petrol: pd.average / 100, diesel: dd.average / 100 })
      }
    }
  } catch {
    // fall through to v1
  }

  // Attempt 2: v1 endpoint
  try {
    const citiesRes = await fetch('https://api.fuelprice.io/v1/cities', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (citiesRes.ok) {
      const cities = (await citiesRes.json()) as Array<{ id: string; name: string }>
      const melbourne = cities.find((c) => c.name.toLowerCase().includes('melbourne'))
      if (melbourne) {
        const avgRes = await fetch(`https://api.fuelprice.io/v1/cities/${melbourne.id}/average`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        })
        if (avgRes.ok) {
          const avgData = (await avgRes.json()) as { unleaded?: number; diesel?: number }
          if (typeof avgData.unleaded === 'number' && avgData.unleaded > 0 && typeof avgData.diesel === 'number' && avgData.diesel > 0) {
            const petrol = avgData.unleaded > 10 ? avgData.unleaded / 100 : avgData.unleaded
            const diesel = avgData.diesel > 10 ? avgData.diesel / 100 : avgData.diesel
            return Response.json({ petrol, diesel })
          }
        }
      }
    }
  } catch {
    // both failed
  }

  return Response.json({ error: 'upstream failed' }, { status: 502 })
}
