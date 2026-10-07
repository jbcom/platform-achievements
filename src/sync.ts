/**
 * Mirroring the profile's achievements to a platform (docs/design/07-meta.md, Storage and sync): on sign-in, on resume
 * and after banking, send what the platform still needs and record each acknowledgement only once the platform has
 * confirmed it. Offline, signed out or failing, nothing is lost: what was not acknowledged stays outstanding.
 */
import type { AchievementProgress } from './evaluate'
import { ackValue, outstanding, type PlatformAchievements } from './platform'
import type { AchievementStore } from './store'

export type SyncResult = {
  /** Reports the platform confirmed. */
  readonly sent: number
  /** Reports that failed and stay outstanding, with why, for the caller to log. */
  readonly failed: number
  readonly errors: readonly { key: string; message: string }[]
  /** Reports the platform cannot address yet (a Play achievement without its console id). */
  readonly unaddressed: number
  readonly signedIn: boolean
}

export async function syncAchievements(
  progress: AchievementProgress,
  adapter: PlatformAchievements,
  store: AchievementStore,
): Promise<SyncResult> {
  const platform = adapter.platform
  if (platform === null || !(await adapter.signedIn()))
    return { sent: 0, failed: 0, errors: [], unaddressed: 0, signedIn: false }
  const acks = await store.acks(platform)
  const reports = outstanding(progress, acks, {
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
