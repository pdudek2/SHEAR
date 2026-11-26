import { useEffect, useState } from 'react'
import { useRouteError } from 'react-router-dom'
import { ActionFeedback } from '../components/ActionFeedback'
import { reloadPage } from '../lib/pageReload'

// Chrome, Safari and Firefox word a failed page-code download differently; Vite rejects first when a page's CSS is gone,
// and Safari when the host answers a removed file with the app's HTML.
const PAGE_CODE_FAILED = /dynamically imported module|Importing a module script failed|Unable to preload CSS|not a valid JavaScript MIME type/i
const RELOADED_AT_KEY = 'ironlog:route-error-reloaded-at'

function markReloaded(): boolean {
  try {
    sessionStorage.setItem(RELOADED_AT_KEY, String(Date.now()))
    return true
  } catch {
    return false
  }
}

// Without a readable time there is no limit, so no automatic reload.
function readReloadedAt(): number {
  try {
    return Number(sessionStorage.getItem(RELOADED_AT_KEY)) || 0
  } catch {
    return Infinity
  }
}

export function RouteError({ framed = false }: { framed?: boolean }) {
  const error = useRouteError()
  const pageCodeFailed = error instanceof Error && PAGE_CODE_FAILED.test(error.message)

  useEffect(() => {
    console.error('[route error]', error)
    // After a release the old page files are gone; one reload a minute fetches the new ones without looping.
    if (!pageCodeFailed || !navigator.onLine || Date.now() - readReloadedAt() < 60_000) return
    if (markReloaded()) reloadPage.now()
  }, [error, pageCodeFailed])

  const [stillOffline, setStillOffline] = useState(false)
  // Offline a reload would replace the app, and a workout still open in it, with the browser's offline page.
  function retry() {
    if (!navigator.onLine) {
      setStillOffline(true)
      return
    }
    markReloaded()
    reloadPage.now()
  }

  const feedback = (
    <ActionFeedback
      status="error"
      message={stillOffline
        ? 'Still offline. Try again once you are connected.'
        : pageCodeFailed
          ? 'Could not load this screen. Check your connection and try again.'
          : 'Something went wrong on this screen. Try again.'}
      onRetry={retry}
    />
  )
  if (!framed) return feedback
  return (
    <div className="page-shell flex items-center justify-center">
      <div className="page-container max-w-lg">{feedback}</div>
    </div>
  )
}
