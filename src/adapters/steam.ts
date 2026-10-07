/**
 * Steam achievements through `steamworks.js`, for a future desktop build (docs/design/07-meta.md, Storage and sync).
 * The desktop shell initialises the client and hands it in; this adapter needs only the part of its API below.
 *
 * Steam's progress is absolute: an incremental achievement's progress stat (`STAT_<ID>`) is set to the steps reached,
 * and Steam shows it as the achievement's progress bar. Every change is stored (`stats.store`) before it counts as
 * acknowledged.
 */
import type { PlatformAchievements } from '@/game/meta/achievements/platform'

/** The part of a `steamworks.js` client the adapter uses. */
export interface SteamClient {
  achievement: { activate(name: string): boolean }
  stats: { setInt(name: string, value: number): boolean; store(): boolean }
  overlay: { activateDialog(dialog: number): void }
}

/** `steamworks.js`'s `overlay.Dialog.Achievements`. */
export const STEAM_ACHIEVEMENTS_DIALOG = 6

export function steamAchievements(client: SteamClient | null): PlatformAchievements {
  const must = (ok: boolean, what: string) => {
    if (!ok) throw new Error(`Steam refused ${what}`)
  }
  const steam = () => {
    if (!client) throw new Error('Steam is not running')
    return client
  }
  return {
    platform: 'steam',
    reportsProgress: true,
    async signedIn() {
      return client !== null
    },
    knows: () => true,
    async unlock(a) {
      const s = steam()
      if (a.steamStat !== null && a.steps !== null) {
        must(s.stats.setInt(a.steamStat, a.steps), `${a.steamStat} = ${a.steps}`)
      }
      must(s.achievement.activate(a.steamApiName), a.steamApiName)
      must(s.stats.store(), 'storing stats')
    },
    async setProgress(a, steps) {
      if (a.steamStat === null) throw new RangeError(`${a.key} is not incremental`)
      const s = steam()
      must(s.stats.setInt(a.steamStat, steps), `${a.steamStat} = ${steps}`)
      must(s.stats.store(), 'storing stats')
    },
    async show() {
      steam().overlay.activateDialog(STEAM_ACHIEVEMENTS_DIALOG)
    },
  }
}
