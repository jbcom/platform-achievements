/**
 * Achievements on Google Play Games, Game Center and Steam (docs/design/07-meta.md, On the platforms; Storage and sync).
 * None of the three has grades, so every grade of an achievement is its own **platform achievement**, keyed
 * `<id>:<grade>`, with its points and its id on each platform derived from the registry:
 *
 * - Game Center: `cotm.<id with underscores>.<grade>` (letters, digits, periods and underscores, at most 100 characters);
 * - Steam: the API name `ACH_<ID>_<GRADE>`, and for an incremental one the progress stat `STAT_<ID>`;
 * - Play Games: the id the Play Console generated, read from `play-ids.json` (null until it is imported).
 *
 * What a platform still needs is derived, never queued by hand: everything the profile has earned (each grade, and an
 * incremental achievement's steps) less what that platform has acknowledged. So a report that failed or was never sent
 * simply stays outstanding, and sending twice is harmless.
 */
import { ACHIEVEMENT_POINTS, type Grade, type Platform } from '../../balance/achievements'
import type { AchievementProgress } from './evaluate'
import PLAY_IDS from './play-ids.json'
import { ACHIEVEMENTS, gradesOf } from './registry'

/** One grade of one achievement, as every platform knows it. */
export type PlatformAchievement = {
  /** `<id>:<grade>`: the key acknowledgements are stored under. */
  readonly key: string
  readonly id: string
  readonly grade: Grade
  readonly points: number
  readonly hidden: boolean
  /** Steps of an incremental achievement (its last grade only), or null for a standard one. */
  readonly steps: number | null
  /** The position in the platforms' lists, from 1. */
  readonly order: number
  readonly gameCenterId: string
  readonly steamApiName: string
  /** The Steam stat that is an incremental achievement's progress bar, or null. */
  readonly steamStat: string | null
  /** The Play Console's id, or null until it is imported into `play-ids.json`. */
  readonly playId: string | null
}

const upper = (id: string) => id.replaceAll('-', '_').toUpperCase()

export const gameCenterId = (id: string, grade: Grade): string =>
  `cotm.${id.replaceAll('-', '_')}.${grade}`
export const steamApiName = (id: string, grade: Grade): string =>
  `ACH_${upper(id)}_${grade.toUpperCase()}`
export const steamStat = (id: string): string => `STAT_${upper(id)}`

const playIds: Readonly<Record<string, string>> = PLAY_IDS

/** Every platform achievement in registry order. */
export const PLATFORM_ACHIEVEMENTS: readonly PlatformAchievement[] = ACHIEVEMENTS.flatMap((def) => {
  const grades = gradesOf(def)
  return grades.map(({ grade }, i) => {
    const key = `${def.id}:${grade}`
    const incremental = def.progress.kind === 'incremental' && i === grades.length - 1
    return {
      key,
      id: def.id,
      grade,
      points: ACHIEVEMENT_POINTS[grade],
      hidden: def.hidden,
      steps: incremental && def.progress.kind === 'incremental' ? def.progress.steps : null,
      order: 0,
      gameCenterId: gameCenterId(def.id, grade),
      steamApiName: steamApiName(def.id, grade),
      steamStat: incremental ? steamStat(def.id) : null,
      playId: playIds[key] ?? null,
    }
  })
}).map((a, i) => ({ ...a, order: i + 1 }))

/** The platform achievement with `key`; throws on an unknown key. */
export function platformAchievement(key: string): PlatformAchievement {
  const found = PLATFORM_ACHIEVEMENTS.find((a) => a.key === key)
  if (!found) throw new RangeError(`unknown platform achievement ${key}`)
  return found
}

/** What a platform has acknowledged, by key: 1 for an unlock; for an incremental one, the steps (all of them once unlocked). */
export type Acks = Readonly<Record<string, number>>

/** One report a platform still needs. */
export type Report =
  | { readonly kind: 'unlock'; readonly achievement: PlatformAchievement }
  | { readonly kind: 'progress'; readonly achievement: PlatformAchievement; readonly steps: number }

const GRADE_ORDER: readonly Grade[] = ['bronze', 'silver', 'gold']
const earned = (held: Grade | null, grade: Grade) =>
  held !== null && GRADE_ORDER.indexOf(held) >= GRADE_ORDER.indexOf(grade)

/**
 * What a platform still needs, given the profile's progress and what that platform acknowledged. `progress: false`
 * leaves out progress reports (an add-only platform API without durable acknowledgements): an incremental achievement
 * is then reported only by its unlock.
 */
export function outstanding(
  progress: AchievementProgress,
  acks: Acks,
  options: { progress: boolean },
): Report[] {
  const out: Report[] = []
  for (const a of PLATFORM_ACHIEVEMENTS) {
    const record = progress[a.id]
    if (!record) continue
    const acked = acks[a.key] ?? 0
    const done = earned(record.grade, a.grade)
    if (a.steps === null) {
      if (done && acked < 1) out.push({ kind: 'unlock', achievement: a })
      continue
    }
    if (done) {
      if (acked < a.steps) out.push({ kind: 'unlock', achievement: a })
      continue
    }
    const steps = Math.min(Math.floor(record.best), a.steps - 1)
    if (options.progress && steps > acked) out.push({ kind: 'progress', achievement: a, steps })
  }
  return out
}

/** The value a platform acknowledges for a report: what `outstanding` compares against next time. */
export const ackValue = (report: Report): number =>
  report.kind === 'progress' ? report.steps : (report.achievement.steps ?? 1)

/**
 * A platform's achievements service (src/platform/achievements/). `unlock` is idempotent on every platform.
 * `setProgress` is absolute: the platform shows `steps` of the achievement's steps; `acked` is the value it last
 * acknowledged, for an API that can only add.
 */
export interface PlatformAchievements {
  /** The platform it mirrors to; null for a build with none (the web), which is never signed in. */
  readonly platform: Platform | null
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
