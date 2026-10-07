/**
 * Google Play Games and Game Center achievements through a Capacitor game-services plugin. The shape
 * below matches `@idleflowgames/capacitor-play-games` (Capacitor 8; Play Games Services v2 on Android,
 * GameKit on iOS), but it is structural: any object with these four methods works, and this package
 * imports no plugin. The app imports the plugin and passes it in.
 *
 * The plugin's progress call only adds (`incrementAchievement`: whole steps on Play, percentage points
 * on Game Center), so an absolute value is sent as the difference from what the platform last
 * acknowledged. `syncAchievements` asks for progress only when those acknowledgements are stored
 * durably.
 */
import type { PlatformAchievement, PlatformAchievements } from '../platform.js'

/** The part of the game-services plugin the adapter uses. */
export interface GameServicesPlugin {
  isSignedIn(): Promise<{ signedIn: boolean }>
  unlockAchievement(opts: { id: string }): Promise<void>
  incrementAchievement(opts: { id: string; steps: number }): Promise<void>
  showAchievements(): Promise<void>
}

/** Which service the plugin is talking to on this device. */
export type GameServicesPlatform = 'play' | 'game-center'

/**
 * @param plugin The game-services plugin.
 * @param platform `play` on Android, `game-center` on iOS.
 */
export function gameServicesAchievements(
  plugin: GameServicesPlugin,
  platform: GameServicesPlatform,
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
