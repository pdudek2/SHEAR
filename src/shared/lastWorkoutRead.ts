import { workoutTitle } from '../lib/workoutCopy'
import { bestSet } from './workoutDisplay'
import { workoutVolume } from './progress'
import { formatCompactVolume, kgToDisplayWeight, type WeightUnits } from './weightUnits'

interface ReadWorkout {
  label?: string | null
  startedAt: number
  exercises: { exerciseId?: string; exerciseSource?: 'global' | 'user'; name: string; sets: { weight: number; reps: number }[] }[]
}

export function lastWorkoutRead(workout: ReadWorkout, units: WeightUnits) {
  const started = new Date(workout.startedAt)
  const day = `${started.toLocaleDateString('en-US', { weekday: 'short' })} ${started.getDate()}`
  const sets = workout.exercises.flatMap(({ name, sets: exerciseSets }) => exerciseSets.map((set) => ({ ...set, name })))
  const top = bestSet(sets)
  const volume = workoutVolume(workout.exercises)
  return {
    eyebrow: `Last workout · ${workoutTitle(workout)}, ${day}`,
    title: top ? `${top.name}: ${kgToDisplayWeight(top.weight, units)} ${units} × ${top.reps}` : workoutTitle(workout),
    body: `${sets.length} ${sets.length === 1 ? 'set' : 'sets'} across ${workout.exercises.length} ${workout.exercises.length === 1 ? 'exercise' : 'exercises'}, ${formatCompactVolume(volume, units)} in total.`,
  }
}
