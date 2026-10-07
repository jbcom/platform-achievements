/**
 * App Store Connect: `app-store-connect.json`, one record per achievement in the shape of the App
 * Store Connect API's Game Center achievement and localization attributes, and a 1024 px PNG each.
 */
import type { PlatformAchievement } from '../platform.js'
import {
  DEFAULT_LOCALE,
  type ExportOptions,
  fileStem,
  GAME_CENTER_ICON,
  type Submission,
} from './types.js'

export function appStoreConnectSubmission(
  achievements: readonly PlatformAchievement[],
  options: ExportOptions = {},
): Submission {
  const locale = options.locale ?? DEFAULT_LOCALE
  const records = achievements.map((a) => ({
    referenceName: a.name,
    vendorIdentifier: a.gameCenterId,
    points: a.points,
    showBeforeEarned: !a.hidden,
    repeatable: false,
    localizations: [
      {
        locale,
        name: a.name,
        beforeEarnedDescription: a.description,
        afterEarnedDescription: a.earnedDescription,
        image: `${fileStem(a)}.png`,
      },
    ],
  }))
  return {
    files: { 'app-store-connect/app-store-connect.json': `${JSON.stringify(records, null, 2)}\n` },
    icons: achievements.map((a) => ({
      path: `app-store-connect/${fileStem(a)}.png`,
      key: a.key,
      size: GAME_CENTER_ICON,
      format: 'png',
      locked: false,
    })),
  }
}
