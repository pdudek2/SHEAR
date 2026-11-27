import { describe, expect, it } from 'vitest'
import { picksForDay, skippedPicksMessage, togglePick, type ExercisePick } from '../exercisePicks'

const row: ExercisePick = { exerciseId: 'barbell-row', name: 'Barbell Row', source: 'global' }
const pullUp: ExercisePick = { exerciseId: 'pull-up', name: 'Pull-up', source: 'global' }
const curl: ExercisePick = { exerciseId: 'curl', name: 'My curl', source: 'user' }

describe('exercise picks for a plan day', () => {
  it('keeps tap order and takes a second tap back out', () => {
    let picks = togglePick([], row)
    picks = togglePick(picks, pullUp)
    picks = togglePick(picks, curl)
    picks = togglePick(picks, pullUp)
    expect(picks.map(({ exerciseId }) => exerciseId)).toEqual(['barbell-row', 'curl'])
    expect(togglePick(picks, { ...curl, source: 'global' })).toHaveLength(3)
  })

  it('adds in tap order, skips what the day holds and stops at the day limit', () => {
    const day = [{ exerciseId: 'pull-up', exerciseSource: 'global' as const }]
    expect(picksForDay(day, [row, pullUp, curl], 20)).toEqual({ added: [row, curl], duplicates: 1, overLimit: 0 })
    expect(picksForDay(day, [row, curl], 2)).toEqual({ added: [row], duplicates: 0, overLimit: 1 })
  })

  it('names why picks were left out', () => {
    const day = [{ exerciseId: 'pull-up', exerciseSource: 'global' as const }]
    const full = Array.from({ length: 20 }, (_, index) => ({ exerciseId: `e${index}`, exerciseSource: 'global' as const }))
    expect(skippedPicksMessage(picksForDay(day, [row], 20), 20)).toBeNull()
    expect(skippedPicksMessage(picksForDay(day, [pullUp], 20), 20)).toBe('These exercises are already in this day.')
    expect(skippedPicksMessage(picksForDay(day, [pullUp, row], 20), 20)).toBe('Some exercises were already in this day.')
    expect(skippedPicksMessage(picksForDay(full, [row], 20), 20)).toBe('A day holds up to 20 exercises.')
    expect(skippedPicksMessage(picksForDay([...full.slice(1), day[0]!], [pullUp, row, curl], 20), 20)).toBe('Some exercises were already in this day or over its limit.')
  })
})
