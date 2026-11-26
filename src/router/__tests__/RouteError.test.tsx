import { fireEvent, render, screen } from '@testing-library/react'
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

  it.each([
    'Importing a module script failed.',
    'error loading dynamically imported module: http://localhost/assets/HistoryPage-abc12345.js',
    'Unable to preload CSS for /assets/HistoryPage-abc12345.css',
    "'text/html' is not a valid JavaScript MIME type.",
  ])('treats "%s" as page code that could not load', (message) => {
    renderFailure(message)
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load this screen.')
    expect(reload).toHaveBeenCalledOnce()
  })

  it('a manual retry counts as the reload of the minute', () => {
    const first = renderFailure('Cannot read properties of undefined')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(reload).toHaveBeenCalledOnce()
    first.unmount()

    renderFailure(PAGE_CODE)
    expect(reload).toHaveBeenCalledOnce()
  })

  it('does not reload on its own when the time of the last reload cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    renderFailure(PAGE_CODE)
    expect(reload).not.toHaveBeenCalled()
  })

  it('does not reload while offline, on its own or from the button', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    renderFailure(PAGE_CODE)
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load this screen.')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Still offline. Try again once you are connected.')
    expect(reload).not.toHaveBeenCalled()
  })

  it('shows a general message and does not reload for other errors', () => {
    renderFailure('Cannot read properties of undefined')
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong on this screen. Try again.')
    expect(reload).not.toHaveBeenCalled()
  })
})
