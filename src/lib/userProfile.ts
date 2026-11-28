import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'

export type PrimaryGoal = 'strength' | 'hypertrophy' | 'endurance' | 'weight_loss'
export type Units = 'kg' | 'lbs'

export interface UserProfile {
  displayName: string
  weeklyGoal: number
  primaryGoal: PrimaryGoal
  units: Units
  createdAt: number
}

export async function getProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? (snap.data() as UserProfile) : null
}

// Firestore keeps an unconfirmed write queued and resolves only when the server answers, so a save without a
// working connection would spin for good. Past this the write still lands later; the user is told to retry.
export const PROFILE_SAVE_TIMEOUT_MS = 15_000

// The write is still queued and lands once the connection answers; only the confirmation is missing.
export class ProfileSaveNotConfirmedError extends Error {
  constructor() {
    super('Profile save not confirmed yet.')
    this.name = 'ProfileSaveNotConfirmedError'
  }
}

async function bounded(write: Promise<void>): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([write, new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new ProfileSaveNotConfirmedError()), PROFILE_SAVE_TIMEOUT_MS)
    })])
  } finally {
    clearTimeout(timeout)
  }
}

export async function saveProfile(uid: string, profile: UserProfile): Promise<void> {
  await bounded(setDoc(doc(db, 'users', uid), profile))
}

export async function updateProfile(
  uid: string,
  data: Partial<Omit<UserProfile, 'createdAt'>>
): Promise<void> {
  await bounded(updateDoc(doc(db, 'users', uid), data))
}
