/**
 * Checks a resolved achievement list against the limits the platform consoles enforce, so a list that
 * will be rejected at submission fails in your tests instead. Game Center's limits are the tightest
 * and bind a game for its whole lifetime: its achievements cannot be deleted once released.
 */
import type { AchievementPlatform, PlatformAchievement } from './platform.js'

/** The limits the consoles enforce, as documented when this package was written. */
export const CONSOLE_LIMITS = {
  /** Game Center's most achievements per app. */
  achievements: 100,
  /** Game Center's most points across an app's achievements. */
  points: 1000,
  pointsMin: 5,
  /** Game Center's most points for one achievement. */
  pointsMax: 100,
  /** Play Games and Game Center points are multiples of this. */
  pointsStep: 5,
  /** Play Games' most steps for an incremental achievement. */
  stepsMax: 10_000,
  /** Game Center's achievement id length. */
  idLength: 100,
  /** Play Games' name length. */
  nameLength: 100,
  /** Play Games' description length. */
  descriptionLength: 500,
} as const

export interface AchievementIssue {
  /** The achievement the issue is about, or null for the list as a whole. */
  readonly key: string | null
  /** The platform whose rule it breaks. */
  readonly platform: AchievementPlatform
  readonly message: string
}

/** Every rule the list breaks; an empty array means the list is acceptable to all three consoles. */
export function validateAchievements(
  achievements: readonly PlatformAchievement[],
): AchievementIssue[] {
  const issues: AchievementIssue[] = []
  const add = (key: string | null, platform: AchievementPlatform, message: string) => {
    issues.push({ key, platform, message })
  }

  if (achievements.length > CONSOLE_LIMITS.achievements) {
    add(
      null,
      'game-center',
      `${achievements.length} achievements exceed Game Center's ${CONSOLE_LIMITS.achievements}`,
    )
  }
  const total = achievements.reduce((sum, a) => sum + a.points, 0)
  if (total > CONSOLE_LIMITS.points) {
    add(null, 'game-center', `${total} points exceed Game Center's ${CONSOLE_LIMITS.points}`)
  }

  const duplicates = (
    label: string,
    platform: AchievementPlatform,
    pick: (a: PlatformAchievement) => string | null,
  ) => {
    const seen = new Set<string>()
    for (const a of achievements) {
      const value = pick(a)
      if (value === null) continue
      if (seen.has(value)) add(a.key, platform, `duplicate ${label} ${value}`)
      seen.add(value)
    }
  }
  duplicates('name', 'play', (a) => a.name)
  duplicates('description', 'play', (a) => a.description)
  duplicates('Game Center id', 'game-center', (a) => a.gameCenterId)
  duplicates('Steam API name', 'steam', (a) => a.steamApiName)
  duplicates('Steam stat', 'steam', (a) => a.steamStat)
  duplicates('Play id', 'play', (a) => a.playId)

  for (const a of achievements) {
    if (
      !Number.isInteger(a.points) ||
      a.points % CONSOLE_LIMITS.pointsStep !== 0 ||
      a.points < CONSOLE_LIMITS.pointsMin ||
      a.points > CONSOLE_LIMITS.pointsMax
    ) {
      add(
        a.key,
        'game-center',
        `${a.points} points must be a multiple of ${CONSOLE_LIMITS.pointsStep} from ${CONSOLE_LIMITS.pointsMin} to ${CONSOLE_LIMITS.pointsMax}`,
      )
    }
    if (a.steps !== null && a.steps > CONSOLE_LIMITS.stepsMax) {
      add(a.key, 'play', `${a.steps} steps exceed Play Games' ${CONSOLE_LIMITS.stepsMax}`)
    }
    if (
      !/^[A-Za-z0-9._]+$/.test(a.gameCenterId) ||
      a.gameCenterId.length > CONSOLE_LIMITS.idLength
    ) {
      add(
        a.key,
        'game-center',
        `id ${a.gameCenterId} must be letters, digits, periods and underscores, at most ${CONSOLE_LIMITS.idLength} characters`,
      )
    }
    if (a.name.length === 0 || a.name.length > CONSOLE_LIMITS.nameLength) {
      add(a.key, 'play', `name must be 1 to ${CONSOLE_LIMITS.nameLength} characters`)
    }
    for (const [label, text] of [
      ['description', a.description],
      ['earned description', a.earnedDescription],
    ] as const) {
      if (text.length === 0 || text.length > CONSOLE_LIMITS.descriptionLength) {
        add(a.key, 'play', `${label} must be 1 to ${CONSOLE_LIMITS.descriptionLength} characters`)
      }
    }
  }
  return issues
}
