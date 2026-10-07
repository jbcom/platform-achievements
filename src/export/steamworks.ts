/**
 * Steamworks: `steamworks.json`, the achievements and their progress stats as the App Admin page lists
 * them (Steam has no bulk import), and 256 px achieved and unachieved JPEGs each.
 */
import type { PlatformAchievement } from '../platform.js'
import { fileStem, type IconFile, STEAM_ICON, type Submission } from './types.js'

export function steamworksSubmission(achievements: readonly PlatformAchievement[]): Submission {
  const icons: IconFile[] = []
  const stats: unknown[] = []
  const entries = achievements.map((a) => {
    const stem = fileStem(a)
    for (const locked of [false, true]) {
      icons.push({
        path: `steamworks/${stem}${locked ? '-locked' : ''}.jpg`,
        key: a.key,
        size: STEAM_ICON,
        format: 'jpeg',
        locked,
      })
    }
    if (a.steamStat !== null && a.steps !== null) {
      stats.push({
        apiName: a.steamStat,
        type: 'INT',
        displayName: a.name,
        min: 0,
        max: a.steps,
        defaultValue: 0,
        incrementOnly: true,
        setBy: 'Client',
        unlocks: a.steamApiName,
      })
    }
    return {
      apiName: a.steamApiName,
      displayName: a.name,
      description: a.description,
      hidden: a.hidden,
      progressStat: a.steamStat,
      achievedIcon: `${stem}.jpg`,
      unachievedIcon: `${stem}-locked.jpg`,
    }
  })
  return {
    files: {
      'steamworks/steamworks.json': `${JSON.stringify({ stats, achievements: entries }, null, 2)}\n`,
    },
    icons,
  }
}
