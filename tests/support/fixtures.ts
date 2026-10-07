import {
  type AchievementDefinition,
  type AchievementPlatform,
  type PlatformAchievement,
  type PlatformAchievements,
  resolveAchievements,
} from '../../src'

/** A small, neutral catalogue: a standard one, an incremental one, a hidden one and a graded pair. */
export const DEFINITIONS: readonly AchievementDefinition[] = [
  {
    key: 'first-win',
    name: 'First Win',
    description: 'Win your first match.',
    earnedDescription: 'Player One takes the first trophy home.',
    points: 5,
  },
  {
    key: 'ten-wins',
    name: 'Ten Wins',
    description: 'Win 10 matches, in any mode.',
    points: 10,
    steps: 10,
  },
  {
    key: 'flawless',
    name: 'Flawless',
    description: 'Win a match without taking damage.',
    points: 15,
    hidden: true,
  },
  {
    key: 'speedrun:silver',
    name: 'Speedrun (Silver)',
    description: 'Finish in under 5 minutes.',
    points: 10,
  },
  {
    key: 'speedrun:gold',
    name: 'Speedrun (Gold)',
    description: 'Finish in under 3 minutes.',
    points: 20,
  },
]

export const GAME_CENTER_NAMESPACE = 'com.example.game'

export const resolveFixtures = (
  playIds?: Readonly<Record<string, string>>,
): readonly PlatformAchievement[] =>
  resolveAchievements(DEFINITIONS, {
    gameCenterNamespace: GAME_CENTER_NAMESPACE,
    ...(playIds ? { playIds } : {}),
  })

export const ACHIEVEMENTS = resolveFixtures()

export const achievement = (key: string): PlatformAchievement => {
  const found = ACHIEVEMENTS.find((a) => a.key === key)
  if (!found) throw new Error(`no fixture ${key}`)
  return found
}

/** A fake adapter that records what it is asked to do and can be told to fail. */
export function fakeAdapter(
  options: {
    platform?: AchievementPlatform | null
    signedIn?: boolean
    reportsProgress?: boolean
    knows?: (a: PlatformAchievement) => boolean
    fail?: (call: string) => boolean
  } = {},
) {
  const calls: string[] = []
  const adapter: PlatformAchievements = {
    platform: options.platform === undefined ? 'steam' : options.platform,
    reportsProgress: options.reportsProgress ?? true,
    signedIn: async () => options.signedIn ?? true,
    knows: options.knows ?? (() => true),
    unlock: async (a) => {
      const call = `unlock ${a.key}`
      if (options.fail?.(call)) throw new Error(`refused ${call}`)
      calls.push(call)
    },
    setProgress: async (a, steps, acked) => {
      const call = `progress ${a.key} ${steps} from ${acked}`
      if (options.fail?.(call)) throw new Error(`refused ${call}`)
      calls.push(call)
    },
    show: async () => {
      calls.push('show')
    },
  }
  return { adapter, calls }
}
