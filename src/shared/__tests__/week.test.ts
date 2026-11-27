import { describe, expect, it } from 'vitest'
import { workoutToday } from '../week'

describe('workoutToday', () => {
  it('finds the newest workout started earlier the same local day and nothing from yesterday', () => {
    const now = new Date(2026, 10, 27, 20, 0)
    const morning = { id: 'today', startedAt: new Date(2026, 10, 27, 7, 30).getTime() }
    const lastNight = { id: 'yesterday', startedAt: new Date(2026, 10, 26, 23, 50).getTime() }
    expect(workoutToday([morning, lastNight], now)?.id).toBe('today')
    expect(workoutToday([lastNight], now)).toBeNull()
  })
})
