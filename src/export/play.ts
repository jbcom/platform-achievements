/**
 * Play Console: the bulk-import `AchievementsMetadata.csv` (headerless: name, description, incremental,
 * steps, initial state, points, list order), `AchievementsLocalizations.csv` and
 * `AchievementsIconsMappings.csv`, and a 512 px PNG per achievement. The console wants the files and
 * icons in one flat zip (see `createZip`).
 */
import type { PlatformAchievement } from '../platform.js'
import { csvLines, csvRow } from './csv.js'
import {
  DEFAULT_LOCALE,
  type ExportOptions,
  fileStem,
  type IconFile,
  PLAY_ICON,
  type Submission,
} from './types.js'

export function playConsoleSubmission(
  achievements: readonly PlatformAchievement[],
  options: ExportOptions = {},
): Submission {
  const locale = options.locale ?? DEFAULT_LOCALE
  const metadata: string[] = []
  const localizations: string[] = []
  const iconMap: string[] = []
  const icons: IconFile[] = []
  for (const a of achievements) {
    const stem = fileStem(a)
    metadata.push(
      csvRow([
        a.name,
        a.description,
        a.steps === null ? 'False' : 'True',
        a.steps ?? '',
        a.hidden ? 'Hidden' : 'Revealed',
        a.points,
        a.order,
      ]),
    )
    localizations.push(csvRow([a.name, a.name, a.description, locale]))
    iconMap.push(csvRow([a.name, `${stem}.png`]))
    icons.push({
      path: `play/${stem}.png`,
      key: a.key,
      size: PLAY_ICON,
      format: 'png',
      locked: false,
    })
  }
  return {
    files: {
      'play/AchievementsMetadata.csv': csvLines(metadata),
      'play/AchievementsLocalizations.csv': csvLines(localizations),
      'play/AchievementsIconsMappings.csv': csvLines(iconMap),
    },
    icons,
  }
}

/** The Android string-resource name the Play Console gives an achievement: `achievement_<name>`. */
const resourceName = (name: string): string =>
  `achievement_${name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '_')
    .replaceAll(/^_|_$/g, '')}`

/**
 * The Play Console's generated ids, read from the resources file it offers after an import (Android
 * string resources such as `<string name="achievement_first_win">CgkI…</string>`), matched to
 * achievements by their exported names. Returns achievement key to Play id, ready to pass to
 * `resolveAchievements` as `playIds`.
 */
export function playIdsFromResources(
  xml: string,
  achievements: readonly PlatformAchievement[],
): Record<string, string> {
  const found = new Map<string, string>()
  for (const m of xml.matchAll(/<string\s+name="(achievement_[^"]+)"[^>]*>([^<]+)<\/string>/g)) {
    const [, name, id] = m
    if (name && id) found.set(name, id.trim())
  }
  const ids: Record<string, string> = {}
  for (const a of achievements) {
    const id = found.get(resourceName(a.name))
    if (id) ids[a.key] = id
  }
  return ids
}
