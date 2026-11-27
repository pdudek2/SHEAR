import { create } from 'zustand'
import { useAuthStore } from './authStore'
import type { WorkoutSummary } from '../lib/workoutService'
import type { WorkoutTemplate } from '../lib/templateService'

interface DashboardSnapshot {
  workouts: WorkoutSummary[]
  weeklyDone: number
  streak: number
}

interface DashboardState extends DashboardSnapshot {
  uid: string | null
  ready: boolean
  plans: { uid: string; templates: WorkoutTemplate[] } | null
  setSnapshot: (uid: string, snapshot: DashboardSnapshot) => boolean
  setPlans: (uid: string, templates: WorkoutTemplate[]) => void
  // An edit or delete elsewhere replaces or drops the workout, so Train does not show it stale until its reread.
  patchWorkout: (uid: string, workoutId: string, next: WorkoutSummary | null) => void
  clearSnapshot: () => void
}

export const useDashboardStore = create<DashboardState>((set) => ({
  workouts: [],
  weeklyDone: 0,
  streak: 0,
  uid: null,
  ready: false,
  plans: null,
  setSnapshot: (uid, snapshot) => {
    if (useAuthStore.getState().user?.uid !== uid) return false
    set({ ...snapshot, uid, ready: true })
    return true
  },
  setPlans: (uid, templates) => {
    if (useAuthStore.getState().user?.uid === uid) set({ plans: { uid, templates } })
  },
  patchWorkout: (uid, workoutId, next) => set((state) => state.uid !== uid ? state : {
    workouts: next
      ? state.workouts.map((workout) => workout.id === workoutId ? next : workout)
      : state.workouts.filter((workout) => workout.id !== workoutId),
  }),
  clearSnapshot: () => set({
    plans: null,
    uid: null,
    workouts: [],
    weeklyDone: 0,
    streak: 0,
    ready: false,
  }),
}))
