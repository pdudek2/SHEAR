import { describe, expect, it } from 'vitest'
import { readWorkoutResult, savedWorkoutEntry } from '../savedWorkoutView'

const result = { workoutId: 'w-1', status: 'materialized' } as const

describe('readWorkoutResult', () => {
  it('is the saved view right after Finish and when this page load comes Back to the entry, not after a reload', () => {
    expect(readWorkoutResult({ workoutResult: result }, 'w-1')).toEqual(result)
    expect(readWorkoutResult(savedWorkoutEntry(result), 'w-1')).toEqual(result)
    expect(readWorkoutResult({ ...savedWorkoutEntry(result), savedWorkout: 'an-earlier-load' }, 'w-1')).toBeNull()
    expect(readWorkoutResult(savedWorkoutEntry(result), 'w-2')).toBeNull()
    expect(savedWorkoutEntry(result).from).toBe('train')
  })
})
