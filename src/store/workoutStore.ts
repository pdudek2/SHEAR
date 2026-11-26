import { create } from 'zustand'
import { createSessionId } from '../lib/sessionIdentity'
import { clampSetValue, isValidCompletedSet, MAX_DONE_SETS_PER_EXERCISE, MAX_SESSION_EXERCISES } from '../shared/workoutLimits'
import { applyOverload, carryLoggedWeight, correctionFollowers, moveFollowers, sessionRoles } from '../shared/nextSessionRecommendation'
import { latestLoggedAt, reconcileRest, resumedRest, type RestCheck } from '../shared/workoutDisplay'
import type { CompressionProposal, CompressionRecord } from '../shared/compressionRecord'
import { cutRest } from '../shared/sessionCut'
import type { CutChoice } from '../shared/sessionCut'
import type { ExerciseMeta } from '../shared/nextSessionRecommendation'

export type ExerciseSource = 'global' | 'user'

export interface WorkoutSet {
  clientId?: string
  weight: string
  reps: string
  done: boolean
  // Device time the set was marked done; present only while it is done.
  completedAt?: number
}

export interface WorkoutExercise {
  clientId?: string
  exerciseId: string
  exerciseSource: ExerciseSource
  name: string
  sets: WorkoutSet[]
  // Pair or circuit of a compressed day.
  group?: string
}

export interface ActiveWorkout {
  sessionId: string
  startedAt: number
  templateId?: string | null
  planDayId?: string | null
  label?: string
  exercises: WorkoutExercise[]
  compression?: CompressionRecord | null
  proposals?: CompressionProposal[] | null
}

export interface RestTimerState {
  startedAt: number
  totalSec: number
}

interface WorkoutState {
  active: ActiveWorkout | null
  restTimer: RestTimerState | null
  // The newest logged set already checked for a rest to bring back, as on Android.
  restChecked: RestCheck | null
  // The user's own exercises, so a rest brought back lasts as long as the one the page started.
  exerciseMeta: ReadonlyMap<string, ExerciseMeta> | null
  // The logged set whose weight is being corrected and the open sets that follow it, chosen when the correction started.
  weightCorrection: { sessionId: string; setId: string; followers: string[] } | null
  setExerciseMeta: (meta: ReadonlyMap<string, ExerciseMeta>) => void
  startWorkout: () => void
  hydrateFromDoc: (workout: ActiveWorkout) => void
  startRestTimer: (totalSec: number, startedAt?: number) => void
  addRestTimerSeconds: (deltaSec: number) => void
  clearRestTimer: () => void
  setLabel: (label: string) => void
  addExercise: (exerciseId: string, name: string, source: ExerciseSource) => void
  addSet: (exerciseIndex: number) => void
  removeSet: (exerciseIndex: number, setIndex: number) => void
  updateSet: (exerciseIndex: number, setIndex: number, field: 'weight' | 'reps', value: string) => void
  applyOverload: (exerciseIndex: number, values: { weight?: number; reps?: number }) => void
  adjustSet: (exerciseIndex: number, setIndex: number, field: 'weight' | 'reps', delta: number) => void
  toggleSetDone: (exerciseIndex: number, setIndex: number) => void
  removeExercise: (exerciseIndex: number) => void
  cutRest: (choice: CutChoice, now: number, userExercises: ReadonlyMap<string, ExerciseMeta>) => void
  clearWorkout: () => void
}

let clientIdCounter = 0

function createClientId(prefix: 'exercise' | 'set'): string {
  clientIdCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${clientIdCounter.toString(36)}`
}

function settleDone<T extends WorkoutSet>(set: T, done: boolean): T {
  if (done) return { ...set, done }
  const rest = { ...set }
  delete rest.completedAt
  return { ...rest, done }
}

const emptySet = (): WorkoutSet => ({ clientId: createClientId('set'), weight: '', reps: '', done: false })

// Rows of the same session keep their ids (matched by position and exercise), so a save from another device does not
// remount them and drop the focused input.
function withClientIds(workout: ActiveWorkout, previous?: ActiveWorkout | null): ActiveWorkout {
  const sameSession = previous?.sessionId === workout.sessionId ? previous : null
  return {
    ...workout,
    exercises: workout.exercises.map((exercise, exerciseIndex) => {
      const before = sameSession?.exercises[exerciseIndex]
      const kept = before?.exerciseId === exercise.exerciseId && before.exerciseSource === exercise.exerciseSource ? before : null
      return {
        ...exercise,
        clientId: exercise.clientId ?? kept?.clientId ?? createClientId('exercise'),
        sets: exercise.sets.map((set, setIndex) => settleDone({
          ...set,
          clientId: set.clientId ?? kept?.sets[setIndex]?.clientId ?? createClientId('set'),
        }, set.done && isValidCompletedSet(set))),
      }
    }),
  }
}

export function stripWorkoutClientIds(workout: ActiveWorkout): ActiveWorkout {
  return {
    ...workout,
    exercises: workout.exercises.map((exercise) => ({
      exerciseId: exercise.exerciseId,
      exerciseSource: exercise.exerciseSource,
      name: exercise.name,
      ...(exercise.group === undefined ? {} : { group: exercise.group }),
      sets: exercise.sets.map((set) => ({
        weight: set.weight,
        reps: set.reps,
        done: set.done,
        ...(set.completedAt === undefined ? {} : { completedAt: set.completedAt }),
      })),
    })),
  }
}

function parseSetNumber(value: string, field: 'weight' | 'reps'): number {
  const parsed = field === 'weight'
    ? Number.parseFloat(value)
    : Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : 0
}

// Weights keep the four decimals a lbs value needs in kg (2.5 lbs = 1.1340 kg), as native and typed input do.
function formatAdjustedSetValue(value: number, field: 'weight' | 'reps'): string {
  return String(field === 'weight' ? Math.round(value * 10_000) / 10_000 : Math.round(value))
}

// One edit of a set's weight or reps; a weight correction of a logged set moves the open sets it chose when it started.
function editSet(s: WorkoutState, exerciseIndex: number, setIndex: number, field: 'weight' | 'reps', edit: (set: WorkoutSet) => WorkoutSet): Partial<WorkoutState> | WorkoutState {
  const exercise = s.active?.exercises[exerciseIndex]
  const target = exercise?.sets[setIndex]
  if (!s.active || !exercise || !target) return s
  const sameCorrection = s.weightCorrection?.sessionId === s.active.sessionId && s.weightCorrection.setId === target.clientId
  const correction = field !== 'weight' ? s.weightCorrection
    : sameCorrection ? s.weightCorrection
      : { sessionId: s.active.sessionId, setId: target.clientId ?? '', followers: correctionFollowers(exercise.sets, setIndex) }
  const edited = exercise.sets.map((st, si) => {
    if (si !== setIndex) return st
    const next = edit(st)
    return settleDone(next, next.done && isValidCompletedSet(next))
  })
  const sets = field === 'weight' ? moveFollowers(edited, setIndex, correction!.followers) : edited
  const exercises = s.active.exercises.map((ex, i) => (i === exerciseIndex ? { ...ex, sets } : ex))
  return { active: { ...s.active, exercises }, weightCorrection: correction }
}

// The rest a set or exercise added after the last open set brings back; a running rest stays as it is.
function restAfterAdding(s: WorkoutState): RestTimerState | null {
  if (!s.active || s.restTimer) return s.restTimer
  return resumedRest(s.active.exercises, sessionRoles(s.active.exercises, s.exerciseMeta ?? undefined), s.active.compression?.shortRest === true, Date.now())
}

export const useWorkoutStore = create<WorkoutState>()((set) => ({
  active: null,
  restTimer: null,
  restChecked: null,
  exerciseMeta: null,
  weightCorrection: null,

  startWorkout: () =>
    set({ active: { sessionId: createSessionId(), startedAt: Date.now(), templateId: null, planDayId: null, exercises: [] }, restTimer: null, restChecked: null, weightCorrection: null }),

  // A reload or another device's log brings back the rest still running after the newest logged set.
  hydrateFromDoc: (workout) =>
    set((state) => {
      const active = withClientIds(workout, state.active)
      const current = state.active?.sessionId === active.sessionId && state.restTimer ? { sessionId: active.sessionId, ...state.restTimer } : null
      const roles = sessionRoles(active.exercises, state.exerciseMeta ?? undefined)
      const next = reconcileRest(current, state.restChecked, active, roles, active.compression?.shortRest === true, Date.now())
      return {
        active,
        restTimer: next.rest === current ? (current && state.restTimer) : next.rest && { startedAt: next.rest.startedAt, totalSec: next.rest.totalSec },
        restChecked: next.checked,
      }
    }),

  setExerciseMeta: (meta) => set({ exerciseMeta: meta }),

  startRestTimer: (totalSec, startedAt = Date.now()) =>
    set({ restTimer: { startedAt, totalSec } }),

  addRestTimerSeconds: (deltaSec) =>
    set((state) => ({
      restTimer: state.restTimer
        ? { ...state.restTimer, totalSec: state.restTimer.totalSec + deltaSec }
        : null,
    })),

  // A skipped rest stays skipped when the same session arrives again.
  clearRestTimer: () =>
    set((state) => ({
      restTimer: null,
      restChecked: state.active
        ? { sessionId: state.active.sessionId, at: Math.max(latestLoggedAt(state.active.exercises), state.restChecked?.sessionId === state.active.sessionId ? state.restChecked.at : 0) }
        : state.restChecked,
    })),

  setLabel: (label) =>
    set((s) => s.active ? { active: { ...s.active, label } } : s),

  addExercise: (exerciseId, name, source) =>
    set((s) => {
      if (!s.active || s.active.exercises.length >= MAX_SESSION_EXERCISES) return s
      return {
        active: {
          ...s.active,
          exercises: [...s.active.exercises, { clientId: createClientId('exercise'), exerciseId, exerciseSource: source, name, sets: [emptySet()] }],
        },
        restTimer: restAfterAdding(s),
      }
    }),

  addSet: (exerciseIndex) =>
    set((s) => {
      if (!s.active) return s
      const exercises = s.active.exercises.map((ex, i) => {
        if (i !== exerciseIndex) return ex
        const lastSet = ex.sets.length > 0 ? ex.sets[ex.sets.length - 1] : null
        const newSet: WorkoutSet = lastSet && (lastSet.weight || lastSet.reps)
          ? { clientId: createClientId('set'), weight: lastSet.weight, reps: lastSet.reps, done: false }
          : emptySet()
        return { ...ex, sets: [...ex.sets, newSet] }
      })
      return { active: { ...s.active, exercises }, restTimer: exerciseIndex < s.active.exercises.length ? restAfterAdding(s) : s.restTimer }
    }),

  removeSet: (exerciseIndex, setIndex) =>
    set((s) => {
      if (!s.active) return s
      const exercises = s.active.exercises.map((ex, i) =>
        i === exerciseIndex
          ? { ...ex, sets: ex.sets.filter((_, si) => si !== setIndex) }
          : ex
      )
      return { active: { ...s.active, exercises } }
    }),

  updateSet: (exerciseIndex, setIndex, field, value) =>
    set((s) => editSet(s, exerciseIndex, setIndex, field, (st) => ({ ...st, [field]: value }))),

  applyOverload: (exerciseIndex, values) =>
    set((s) => {
      if (!s.active) return s
      const exercises = s.active.exercises.map((ex, i) =>
        i === exerciseIndex ? { ...ex, sets: applyOverload(ex.sets, values) } : ex
      )
      return { active: { ...s.active, exercises } }
    }),

  adjustSet: (exerciseIndex, setIndex, field, delta) =>
    set((s) => editSet(s, exerciseIndex, setIndex, field, (st) => (
      { ...st, [field]: formatAdjustedSetValue(clampSetValue(parseSetNumber(st[field], field) + delta, field), field) }
    ))),

  toggleSetDone: (exerciseIndex, setIndex) =>
    set((s) => {
      if (!s.active) return s
      const exercises = s.active.exercises.map((ex, i) => {
        if (i !== exerciseIndex) return ex
        const wasDone = ex.sets[setIndex]?.done
        const sets = ex.sets.map((st, si) => {
          if (si !== setIndex) return st
          if (st.done) return settleDone(st, false)
          const completed = ex.sets.filter((other) => other.done).length
          return completed < MAX_DONE_SETS_PER_EXERCISE && isValidCompletedSet(st) ? { ...st, done: true, completedAt: Date.now() } : st
        })
        return { ...ex, sets: wasDone || !sets[setIndex] ? sets : carryLoggedWeight(sets, sets[setIndex]) }
      })
      // The check follows the sets logged here as reconcileRest would, so the next snapshot does not restore their rest.
      const toggled = exercises[exerciseIndex]?.sets[setIndex]
      const checked = s.restChecked?.sessionId === s.active.sessionId ? s.restChecked.at : null
      const at = toggled?.done && toggled.completedAt !== undefined
        ? toggled.completedAt
        : Math.min(latestLoggedAt(exercises), checked ?? Infinity)
      return { active: { ...s.active, exercises }, restChecked: { sessionId: s.active.sessionId, at }, weightCorrection: null }
    }),

  removeExercise: (exerciseIndex) =>
    set((s) => {
      if (!s.active) return s
      return {
        active: {
          ...s.active,
          exercises: s.active.exercises.filter((_, i) => i !== exerciseIndex),
        },
      }
    }),

  cutRest: (choice, now, userExercises) => set((s) => (s.active ? { active: cutRest(s.active, choice, now, userExercises) } : s)),

  clearWorkout: () => set({ active: null, restTimer: null, restChecked: null, weightCorrection: null }),
}))
