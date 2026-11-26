import { deleteApp, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import type { APIRequestContext, Page } from '@playwright/test'
import { test, expect } from './fixtures'

const member = (exerciseId: string, name: string, weight: string, reps: string) => ({
  exerciseId, exerciseSource: 'global', name, group: 'g1',
  sets: [{ weight, reps, done: false }, { weight, reps, done: false }],
})

// A fresh account in a Leg Curl + Hip Abduction superset with the panel on 1A; Hip Abduction was 30 kg last time.
async function openPair(page: Page, request: APIRequestContext, hipWeight: string) {
  const email = `pair-${Date.now()}-${Math.round(Math.random() * 1e6)}@ironlog.local`
  const signUp = await request.post('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key', { data: { email, password: process.env.TEST_PASSWORD!, returnSecureToken: true } })
  expect(signUp.ok()).toBe(true)
  const uid = (await signUp.json()).localId as string
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(process.env.TEST_PASSWORD!)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/onboarding', { timeout: 20_000 })
  await page.getByLabel('Name').fill('Pair E2E')
  await page.getByRole('button', { name: 'Save profile' }).click()
  await page.waitForURL('/dashboard', { timeout: 20_000 })

  const app = initializeApp({ projectId: 'demo-ironlog' }, `pair-${uid}`)
  const db = getFirestore(app)
  const finishedAt = Date.now() - 3 * 86_400_000
  await db.doc(`exerciseSessions/${uid}_w1_hip-abduction`).set({
    userId: uid, workoutId: 'w1', exerciseId: 'hip-abduction', exerciseSource: 'global', exerciseName: 'Hip Abduction',
    startedAt: finishedAt - 3_600_000, finishedAt, sets: [{ weight: 30, reps: 12 }], totalSets: 1, totalReps: 12, totalVolume: 360, bestSetWeight: 30, bestSetReps: 12,
  })
  await db.doc(`activeSessions/${uid}`).set({
    userId: uid, sessionId: `pair-${uid}`, sessionRevision: 'pair-1', startedAt: Date.now() - 600_000, templateId: null, label: 'Legs',
    exercises: [member('leg-curl', 'Leg Curl', '40', '10'), member('hip-abduction', 'Hip Abduction', hipWeight, '12')], updatedAt: Date.now(),
  })

  await page.goto('/dashboard')
  await page.getByRole('button', { name: /^Resume / }).click()
  // B's suggestion comes from the same history as the slip check, so it shows the check is ready; then back to 1A.
  await page.getByRole('button', { name: /^1B, Hip Abduction/ }).click()
  await expect(page.getByText(/^Suggested/)).toBeVisible()
  await page.getByRole('button', { name: /^1A, Leg Curl/ }).click()
  await expect(page.locator('.workout-set-panel input[role="spinbutton"]').first()).toHaveValue('40')
  return app
}

test.describe('Superset in a session', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('Fix after a weight slip on the other member edits that member, and one set can be removed', async ({ page, request }) => {
    test.skip(process.env.E2E_BACKEND !== 'emulator', 'Needs a fresh emulator account')
    const app = await openPair(page, request, '100')
    try {
      await page.getByRole('button', { name: 'Mark set 1B for Hip Abduction' }).click()
      await page.getByRole('button', { name: 'Fix' }).click()
      await expect(page.locator(':focus')).toHaveValue('100')
      await expect(page.getByRole('button', { name: /^1B, Hip Abduction/ })).toHaveAttribute('aria-pressed', 'true')

      await page.getByRole('button', { name: 'Remove set 1B for Hip Abduction' }).click()
      await page.getByRole('button', { name: 'Remove set', exact: true }).click()
      await expect(page.getByRole('button', { name: /^(1A|1B|2A),/ })).toHaveCount(3)
      await expect(page.getByRole('button', { name: /^2B,/ })).toHaveCount(0)
      await expect(page.getByRole('region', { name: 'Superset, 2 rounds' })).toBeVisible()
    } finally {
      await deleteApp(app)
    }
  })

  test('Enter weight for the other member without weight puts the typed weight into that member, and taking it back reopens it', async ({ page, request }) => {
    test.skip(process.env.E2E_BACKEND !== 'emulator', 'Needs a fresh emulator account')
    const app = await openPair(page, request, '')
    try {
      await page.getByRole('button', { name: 'Mark set 1B for Hip Abduction' }).click()
      await page.getByRole('button', { name: 'Enter weight' }).click()
      await expect(page.locator(':focus')).toHaveAccessibleName(/^Weight, Hip Abduction, set 1/)
      await page.keyboard.type('35')
      await expect(page.getByRole('button', { name: /^1B, Hip Abduction: last 30 × 12, today 35 × 12/ })).toBeVisible()
      await expect(page.getByRole('button', { name: /^1A, Leg Curl: .*today 40 × 10/ })).toBeVisible()

      // Log 1B and 1A, then take 1B back: the panel returns to it instead of staying on round 2.
      const logSet = page.getByRole('region', { name: 'Current set' }).getByRole('button', { name: /^Log set/ })
      await logSet.click()
      await expect(page.getByRole('button', { name: /^1A, Leg Curl/ })).toHaveAttribute('aria-pressed', 'true')
      await logSet.click()
      await expect(page.getByRole('button', { name: /^2A, Leg Curl/ })).toHaveAttribute('aria-pressed', 'true')
      await page.getByRole('button', { name: 'Unmark set 1B for Hip Abduction' }).click()
      await expect(page.getByRole('button', { name: /^1B, Hip Abduction/ })).toHaveAttribute('aria-pressed', 'true')
    } finally {
      await deleteApp(app)
    }
  })
})
