/**
 * Play Games and Game Center achievements through a Capacitor game-services plugin (docs/design/07-meta.md, Storage and
 * sync). The plugin is `@idleflowgames/capacitor-play-games` (Capacitor 8; Play Games Services v2 on Android, GameKit
 * on iOS), installed with the consoles' setup (07-meta, Owner steps); like every Capacitor plugin it is imported only in
 * `src/platform/mobile.ts`, which hands it in here. This adapter needs only the part of its API below.
 *
 * The plugin's progress call only adds (`incrementAchievement`: steps on Play, percentage points on Game Center), so an
 * absolute value is sent as the difference from what the platform last acknowledged; `syncAchievements` asks for
 * progress only when those acknowledgements are stored durably.
 */
import type { Platform } from '@/game/balance/achievements'
import type { PlatformAchievement, PlatformAchievements } from '@/game/meta/achievements/platform'

/** The part of the game-services plugin the adapter uses. */
export interface GameServicesPlugin {
  isSignedIn(): Promise<{ signedIn: boolean }>
  unlockAchievement(opts: { id: string }): Promise<void>
  incrementAchievement(opts: { id: string; steps: number }): Promise<void>
  showAchievements(): Promise<void>
}

export function gameServicesAchievements(
  plugin: GameServicesPlugin,
  platform: Extract<Platform, 'play' | 'game-center'>,
): PlatformAchievements {
  const idOf = (a: PlatformAchievement): string => {
    const id = platform === 'play' ? a.playId : a.gameCenterId
    if (id === null) throw new RangeError(`${a.key} has no Play Console id yet`)
    return id
  }
  /** Play counts whole steps; Game Center counts percent of the way. */
  const units = (a: PlatformAchievement, steps: number): number =>
    platform === 'play' ? steps : (100 * steps) / (a.steps ?? 1)

  return {
    platform,
    reportsProgress: true,
    async signedIn() {
      return (await plugin.isSignedIn()).signedIn
    },
    knows: (a) => platform === 'game-center' || a.playId !== null,
    async unlock(a) {
      await plugin.unlockAchievement({ id: idOf(a) })
    },
    async setProgress(a, steps, acked) {
      if (a.steps === null) throw new RangeError(`${a.key} is not incremental`)
      const add = units(a, steps) - units(a, acked)
      if (add <= 0) return
      await plugin.incrementAchievement({ id: idOf(a), steps: add })
    },
    async show() {
      await plugin.showAchievements()
    },
  }
}
