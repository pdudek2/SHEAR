import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ExercisePicker from '../ExercisePicker'

describe('ExercisePicker with several picks', () => {
  it('ticks exercises across categories and adds them in tap order', () => {
    const onSelectMany = vi.fn()
    render(
      <ExercisePicker
        open
        onSelect={() => undefined}
        onSelectMany={onSelectMany}
        onClose={() => undefined}
        userExercisesState={{ status: 'success', data: [] }}
        onRetryUserExercises={() => undefined}
      />,
    )
    const dialog = screen.getByRole('dialog', { name: 'Add exercises' })
    expect(screen.queryByRole('button', { name: /^Add \d/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    fireEvent.click(screen.getByRole('button', { name: /^Pull-up/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Legs' }))
    fireEvent.click(screen.getByRole('button', { name: /^Squat/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    fireEvent.click(screen.getByRole('button', { name: /^Barbell Row/ }))
    expect(screen.getByRole('button', { name: /^Pull-up/ })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: /^Pull-up/ }))

    fireEvent.click(screen.getByRole('button', { name: 'Add 2 exercises' }))
    expect(onSelectMany).toHaveBeenCalledWith([
      expect.objectContaining({ exerciseId: 'squat', source: 'global' }),
      expect.objectContaining({ exerciseId: 'barbell-row', source: 'global' }),
    ])
    // A sheet reopened during its exit animation keeps its state, so the picks are cleared with the add.
    expect(dialog).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Add \d/ })).not.toBeInTheDocument()
  })
})
