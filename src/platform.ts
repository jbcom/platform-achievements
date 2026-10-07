/**
 * The achievement model every platform shares, and the adapter contract each platform implements.
 *
 * A game describes its achievements once, as `AchievementDefinition`s. `resolveAchievements` turns that
 * list into `PlatformAchievement`s: the definition plus its id on each platform, in a stable order. None
 * of Google Play Games, Game Center or Steam has tiers or grades, so a game that grades an achievement
 * (bronze, silver, gold) defines one achievement per grade.
 *
 * What a platform still needs is derived, never queued by hand: everything the player has **earned**
 * less what that platform has **acknowledged** (see `outstanding`). A report that failed or was never
 * sent simply stays outstanding, and sending a report twice is harmless.
 */

/** The platforms achievements are mirrored to. */
export type AchievementPlatform = 'play' | 'game-center' | 'steam'

/** One achievement, as the game describes it. */
export interface AchievementDefinition {
  /**
   * A stable key, never reused: acknowledgements are stored under it. Lowercase letters, digits and
   * single separators (`-`, `_`, `.` or `:`), for example `first-win` or `collector:gold`.
   */
  readonly key: string
  /** The name players see. Unique across the list. */
  readonly name: string
  /** What the player must do, shown before the achievement is earned. Unique across the list. */
  readonly description: string
  /** What the player reads after earning it (Game Center's after-earned description). Defaults to `description`. */
  readonly earnedDescription?: string
  /** Points on the platforms: a multiple of 5 from 5 to 100 is valid on both Play Games and Game Center. */
  readonly points: number
  /** Hidden until earned. Defaults to `false`. */
  readonly hidden?: boolean
  /**
   * Total steps of an incremental achievement (a progress bar), at least 2; omit for a standard
   * achievement that is simply unlocked.
   */
  readonly steps?: number
  /** Ids this achievement already has on a platform, replacing the ones derived from `key`. */
  readonly ids?: {
    readonly gameCenter?: string
    readonly steam?: string
    readonly steamStat?: string
    readonly play?: string
  }
}

/** One achievement resolved for the platforms. */
export interface PlatformAchievement {
  readonly key: string
  readonly name: string
  readonly description: string
  readonly earnedDescription: string
  readonly points: number
  readonly hidden: boolean
  /** Steps of an incremental achievement, or null for a standard one. */
  readonly steps: number | null
  /** The position in the platforms' lists, from 1. */
  readonly order: number
  readonly gameCenterId: string
  readonly steamApiName: string
  /** The Steam stat that is an incremental achievement's progress bar, or null. */
  readonly steamStat: string | null
  /** The Play Console's id, or null until it is known. */
  readonly playId: string | null
}

export interface ResolveOptions {
  /**
   * The reverse-DNS style prefix of derived Game Center ids, such as `com.example.game`. Game Center ids
   * are permanent, so choose it once. Defaults to `achievement`.
   */
  readonly gameCenterNamespace?: string
  /** The Play Console's generated ids by achievement key, once imported; absent keys are not addressable on Play. */
  readonly playIds?: Readonly<Record<string, string>>
}

const KEY_PATTERN = /^[a-z0-9]+(?:[-_.:][a-z0-9]+)*$/

const identifier = (key: string): string => key.replaceAll(/[^a-z0-9]+/g, '_')
const upper = (key: string): string => identifier(key).toUpperCase()

/** The Game Center id derived from a namespace and a key: letters, digits, periods and underscores. */
export const gameCenterId = (namespace: string, key: string): string =>
  `${namespace}.${identifier(key)}`
/** The Steam achievement API name derived from a key: `ACH_<KEY>`. */
export const steamApiName = (key: string): string => `ACH_${upper(key)}`
/** The Steam stat that backs an incremental achievement's progress bar: `STAT_<KEY>`. */
export const steamStat = (key: string): string => `STAT_${upper(key)}`

/**
 * Resolve definitions into platform achievements, in list order.
 *
 * @throws RangeError for a malformed or duplicate key, or `steps` that is not a whole number of at least 2.
 */
export function resolveAchievements(
  definitions: readonly AchievementDefinition[],
  options: ResolveOptions = {},
): readonly PlatformAchievement[] {
  const namespace = options.gameCenterNamespace ?? 'achievement'
  const playIds = options.playIds ?? {}
  const seen = new Set<string>()
  return definitions.map((def, index) => {
    if (!KEY_PATTERN.test(def.key)) {
      throw new RangeError(`achievement key ${JSON.stringify(def.key)} is not a valid key`)
    }
    if (seen.has(def.key)) throw new RangeError(`duplicate achievement key ${def.key}`)
    seen.add(def.key)
    if (def.steps !== undefined && (!Number.isInteger(def.steps) || def.steps < 2)) {
      throw new RangeError(`${def.key}: steps must be a whole number of at least 2`)
    }
    const incremental = def.steps !== undefined
    return {
      key: def.key,
      name: def.name,
      description: def.description,
      earnedDescription: def.earnedDescription ?? def.description,
      points: def.points,
      hidden: def.hidden ?? false,
      steps: def.steps ?? null,
      order: index + 1,
      gameCenterId: def.ids?.gameCenter ?? gameCenterId(namespace, def.key),
      steamApiName: def.ids?.steam ?? steamApiName(def.key),
      steamStat: incremental ? (def.ids?.steamStat ?? steamStat(def.key)) : null,
      playId: def.ids?.play ?? playIds[def.key] ?? null,
    }
  })
}

/** The achievement with `key`; throws on an unknown key. */
export function findAchievement(
  achievements: readonly PlatformAchievement[],
  key: string,
): PlatformAchievement {
  const found = achievements.find((a) => a.key === key)
  if (!found) throw new RangeError(`unknown achievement ${key}`)
  return found
}

/**
 * What a player has earned, by achievement key. A standard achievement is earned at `1` (or more). An
 * incremental one holds the steps reached so far, and is earned once that reaches its total. A key
 * that is absent, or `0`, has not been started. Fractions are floored.
 */
export type Earned = Readonly<Record<string, number>>

/**
 * What a platform has acknowledged, by key, in the same terms as `Earned`: `1` for a standard unlock; for
 * an incremental one, the steps (all of them once unlocked).
 */
export type Acks = Readonly<Record<string, number>>

/** One report a platform still needs. */
export type Report =
  | { readonly kind: 'unlock'; readonly achievement: PlatformAchievement }
  | { readonly kind: 'progress'; readonly achievement: PlatformAchievement; readonly steps: number }

/**
 * What a platform still needs, given what the player has earned and what that platform acknowledged.
 * Pure: the same inputs give the same reports, in list order.
 *
 * `progress: false` leaves out progress reports (an add-only platform API without durable
 * acknowledgements): an incremental achievement is then reported only by its unlock.
 */
export function outstanding(
  achievements: readonly PlatformAchievement[],
  earned: Earned,
  acks: Acks,
  options: { readonly progress: boolean },
): Report[] {
  const out: Report[] = []
  for (const a of achievements) {
    const have = Math.floor(earned[a.key] ?? 0)
    if (have <= 0) continue
    const acked = acks[a.key] ?? 0
    if (a.steps === null) {
      if (acked < 1) out.push({ kind: 'unlock', achievement: a })
      continue
    }
    if (have >= a.steps) {
      if (acked < a.steps) out.push({ kind: 'unlock', achievement: a })
      continue
    }
    if (options.progress && have > acked)
      out.push({ kind: 'progress', achievement: a, steps: have })
  }
  return out
}

/** The value a platform acknowledges for a report: what `outstanding` compares against next time. */
export const ackValue = (report: Report): number =>
  report.kind === 'progress' ? report.steps : (report.achievement.steps ?? 1)

/**
 * A platform's achievements service. `unlock` is idempotent on every platform. `setProgress` is
 * absolute: the platform ends up showing `steps` of the achievement's steps; `acked` is the value it last
 * acknowledged, for an API that can only add.
 */
export interface PlatformAchievements {
  /** The platform it mirrors to; null for a build with none (the web), which is never signed in. */
  readonly platform: AchievementPlatform | null
  /** Whether it can report progress at all (an add-only API needs durable acknowledgements). */
  readonly reportsProgress: boolean
  signedIn(): Promise<boolean>
  /** Whether this platform can address `a` (Play needs its console id). */
  knows(a: PlatformAchievement): boolean
  unlock(a: PlatformAchievement): Promise<void>
  setProgress(a: PlatformAchievement, steps: number, acked: number): Promise<void>
  /** The platform's own achievements screen. */
  show(): Promise<void>
}
