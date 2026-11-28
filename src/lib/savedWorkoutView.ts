import { pageLoadId } from './pageReload'

export interface WorkoutResultState {
  workoutId: string
  status: 'materialized' | 'projection_pending'
}

// The "Workout saved" view of a finished workout, read by the page and the tab bar alike. It holds for the page load
// that finished it: after a reload the same history entry shows the plain workout.
export function readWorkoutResult(state: unknown, workoutId: string | undefined): WorkoutResultState | null {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return null

  const { workoutResult: result, savedWorkout } = state as { workoutResult?: unknown; savedWorkout?: unknown }
  if (savedWorkout !== undefined && savedWorkout !== pageLoadId) return null
  if (!result || typeof result !== 'object' || Array.isArray(result)) return null

  const { workoutId: resultWorkoutId, status } = result as Record<string, unknown>
  if (
    typeof resultWorkoutId !== 'string'
    || resultWorkoutId !== workoutId
    || (status !== 'materialized' && status !== 'projection_pending')
  ) return null

  return { workoutId: resultWorkoutId, status }
}

// Marks the entry with this page load, so a reload of it is no longer the saved view; Back from it goes to Train.
export function savedWorkoutEntry(result: WorkoutResultState) {
  return { workoutResult: result, savedWorkout: pageLoadId, from: 'train' }
}
