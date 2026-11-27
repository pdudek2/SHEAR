import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from './authStore'
import { useDashboardStore } from './dashboardStore'
import type { WorkoutSummary } from '../lib/workoutService'

const workout = (id: string, sets: number) => ({ id, startedAt: 1, exercises: [{ sets: Array.from({ length: sets }, () => ({ weight: 60, reps: 8 })) }] }) as unknown as WorkoutSummary

describe('dashboard snapshot after an edit or delete elsewhere', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { uid: 'u1' } } as never)
    useDashboardStore.getState().clearSnapshot()
    useDashboardStore.getState().setSnapshot('u1', { workouts: [workout('a', 3), workout('b', 2)], weeklyDone: 2, streak: 1 })
  })

  it('replaces an edited workout and drops a deleted one, only for the snapshot owner', () => {
    useDashboardStore.getState().patchWorkout('u1', 'a', workout('a', 1))
    expect(useDashboardStore.getState().workouts.map((item) => [item.id, item.exercises[0]!.sets.length])).toEqual([['a', 1], ['b', 2]])
    useDashboardStore.getState().patchWorkout('u2', 'b', null)
    expect(useDashboardStore.getState().workouts).toHaveLength(2)
    useDashboardStore.getState().patchWorkout('u1', 'a', null)
    expect(useDashboardStore.getState().workouts.map((item) => item.id)).toEqual(['b'])
  })
})
