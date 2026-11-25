import { useEffect } from 'react'
import { useRouteError } from 'react-router-dom'
import { ActionFeedback } from '../components/ActionFeedback'
import { reloadPage } from '../lib/pageReload'

// Chrome, Safari and Firefox word a failed page-code download differently.
const PAGE_CODE_FAILED = /dynamically imported module|Importing a module script failed|error loading dynamically imported module/i
const RELOADED_AT_KEY = 'ironlog:route-error-reloaded-at'

function readReloadedAt(): number {
  try {
    return Number(sessionStorage.getItem(RELOADED_AT_KEY)) || 0
  } catch {
    return 0
  }
}

export function RouteError({ framed = false }: { framed?: boolean }) {
  const error = useRouteError()
  const pageCodeFailed = error instanceof Error && PAGE_CODE_FAILED.test(error.message)

  useEffect(() => {
    console.error('[route error]', error)
    // After a release the old page files are gone; one reload a minute fetches the new ones without looping.
    if (!pageCodeFailed || !navigator.onLine || Date.now() - readReloadedAt() < 60_000) return
    try {
      sessionStorage.setItem(RELOADED_AT_KEY, String(Date.now()))
    } catch {
      return
    }
    reloadPage.now()
  }, [error, pageCodeFailed])

  const feedback = (
    <ActionFeedback
      status="error"
      message={pageCodeFailed
        ? 'Could not load this screen. Check your connection and try again.'
        : 'Something went wrong on this screen. Try again.'}
      onRetry={() => reloadPage.now()}
    />
  )
  if (!framed) return feedback
  return (
    <div className="page-shell flex items-center justify-center">
      <div className="page-container max-w-lg">{feedback}</div>
    </div>
  )
}
