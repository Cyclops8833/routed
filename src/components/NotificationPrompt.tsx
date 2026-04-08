import { useState } from 'react'
import { useNotifications } from '../contexts/NotificationContext'

interface Props {
  requestPermission: () => Promise<boolean>
  isSupported: boolean
  permission: NotificationPermission
}

/**
 * Contextual notification permission prompt (D-03).
 * Shows a non-intrusive banner when:
 * - User has unvoted trips (a relevant event)
 * - Permission is 'default' (not yet decided)
 * - Push is supported in this browser
 * - User hasn't dismissed the prompt this session
 */
export function NotificationPrompt({ requestPermission, isSupported, permission }: Props) {
  const { unvotedTrips } = useNotifications()
  const [dismissed, setDismissed] = useState(false)
  const [requesting, setRequesting] = useState(false)

  // Only show when: supported, not yet decided, has a relevant event, not dismissed
  const shouldShow = isSupported
    && permission === 'default'
    && unvotedTrips > 0
    && !dismissed

  if (!shouldShow) return null

  async function handleEnable() {
    setRequesting(true)
    await requestPermission()
    setRequesting(false)
    setDismissed(true)
  }

  return (
    <div
      className="fixed bottom-20 left-4 right-4 z-50 bg-white dark:bg-gray-800 border border-moss/20 rounded-xl p-4 shadow-lg flex items-center gap-3"
      role="alert"
    >
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          Turn on notifications?
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Get alerted when trips need your vote
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
        aria-label="Dismiss notification prompt"
      >
        Later
      </button>
      <button
        onClick={handleEnable}
        disabled={requesting}
        className="bg-moss text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-moss/90 disabled:opacity-50"
      >
        {requesting ? 'Enabling...' : 'Enable'}
      </button>
    </div>
  )
}
