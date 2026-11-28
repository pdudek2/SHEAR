import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import BottomNav from '../BottomNav'
import { pageLoadId } from '../../lib/pageReload'
import MobileInteractionProvider from '../MobileInteractionProvider'

const renderAt = (entry: Parameters<typeof MemoryRouter>[0]['initialEntries']) => render(
  <MemoryRouter initialEntries={entry}>
    <MobileInteractionProvider>
      <BottomNav />
    </MobileInteractionProvider>
  </MemoryRouter>,
)

describe('BottomNav on a workout page', () => {
  it('stays on the page that follows Finish, with Train as its tab', () => {
    renderAt([{ pathname: '/workout/saved-1', state: { savedWorkout: pageLoadId } }])
    expect(screen.getByRole('navigation', { name: 'Bottom navigation' })).not.toHaveAttribute('aria-hidden')
    expect(screen.getByRole('button', { name: 'Train' })).toHaveAttribute('aria-current', 'page')
  })

  it('follows the plain workout page after a reload, which drops the saved view', () => {
    const { container } = renderAt([{ pathname: '/workout/saved-1', state: { savedWorkout: 'an-earlier-page-load' } }])
    expect(container.querySelector('nav')).toHaveAttribute('aria-hidden', 'true')
  })

  it('stays hidden on a workout opened from History', () => {
    const { container } = renderAt(['/workout/saved-1'])
    expect(container.querySelector('nav')).toHaveAttribute('aria-hidden', 'true')
  })
})
