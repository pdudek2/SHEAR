import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
}))

import { setDoc, updateDoc } from 'firebase/firestore'
import { PROFILE_SAVE_TIMEOUT_MS, saveProfile, updateProfile } from '../userProfile'

describe('profile saves', () => {
  afterEach(() => { vi.useRealTimers() })

  it('stop waiting for a write the server never confirms, so the button does not spin for good', async () => {
    vi.useFakeTimers()
    vi.mocked(updateDoc).mockReturnValue(new Promise(() => undefined))
    vi.mocked(setDoc).mockReturnValue(new Promise(() => undefined))

    const update = expect(updateProfile('user-1', { displayName: 'Alex' })).rejects.toThrow()
    const save = expect(saveProfile('user-1', { displayName: 'Alex', weeklyGoal: 3, primaryGoal: 'strength', units: 'kg', createdAt: 1 })).rejects.toThrow()
    await vi.advanceTimersByTimeAsync(PROFILE_SAVE_TIMEOUT_MS)
    await update
    await save

    vi.mocked(updateDoc).mockResolvedValue(undefined)
    await expect(updateProfile('user-1', { displayName: 'Alex' })).resolves.toBeUndefined()
  })
})
