import { useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Check, Search, X } from 'lucide-react'
import { exercises as exerciseDb, rankByQuery, searchExercises, type Category, type Exercise } from '../data/exercises'
import type { ExerciseSource } from '../store/workoutStore'
import { EXERCISE_CATEGORY_LABELS, getEquipmentLabel } from '../lib/exerciseLabels'
import type { RecentExercisePick } from '../shared/recentExercises'
import type { ExerciseRef } from '../shared/exerciseMatch'
import { togglePick, type ExercisePick } from '../shared/exercisePicks'
import type { DataState } from '../types/dataState'
import { ActionFeedback } from './ActionFeedback'
import BottomSheet from './BottomSheet'

const CATEGORIES: { value: Category | 'all'; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'chest',     label: 'Chest' },
  { value: 'back',      label: 'Back' },
  { value: 'legs',      label: 'Legs' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'arms',      label: 'Arms' },
  { value: 'core',      label: 'Core' },
  { value: 'cardio',    label: 'Cardio' },
]

type SearchResult = Exercise & { source: ExerciseSource }

interface Props {
  open: boolean
  onSelect: (exerciseId: string, name: string, source: ExerciseSource) => void
  onClose: () => void
  userExercisesState: DataState<Exercise[]>
  onRetryUserExercises: () => void
  recent?: RecentExercisePick[]
  // Closest matches for a pasted line, listed first.
  suggestions?: ExerciseRef[]
  title?: string
  // With it, taps tick exercises and one button adds them all, in tap order.
  onSelectMany?: (picks: ExercisePick[]) => void
}

function ResultRow({ exercise, onSelect, picked }: { exercise: SearchResult; onSelect: Props['onSelect']; picked?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(exercise.id, exercise.name, exercise.source)}
      className="exercise-picker-result"
      data-source={exercise.source}
      aria-pressed={picked}
    >
      {picked !== undefined && <i className="exercise-picker-check" aria-hidden="true">{picked && <Check size={14} strokeWidth={3} />}</i>}
      <span>{exercise.name}</span>
      {exercise.source === 'user' && <em>mine</em>}
      <small>{[EXERCISE_CATEGORY_LABELS[exercise.category], getEquipmentLabel(exercise.equipment)].filter(Boolean).join(' · ')}</small>
    </button>
  )
}

function PickerBody({ onSelect: selectOne, onSelectMany, onClose: close, userExercisesState, onRetryUserExercises, recent = [], suggestions = [], title = onSelectMany ? 'Add exercises' : 'Add exercise' }: Omit<Props, 'open'>) {
  const [picks, setPicks] = useState<ExercisePick[]>([])
  // Reopened during its exit animation the sheet keeps its state, so picks must not outlive a close.
  const onClose = () => {
    setPicks([])
    close()
  }
  const onSelect: Props['onSelect'] = onSelectMany
    ? (exerciseId, name, source) => setPicks((current) => togglePick(current, { exerciseId, name, source }))
    : selectOne
  const picked = (exercise: SearchResult) => onSelectMany ? picks.some((pick) => pick.exerciseId === exercise.id && pick.source === exercise.source) : undefined
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category | 'all'>('all')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  // On a phone the keyboard would cover the list before anything is chosen.
  const touch = window.matchMedia?.('(hover: none)').matches

  const globalResults: SearchResult[] = searchExercises(query, category === 'all' ? undefined : category)
    .map((ex) => ({ ...ex, source: 'global' as const }))

  const userExercises = userExercisesState.status === 'success'
    ? userExercisesState.data
    : []
  const userResults: SearchResult[] = rankByQuery(userExercises.filter((ex) => category === 'all' || ex.category === category), query)
    .map((ex) => ({ ...ex, source: 'user' as const }))

  const results = [...userResults, ...globalResults]
  const filtered = query.trim() !== '' || category !== 'all'
  const recentResults: SearchResult[] = filtered ? [] : recent.flatMap((pick) => {
    const exercise = (pick.source === 'user' ? userExercises : exerciseDb).find(({ id }) => id === pick.id)
    return exercise ? [{ ...exercise, name: pick.name, source: pick.source }] : []
  })

  const suggestedResults: SearchResult[] = filtered ? [] : suggestions.flatMap((ref) => {
    const exercise = (ref.exerciseSource === 'user' ? userExercises : exerciseDb).find(({ id }) => id === ref.exerciseId)
    return exercise ? [{ ...exercise, source: ref.exerciseSource }] : []
  })

  return (
    <BottomSheet title={title} tall onClose={onClose} initialFocusRef={touch ? undefined : searchInputRef}>
      <div className="exercise-picker-search">
        <Search size={16} aria-hidden="true" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search exercises"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search exercises"
        />
        {query && (
          <button
            type="button"
            className="exercise-picker-clear"
            aria-label="Clear search"
            onClick={() => {
              setQuery('')
              searchInputRef.current?.focus()
            }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="exercise-picker-categories no-scrollbar" role="group" aria-label="Exercise category">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => {
              setCategory(c.value)
              scrollRef.current?.scrollTo?.({ top: 0 })
            }}
            aria-pressed={category === c.value}
            className="exercise-picker-category"
          >
            {c.label}
          </button>
        ))}
      </div>

      <div ref={scrollRef} className="exercise-picker-scroll">
        {userExercisesState.status === 'loading' && (
          <ActionFeedback status="pending" message="Loading your exercises…" />
        )}
        {userExercisesState.status === 'error' && (
          <ActionFeedback
            status="error"
            message="Could not load your exercises. The shared library is still available."
            onRetry={onRetryUserExercises}
          />
        )}
        {suggestedResults.length > 0 && (
          <>
            <p className="exercise-picker-group">Closest matches</p>
            {suggestedResults.map((exercise) => (
              <ResultRow key={`suggested-${exercise.source}-${exercise.id}`} exercise={exercise} onSelect={onSelect} picked={picked(exercise)} />
            ))}
          </>
        )}
        {recentResults.length > 0 && (
          <>
            <p className="exercise-picker-group">Recently used</p>
            {recentResults.map((exercise) => (
              <ResultRow key={`recent-${exercise.source}-${exercise.id}`} exercise={exercise} onSelect={onSelect} picked={picked(exercise)} />
            ))}
          </>
        )}
        {results.length > 0 ? (
          <>
            <p className="exercise-picker-group">{filtered ? `${results.length} found` : 'All exercises'}</p>
            {results.map((exercise) => (
              <ResultRow key={`${exercise.source}-${exercise.id}`} exercise={exercise} onSelect={onSelect} picked={picked(exercise)} />
            ))}
          </>
        ) : userExercisesState.status === 'success' ? (
          <div className="exercise-picker-empty">
            <strong>No results</strong>
            <p>{category === 'all' ? 'Try a shorter name, like “curl”, or clear the search.' : 'Change your search or choose All.'}</p>
          </div>
        ) : null}
      </div>
      {onSelectMany && picks.length > 0 && (
        <button type="button" className="planner-primary-action exercise-picker-add" onClick={() => {
          setPicks([])
          onSelectMany(picks)
        }}>
          Add {picks.length} {picks.length === 1 ? 'exercise' : 'exercises'}
        </button>
      )}
    </BottomSheet>
  )
}

export default function ExercisePicker({ open, ...props }: Props) {
  return <AnimatePresence>{open && <PickerBody key="exercise-picker" {...props} />}</AnimatePresence>
}
