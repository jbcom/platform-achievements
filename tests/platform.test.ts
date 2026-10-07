import { describe, expect, it } from 'vitest'
import {
  ackValue,
  findAchievement,
  gameCenterId,
  outstanding,
  type Report,
  resolveAchievements,
  steamApiName,
  steamStat,
} from '../src'
import {
  ACHIEVEMENTS,
  DEFINITIONS,
  GAME_CENTER_NAMESPACE,
  resolveFixtures,
} from './support/fixtures'

const keys = (reports: readonly Report[]) =>
  reports.map((r) =>
    r.kind === 'progress' ? `${r.achievement.key}=${r.steps}` : r.achievement.key,
  )

describe('resolving definitions', () => {
  it('derives an id on every platform from the key, in list order', () => {
    expect(ACHIEVEMENTS.map((a) => a.order)).toEqual([1, 2, 3, 4, 5])
    const [first, tenWins, , silver] = ACHIEVEMENTS
    expect(first).toMatchObject({
      key: 'first-win',
      gameCenterId: 'com.example.game.first_win',
      steamApiName: 'ACH_FIRST_WIN',
      steamStat: null,
      playId: null,
      steps: null,
      hidden: false,
      earnedDescription: 'Player One takes the first trophy home.',
    })
    expect(tenWins).toMatchObject({ steps: 10, steamStat: 'STAT_TEN_WINS' })
    expect(silver).toMatchObject({
      gameCenterId: 'com.example.game.speedrun_silver',
      steamApiName: 'ACH_SPEEDRUN_SILVER',
    })
  })

  it('exposes the derivations and defaults the Game Center namespace and earned text', () => {
    expect(gameCenterId('com.example.game', 'ten-wins')).toBe('com.example.game.ten_wins')
    expect(steamApiName('ten-wins')).toBe('ACH_TEN_WINS')
    expect(steamStat('ten-wins')).toBe('STAT_TEN_WINS')
    const [a] = resolveAchievements([{ key: 'a', name: 'A', description: 'Do A.', points: 5 }])
    expect(a).toMatchObject({ gameCenterId: 'achievement.a', earnedDescription: 'Do A.' })
    expect(GAME_CENTER_NAMESPACE).toBe('com.example.game')
  })

  it('takes imported Play ids, and explicit ids over derived ones', () => {
    const resolved = resolveAchievements(
      [
        { key: 'first-win', name: 'First Win', description: 'Win.', points: 5 },
        {
          key: 'ten-wins',
          name: 'Ten Wins',
          description: 'Win ten.',
          points: 5,
          steps: 10,
          ids: {
            gameCenter: 'legacy.ten',
            steam: 'LEGACY_TEN',
            steamStat: 'LEGACY_TEN_STAT',
            play: 'CgkPlay',
          },
        },
      ],
      { playIds: { 'first-win': 'CgkFirst' } },
    )
    expect(resolved[0]?.playId).toBe('CgkFirst')
    expect(resolved[1]).toMatchObject({
      gameCenterId: 'legacy.ten',
      steamApiName: 'LEGACY_TEN',
      steamStat: 'LEGACY_TEN_STAT',
      playId: 'CgkPlay',
    })
    expect(resolveFixtures({ 'ten-wins': 'CgkTen' })[1]?.playId).toBe('CgkTen')
  })

  it('refuses a bad or duplicate key and steps that cannot be a progress bar', () => {
    const def = { name: 'N', description: 'D', points: 5 }
    expect(() => resolveAchievements([{ ...def, key: 'Bad Key' }])).toThrow(/not a valid key/)
    expect(() =>
      resolveAchievements([
        { ...def, key: 'a' },
        { ...def, key: 'a' },
      ]),
    ).toThrow(/duplicate/)
    for (const steps of [1, 2.5, 0]) {
      expect(() => resolveAchievements([{ ...def, key: 'a', steps }])).toThrow(/steps/)
    }
  })

  it('finds an achievement by key and throws on an unknown one', () => {
    expect(findAchievement(ACHIEVEMENTS, 'flawless').hidden).toBe(true)
    expect(() => findAchievement(ACHIEVEMENTS, 'nope')).toThrow(/unknown achievement nope/)
    expect(DEFINITIONS).toHaveLength(ACHIEVEMENTS.length)
  })
})

describe('what a platform still needs', () => {
  const earned = { 'first-win': 1, 'ten-wins': 7, 'speedrun:silver': 1 }

  it('is everything earned that it has not acknowledged, and progress when it can take it', () => {
    expect(keys(outstanding(ACHIEVEMENTS, earned, {}, { progress: true }))).toEqual([
      'first-win',
      'ten-wins=7',
      'speedrun:silver',
    ])
    expect(
      keys(outstanding(ACHIEVEMENTS, earned, { 'first-win': 1 }, { progress: false })),
    ).toEqual(['speedrun:silver'])
    expect(keys(outstanding(ACHIEVEMENTS, earned, { 'ten-wins': 7 }, { progress: true }))).toEqual([
      'first-win',
      'speedrun:silver',
    ])
  })

  it('reports only what was started: absent, zero and fractional earnings are nothing', () => {
    expect(outstanding(ACHIEVEMENTS, {}, {}, { progress: true })).toEqual([])
    expect(
      outstanding(ACHIEVEMENTS, { 'first-win': 0, 'ten-wins': 0.9 }, {}, { progress: true }),
    ).toEqual([])
  })

  it('reports an incremental achievement by its unlock once earned, and never progress at its last step', () => {
    expect(
      keys(outstanding(ACHIEVEMENTS, { 'ten-wins': 12 }, { 'ten-wins': 7 }, { progress: true })),
    ).toEqual(['ten-wins'])
    expect(
      outstanding(ACHIEVEMENTS, { 'ten-wins': 12 }, { 'ten-wins': 10 }, { progress: true }),
    ).toEqual([])
    expect(keys(outstanding(ACHIEVEMENTS, { 'ten-wins': 9.9 }, {}, { progress: true }))).toEqual([
      'ten-wins=9',
    ])
    // Without progress reporting an unfinished incremental achievement is not reported at all.
    expect(outstanding(ACHIEVEMENTS, { 'ten-wins': 9 }, {}, { progress: false })).toEqual([])
  })

  it('names the value a platform acknowledges for each report', () => {
    const [unlockFirst, progress, unlockTen] = [
      ...outstanding(ACHIEVEMENTS, { 'first-win': 1, 'ten-wins': 4 }, {}, { progress: true }),
      ...outstanding(ACHIEVEMENTS, { 'ten-wins': 10 }, {}, { progress: true }),
    ] as [Report, Report, Report]
    expect(ackValue(unlockFirst)).toBe(1)
    expect(ackValue(progress)).toBe(4)
    expect(ackValue(unlockTen)).toBe(10)
  })
})
