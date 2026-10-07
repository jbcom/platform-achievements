/**
 * Mirroring a player's achievements to a platform: on sign-in, on resume and after earning one, send what
 * the platform still needs and record each acknowledgement only once the platform has confirmed it.
 * Offline, signed out or failing, nothing is lost: what was not acknowledged stays outstanding.
 */
import {
  ackValue,
  type Earned,
  outstanding,
  type PlatformAchievement,
  type PlatformAchievements,
} from './platform.js'
import type { AcknowledgementStore } from './store.js'

export interface SyncRequest {
  /** The resolved achievement list (see `resolveAchievements`). */
  readonly achievements: readonly PlatformAchievement[]
  /** What the player has earned, by key. */
  readonly earned: Earned
  readonly adapter: PlatformAchievements
  readonly store: AcknowledgementStore
}

export type SyncResult = {
  /** Reports the platform confirmed. */
  readonly sent: number
  /** Reports that failed and stay outstanding. */
  readonly failed: number
  /** Why each failure happened, for the caller to log. */
  readonly errors: readonly { key: string; message: string }[]
  /** Reports the platform cannot address yet (a Play achievement without its console id). */
  readonly unaddressed: number
  readonly signedIn: boolean
}

/**
 * Send what the platform still needs. Safe to call as often as you like, from anywhere: a second call
 * after a successful one sends nothing. One failing report never stops the others.
 */
export async function syncAchievements(request: SyncRequest): Promise<SyncResult> {
  const { achievements, earned, adapter, store } = request
  const platform = adapter.platform
  if (platform === null || !(await adapter.signedIn())) {
    return { sent: 0, failed: 0, errors: [], unaddressed: 0, signedIn: false }
  }
  const acks = await store.acks(platform)
  const reports = outstanding(achievements, earned, acks, {
    progress: adapter.reportsProgress && store.durable,
  })
  let sent = 0
  let unaddressed = 0
  const errors: { key: string; message: string }[] = []
  for (const report of reports) {
    const a = report.achievement
    if (!adapter.knows(a)) {
      unaddressed++
      continue
    }
    try {
      if (report.kind === 'unlock') await adapter.unlock(a)
      else await adapter.setProgress(a, report.steps, acks[a.key] ?? 0)
      await store.ack(platform, a.key, ackValue(report))
      sent++
    } catch (error) {
      errors.push({ key: a.key, message: error instanceof Error ? error.message : String(error) })
    }
  }
  return { sent, failed: errors.length, errors, unaddressed, signedIn: true }
}
