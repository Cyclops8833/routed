export interface NotificationPayload {
  title: string
  body: string
}

/**
 * Send push notification via Cloudflare Worker relay.
 * Filters out empty tokens.
 * @param tokens - Array of FCM tokens for recipients
 * @param notification - { title, body } payload
 */
export async function sendNotification(
  tokens: string[],
  notification: NotificationPayload
): Promise<void> {
  const secret = import.meta.env.VITE_NOTIFY_SECRET
  if (!secret) {
    console.warn('[notifications] VITE_NOTIFY_SECRET not configured')
    return
  }

  // Filter empty/null tokens
  const validTokens = tokens.filter((t) => t && t.length > 0)
  if (validTokens.length === 0) return

  const workerUrl = import.meta.env.VITE_NOTIFY_WORKER_URL
  if (!workerUrl) {
    console.warn('[notifications] VITE_NOTIFY_WORKER_URL not configured')
    return
  }

  try {
    const res = await fetch(`${workerUrl}/notify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tokens: validTokens,
        notification: {
          title: notification.title.slice(0, 100),
          body: notification.body.slice(0, 200),
        },
      }),
    })
    if (!res.ok) {
      console.warn('[notifications] Worker returned', res.status)
    }
  } catch (err) {
    console.warn('[notifications] Failed to send:', err)
  }
}
