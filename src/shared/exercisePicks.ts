export interface ExercisePick {
  exerciseId: string
  name: string
  source: 'global' | 'user'
}

const same = (a: ExercisePick, b: ExercisePick) => a.exerciseId === b.exerciseId && a.source === b.source

// A second tap on a picked exercise takes it back out; the order of the rest stays the order of the taps.
export function togglePick(picks: ExercisePick[], pick: ExercisePick): ExercisePick[] {
  return picks.some((item) => same(item, pick)) ? picks.filter((item) => !same(item, pick)) : [...picks, pick]
}

// Picks a plan day can take, in tap order: none it already holds, and no more than its exercise limit.
export function picksForDay(
  day: { exerciseId: string; exerciseSource: 'global' | 'user' }[],
  picks: ExercisePick[],
  limit: number,
): { added: ExercisePick[]; duplicates: number; overLimit: number } {
  const fresh = picks.filter((pick) => !day.some((row) => row.exerciseId === pick.exerciseId && row.exerciseSource === pick.source))
  const added = fresh.slice(0, Math.max(0, limit - day.length))
  return { added, duplicates: picks.length - fresh.length, overLimit: fresh.length - added.length }
}

// What to say about picks a day could not take, by cause.
export function skippedPicksMessage({ added, duplicates, overLimit }: ReturnType<typeof picksForDay>, limit: number): string | null {
  if (overLimit && duplicates) return 'Some exercises were already in this day or over its limit.'
  if (overLimit) return `A day holds up to ${limit} exercises.`
  if (duplicates) return added.length ? 'Some exercises were already in this day.' : 'These exercises are already in this day.'
  return null
}
