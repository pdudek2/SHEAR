import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reloadPage } from '../../lib/pageReload'
import { RouteError } from '../RouteError'

function Broken({ message }: { message: string }): never {
  throw new Error(message)
}

function renderFailure(message: string) {
  const router = createMemoryRouter([
    { path: '/', element: <Broken message={message} />, errorElement: <RouteError /> },
  ])
  return render(<RouterProvider router={router} />)
}

const PAGE_CODE = 'Failed to fetch dynamically imported module: http://localhost/assets/HistoryPage-abc12345.js'

describe('RouteError', () => {
  let reload: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    sessionStorage.clear()
    reload = vi.spyOn(reloadPage, 'now').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('replaces the developer screen with a retry when page code cannot load, and reloads once a minute at most', () => {
    const first = renderFailure(PAGE_CODE)
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load this screen. Check your connection and try again.')
    expect(screen.queryByText(/Unexpected Application Error/)).not.toBeInTheDocument()
    expect(reload).toHaveBeenCalledOnce()
    first.unmount()

    renderFailure(PAGE_CODE)
    expect(reload).toHaveBeenCalledOnce()
    screen.getByRole('button', { name: 'Try again' }).click()
    expect(reload).toHaveBeenCalledTimes(2)
  })

  it('does not reload on its own while offline', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    renderFailure(PAGE_CODE)
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load this screen.')
    expect(reload).not.toHaveBeenCalled()
  })

  it('shows a general message and does not reload for other errors', () => {
    renderFailure('Cannot read properties of undefined')
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong on this screen. Try again.')
    expect(reload).not.toHaveBeenCalled()
  })
})
