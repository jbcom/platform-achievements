/**
 * The platforms' submission files, generated from the registry (docs/design/07-meta.md, Submission files), so nothing
 * is configured by hand and nothing drifts. Pure: `pnpm achievements:export` (scripts/achievements-export.ts) writes the
 * files and rasterises the icons listed here.
 *
 * - Play Console: the bulk-import zip's headerless `AchievementsMetadata.csv` (name, description, incremental, steps,
 *   initial state, points, list order), `AchievementsLocalizations.csv` and `AchievementsIconsMappings.csv`, and a
 *   512 px PNG per platform achievement.
 * - App Store Connect: `app-store-connect.json`, records in the shape of the App Store Connect API's Game Center
 *   achievement and localization attributes, and a 1024 px PNG each.
 * - Steamworks: `steamworks.json`, the achievements and their progress stats as the App Admin page lists them, and
 *   256 px achieved and unachieved JPEGs each (Steam has no bulk import).
 *
 * Text comes through `text`, the game's string catalogue, so a translation adds a locale here too.
 */
import type { Grade } from '../../balance/achievements'
import { PLATFORM_ACHIEVEMENTS, type PlatformAchievement } from './platform'
import { achievementById, gradesOf, type IconGlyph } from './registry'

export type Text = (key: string, params?: Readonly<Record<string, string | number>>) => string

/** An icon file to rasterise from `achievementIconSvg`. */
export type IconFile = {
  readonly path: string
  readonly glyph: IconGlyph
  readonly grade: Grade
  readonly size: number
  readonly format: 'png' | 'jpeg'
  readonly locked: boolean
}

export type Submission = {
  /** Text files by path under the export directory. */
  readonly files: Readonly<Record<string, string>>
  readonly icons: readonly IconFile[]
}

export const PLAY_ICON = 512
export const GAME_CENTER_ICON = 1024
export const STEAM_ICON = 256

/** A CSV field: quoted when it holds a comma, a quote or a line break. */
const csv = (value: string | number): string => {
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}
const row = (values: readonly (string | number)[]) => values.map(csv).join(',')

/** One platform achievement's text: its name (with the grade when it has more than one) and its goal at that grade. */
export function platformText(a: PlatformAchievement, text: Text) {
  const def = achievementById(a.id)
  const graded = gradesOf(def).length > 1
  const gradeName = text(`achievement.grade.${a.grade}`)
  const base = text(`ach.${a.id}.name`)
  const at = def.grades[a.grade]?.at ?? 0
  return {
    name: graded ? text('achievement.platformName', { name: base, grade: gradeName }) : base,
    description: text(`ach.${a.id}.goal`, { at, grade: gradeName }),
    earned: text(`ach.${a.id}.earned`),
  }
}

const fileStem = (a: PlatformAchievement) => `${a.id}-${a.grade}`

export function submission(text: Text, locale = 'en-US'): Submission {
  const icons: IconFile[] = []
  const metadata: string[] = []
  const localizations: string[] = []
  const iconMap: string[] = []
  const gameCenter: unknown[] = []
  const steamAchievements: unknown[] = []
  const steamStats: unknown[] = []

  for (const a of PLATFORM_ACHIEVEMENTS) {
    const { glyph } = achievementById(a.id)
    const t = platformText(a, text)
    const stem = fileStem(a)

    const playIcon = `play/${stem}.png`
    metadata.push(
      row([
        t.name,
        t.description,
        a.steps === null ? 'False' : 'True',
        a.steps ?? '',
        a.hidden ? 'Hidden' : 'Revealed',
        a.points,
        a.order,
      ]),
    )
    localizations.push(row([t.name, t.name, t.description, locale]))
    iconMap.push(row([t.name, `${stem}.png`]))
    icons.push({
      path: playIcon,
      glyph,
      grade: a.grade,
      size: PLAY_ICON,
      format: 'png',
      locked: false,
    })

    const gcIcon = `app-store-connect/${stem}.png`
    gameCenter.push({
      referenceName: t.name,
      vendorIdentifier: a.gameCenterId,
      points: a.points,
      showBeforeEarned: !a.hidden,
      repeatable: false,
      localizations: [
        {
          locale,
          name: t.name,
          beforeEarnedDescription: t.description,
          afterEarnedDescription: t.earned,
          image: `${stem}.png`,
        },
      ],
    })
    icons.push({
      path: gcIcon,
      glyph,
      grade: a.grade,
      size: GAME_CENTER_ICON,
      format: 'png',
      locked: false,
    })

    steamAchievements.push({
      apiName: a.steamApiName,
      displayName: t.name,
      description: t.description,
      hidden: a.hidden,
      progressStat: a.steamStat,
      achievedIcon: `${stem}.jpg`,
      unachievedIcon: `${stem}-locked.jpg`,
    })
    icons.push(
      {
        path: `steamworks/${stem}.jpg`,
        glyph,
        grade: a.grade,
        size: STEAM_ICON,
        format: 'jpeg',
        locked: false,
      },
      {
        path: `steamworks/${stem}-locked.jpg`,
        glyph,
        grade: a.grade,
        size: STEAM_ICON,
        format: 'jpeg',
        locked: true,
      },
    )
    if (a.steamStat !== null && a.steps !== null) {
      steamStats.push({
        apiName: a.steamStat,
        type: 'INT',
        displayName: text(`ach.${a.id}.name`),
        min: 0,
        max: a.steps,
        defaultValue: 0,
        incrementOnly: true,
        setBy: 'Client',
        unlocks: a.steamApiName,
      })
    }
  }

  const lines = (rows: readonly string[]) => `${rows.join('\n')}\n`
  return {
    files: {
      'play/AchievementsMetadata.csv': lines(metadata),
      'play/AchievementsLocalizations.csv': lines(localizations),
      'play/AchievementsIconsMappings.csv': lines(iconMap),
      'app-store-connect/app-store-connect.json': `${JSON.stringify(gameCenter, null, 2)}\n`,
      'steamworks/steamworks.json': `${JSON.stringify(
        { stats: steamStats, achievements: steamAchievements },
        null,
        2,
      )}\n`,
    },
    icons,
  }
}

/**
 * Play's console-generated ids from the resources file the Play Console offers after import (Android string
 * resources, `<string name="achievement_the_hunt_bronze">CgkI…</string>`), matched to platform achievements by their
 * exported names. Returns the `play-ids.json` content: platform key to Play id.
 */
export function playIdsFromResources(xml: string, text: Text): Record<string, string> {
  const resource = (name: string) =>
    `achievement_${name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')}`
  const found = new Map<string, string>()
  for (const m of xml.matchAll(/<string\s+name="(achievement_[^"]+)"[^>]*>([^<]+)<\/string>/g)) {
    const [, name, id] = m
    if (name && id) found.set(name, id.trim())
  }
  const ids: Record<string, string> = {}
  for (const a of PLATFORM_ACHIEVEMENTS) {
    const id = found.get(resource(platformText(a, text).name))
    if (id) ids[a.key] = id
  }
  return ids
}
