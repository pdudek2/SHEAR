import { describe, expect, it } from 'vitest'
import { picksForDay, togglePick, type ExercisePick } from '../exercisePicks'

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
    expect(picksForDay(day, [row, pullUp, curl], 20)).toEqual({ added: [row, curl], skipped: 1 })
    expect(picksForDay(day, [row, curl], 2)).toEqual({ added: [row], skipped: 1 })
  })
})
