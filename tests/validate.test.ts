import { describe, expect, it } from 'vitest'
import { CONSOLE_LIMITS, resolveAchievements, validateAchievements } from '../src'
import { ACHIEVEMENTS, resolveFixtures } from './support/fixtures'

const def = (key: string, over: Record<string, unknown> = {}) => ({
  key,
  name: `Name ${key}`,
  description: `Do ${key}.`,
  points: 5,
  ...over,
})
const messages = (defs: ReturnType<typeof def>[], playIds?: Record<string, string>) =>
  validateAchievements(resolveAchievements(defs, playIds ? { playIds } : {})).map(
    (i) => `${i.platform}${i.key ? ` ${i.key}` : ''}: ${i.message}`,
  )

describe('validating against the consoles’ limits', () => {
  it('accepts a list within every limit', () => {
    expect(validateAchievements(ACHIEVEMENTS)).toEqual([])
    expect(
      validateAchievements(resolveFixtures({ 'first-win': 'CgkA', 'ten-wins': 'CgkB' })),
    ).toEqual([])
  })

  it('rejects points that are not a multiple of 5 from 5 to 100', () => {
    for (const points of [0, 3, 7.5, 105]) {
      expect(messages([def('a', { points })])).toEqual([
        expect.stringMatching(/^game-center a: .*multiple of 5 from 5 to 100/),
      ])
    }
  })

  it('rejects too many achievements and too many points for Game Center', () => {
    const many = Array.from({ length: CONSOLE_LIMITS.achievements + 1 }, (_, i) =>
      def(`a${i}`, { points: 5 }),
    )
    expect(messages(many)).toEqual([expect.stringMatching(/^game-center: 101 achievements exceed/)])
    const heavy = Array.from({ length: 11 }, (_, i) => def(`h${i}`, { points: 100 }))
    expect(messages(heavy)).toEqual([expect.stringMatching(/^game-center: 1100 points exceed/)])
  })

  it('rejects steps beyond Play’s limit', () => {
    expect(messages([def('a', { steps: 10_001 })])).toEqual([
      expect.stringMatching(/^play a: 10001 steps exceed/),
    ])
  })

  it('rejects over-long or empty text', () => {
    expect(messages([def('a', { name: 'x'.repeat(101) })])).toEqual([
      expect.stringMatching(/name must be 1 to 100/),
    ])
    // The earned text defaults to the description, so a description that is too long is too long twice.
    expect(messages([def('a', { description: 'x'.repeat(501) })])).toEqual([
      expect.stringMatching(/^play a: description must be 1 to 500/),
      expect.stringMatching(/^play a: earned description must be 1 to 500/),
    ])
    expect(messages([def('a', { earnedDescription: 'x'.repeat(501) })])).toEqual([
      expect.stringMatching(/^play a: earned description must be 1 to 500/),
    ])
    expect(messages([def('a', { description: '', earnedDescription: '' })])).toEqual([
      expect.stringMatching(/^play a: description must be/),
      expect.stringMatching(/^play a: earned description must be/),
    ])
  })

  it('rejects ids Game Center would refuse', () => {
    expect(messages([def('a', { ids: { gameCenter: 'has space' } })])).toEqual([
      expect.stringMatching(/^game-center a: id has space must be letters/),
    ])
    const long = 'x'.repeat(101)
    expect(messages([def('a', { ids: { gameCenter: long } })])).toHaveLength(1)
  })

  it('rejects duplicates of anything a platform keys on', () => {
    expect(messages([def('a'), def('b', { name: 'Name a' })])).toEqual([
      'play b: duplicate name Name a',
    ])
    expect(messages([def('a'), def('b', { description: 'Do a.' })])).toEqual([
      'play b: duplicate description Do a.',
    ])
    // 'a-b' and 'a_b' derive the same ids on every platform.
    expect(messages([def('a-b'), def('a_b')])).toEqual([
      'game-center a_b: duplicate Game Center id achievement.a_b',
      'steam a_b: duplicate Steam API name ACH_A_B',
    ])
    expect(
      messages([def('a', { steps: 2 }), def('b', { steps: 2, ids: { steamStat: 'STAT_A' } })]),
    ).toEqual([expect.stringMatching(/duplicate Steam stat STAT_A/)])
    expect(messages([def('a'), def('b')], { a: 'CgkSame', b: 'CgkSame' })).toEqual([
      'play b: duplicate Play id CgkSame',
    ])
  })
})
