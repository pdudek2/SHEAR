import { useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomSheet from './BottomSheet'
import { useAuthStore } from '../store/authStore'
import { useProfileStore } from '../store/profileStore'
import { useUserExercises } from '../hooks/useUserExercises'
import { importPlanText } from '../shared/planImport'

const EXAMPLE = 'Example:\nUpper\nBench press 4x8 60 kg\nPull-up 3x8\n\nLower\nSquat 3x5 @80'

// `returnTo` is where the editor goes after saving; from Train it is Train, from the plan list the list.
export default function PastePlanSheet({ onClose, returnTo }: { onClose: () => void; returnTo?: string }) {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { state } = useUserExercises(user?.uid ?? null)
  const units = useProfileStore((store) => store.profile?.units)
  const [text, setText] = useState('')
  const [error, setError] = useState(false)
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  const helpId = useId()
  const errorId = useId()
  // Own exercises match before the catalogue, so wait for them unless they failed to load; a bare weight needs the units.
  const loading = state.status === 'loading' || !units

  function handleContinue() {
    const userExercises = state.status === 'success'
      ? state.data.map((exercise) => ({ exerciseId: exercise.id, exerciseSource: 'user' as const, name: exercise.name, muscles: exercise.muscles }))
      : []
    const pasted = importPlanText(text, userExercises, units)
    if (!pasted) {
      setError(true)
      fieldRef.current?.focus()
      return
    }
    navigate('/templates/new', { state: { pasted, ...(returnTo ? { returnTo } : {}) } })
  }

  return (
    <BottomSheet title="Paste a plan" onClose={onClose} initialFocusRef={fieldRef}>
      <p id={helpId} className="paste-plan-help">
        Day names on their own line, then one exercise per line. Sets, reps and weight are optional. You check the result before saving.
      </p>
      <textarea
        ref={fieldRef}
        className="template-text-input paste-plan-field"
        aria-label="Plan text"
        aria-describedby={error ? `${helpId} ${errorId}` : helpId}
        aria-invalid={error ? true : undefined}
        placeholder={EXAMPLE}
        value={text}
        maxLength={20000}
        onChange={(event) => {
          setText(event.target.value)
          if (error) setError(false)
        }}
      />
      {error && (
        <div id={errorId} role="alert" className="paste-plan-error">
          <p>No exercises found. Write one exercise per line, like “Bench press 4x8 60 kg”, or build the plan by hand.</p>
          <button
            type="button"
            className="paste-plan-manual"
            onClick={() => navigate('/templates/new', returnTo ? { state: { returnTo } } : undefined)}
          >
            Build it by hand
          </button>
        </div>
      )}
      <button
        type="button"
        className="planner-primary-action paste-plan-continue disabled:opacity-60"
        disabled={!text.trim() || loading}
        onClick={handleContinue}
      >
        {loading ? 'Loading your exercises…' : 'Continue'}
      </button>
    </BottomSheet>
  )
}
