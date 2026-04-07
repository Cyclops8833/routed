interface Env {
  FIREBASE_SERVICE_ACCOUNT_JSON: string
  NOTIFY_SHARED_SECRET: string
}

interface NotifyRequest {
  tokens: string[]
  notification: {
    title: string
    body: string
  }
}

// Google OAuth2 JWT for service account
async function getAccessToken(serviceAccount: {
  client_email: string
  private_key: string
  token_uri: string
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = btoa(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: serviceAccount.token_uri,
      iat: now,
      exp: now + 3600,
    })
  )

  const textEncoder = new TextEncoder()
  const signingInput = textEncoder.encode(`${header}.${payload}`)

  // Import RSA private key
  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '')
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, signingInput)
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  // Base64url encode header and payload too
  const headerB64 = header.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const payloadB64 = payload.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const jwt = `${headerB64}.${payloadB64}.${sig}`

  const tokenRes = await fetch(serviceAccount.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  const tokenData = (await tokenRes.json()) as { access_token: string }
  return tokenData.access_token
}

function sanitize(str: string, maxLen: number): string {
  return String(str || '')
    .slice(0, maxLen)
    .replace(/[<>]/g, '')
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        },
      })
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    // Auth: pre-shared secret
    const authHeader = request.headers.get('Authorization')
    if (authHeader !== `Bearer ${env.NOTIFY_SHARED_SECRET}`) {
      return new Response('Unauthorized', { status: 401 })
    }

    const body = (await request.json()) as NotifyRequest

    // Validate payload
    if (!body.tokens || !Array.isArray(body.tokens) || body.tokens.length === 0) {
      return new Response('Missing tokens', { status: 400 })
    }
    if (!body.notification?.title || !body.notification?.body) {
      return new Response('Missing notification title/body', { status: 400 })
    }

    // Sanitise notification content
    const title = sanitize(body.notification.title, 100)
    const bodyText = sanitize(body.notification.body, 200)

    // Get service account and derive project ID
    const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON) as {
      client_email: string
      private_key: string
      token_uri: string
      project_id: string
    }
    const projectId = serviceAccount.project_id

    // Get Google OAuth2 access token
    const accessToken = await getAccessToken(serviceAccount)

    // Send to each token (FCM HTTP v1 sends one message at a time)
    const results = await Promise.allSettled(
      body.tokens.map(async (token: string) => {
        const res = await fetch(
          `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: {
                token,
                notification: { title, body: bodyText },
                webpush: {
                  headers: { Urgency: 'high' },
                  notification: {
                    icon: '/icon-192.png',
                    badge: '/icon-192.png',
                  },
                },
              },
            }),
          }
        )
        if (!res.ok) {
          const err = await res.text()
          return { token, status: res.status, error: err }
        }
        return { token, status: 200 }
      })
    )

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  },
} satisfies ExportedHandler<Env>
