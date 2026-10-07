import { describe, expect, it } from 'vitest'
import {
  appStoreConnectSubmission,
  csvField,
  csvRow,
  playConsoleSubmission,
  playIdsFromResources,
  steamworksSubmission,
  submission,
} from '../src/export'
import { ACHIEVEMENTS } from './support/fixtures'

describe('the submission files', () => {
  const { files, icons } = submission(ACHIEVEMENTS)
  const rows = (path: string) => (files[path] ?? '').trimEnd().split('\n')

  it('Play Console: a headerless seven-column metadata row per achievement, with localisations and icons', () => {
    const metadata = rows('play/AchievementsMetadata.csv')
    expect(metadata).toHaveLength(ACHIEVEMENTS.length)
    expect(metadata[0]).toBe('First Win,Win your first match.,False,,Revealed,5,1')
    expect(metadata[1]).toBe('Ten Wins,"Win 10 matches, in any mode.",True,10,Revealed,10,2')
    expect(metadata[2]).toContain(',Hidden,')
    expect(rows('play/AchievementsLocalizations.csv')[0]).toBe(
      'First Win,First Win,Win your first match.,en-US',
    )
    expect(rows('play/AchievementsIconsMappings.csv')[3]).toBe(
      'Speedrun (Silver),speedrun-silver.png',
    )
  })

  it('writes the locale it is given', () => {
    const french = playConsoleSubmission(ACHIEVEMENTS, { locale: 'fr-FR' })
    expect(french.files['play/AchievementsLocalizations.csv']).toContain(',fr-FR\n')
    const records = JSON.parse(
      appStoreConnectSubmission(ACHIEVEMENTS, { locale: 'fr-FR' }).files[
        'app-store-connect/app-store-connect.json'
      ] ?? '[]',
    )
    expect(records[0].localizations[0].locale).toBe('fr-FR')
  })

  it('App Store Connect: a record per achievement with its permanent id, points and both descriptions', () => {
    const records = JSON.parse(files['app-store-connect/app-store-connect.json'] ?? '[]')
    expect(records).toHaveLength(ACHIEVEMENTS.length)
    expect(records[0]).toEqual({
      referenceName: 'First Win',
      vendorIdentifier: 'com.example.game.first_win',
      points: 5,
      showBeforeEarned: true,
      repeatable: false,
      localizations: [
        {
          locale: 'en-US',
          name: 'First Win',
          beforeEarnedDescription: 'Win your first match.',
          afterEarnedDescription: 'Player One takes the first trophy home.',
          image: 'first-win.png',
        },
      ],
    })
    expect(records[2].showBeforeEarned).toBe(false)
  })

  it('Steamworks: achievements with hidden flags and icons, and the progress stat of an incremental one', () => {
    const steam = JSON.parse(files['steamworks/steamworks.json'] ?? '{}')
    expect(steam.achievements).toHaveLength(ACHIEVEMENTS.length)
    expect(steam.stats).toEqual([
      {
        apiName: 'STAT_TEN_WINS',
        type: 'INT',
        displayName: 'Ten Wins',
        min: 0,
        max: 10,
        defaultValue: 0,
        incrementOnly: true,
        setBy: 'Client',
        unlocks: 'ACH_TEN_WINS',
      },
    ])
    expect(
      steam.achievements.find((a: { apiName: string }) => a.apiName === 'ACH_TEN_WINS'),
    ).toMatchObject({
      progressStat: 'STAT_TEN_WINS',
      hidden: false,
      achievedIcon: 'ten-wins.jpg',
      unachievedIcon: 'ten-wins-locked.jpg',
    })
    expect(
      steam.achievements.find((a: { apiName: string }) => a.apiName === 'ACH_FLAWLESS').hidden,
    ).toBe(true)
    expect(steamworksSubmission(ACHIEVEMENTS).icons).toHaveLength(ACHIEVEMENTS.length * 2)
  })

  it('lists every icon at each platform’s size and format', () => {
    expect(icons).toHaveLength(ACHIEVEMENTS.length * 4)
    const sizes = new Set(
      icons.map((i) => `${i.path.split('/')[0]} ${i.size} ${i.format} ${i.locked}`),
    )
    expect([...sizes].sort()).toEqual([
      'app-store-connect 1024 png false',
      'play 512 png false',
      'steamworks 256 jpeg false',
      'steamworks 256 jpeg true',
    ])
    expect(icons.find((i) => i.key === 'speedrun:gold' && i.size === 512)?.path).toBe(
      'play/speedrun-gold.png',
    )
  })

  it('has no file name that leaves its directory or repeats', () => {
    const paths = icons.map((i) => i.path)
    expect(new Set(paths).size).toBe(paths.length)
    for (const path of [...paths, ...Object.keys(files)])
      expect(path).toMatch(/^[a-z-]+\/[A-Za-z0-9._-]+$/)
  })
})

describe('reading Play’s console-generated ids back', () => {
  it('matches the resources file by the exported names', () => {
    const xml = `<?xml version="1.0"?><resources>
      <string name="app_id" translatable="false">123</string>
      <string name="achievement_first_win" translatable="false">CgkI1</string>
      <string name="achievement_speedrun_gold" translatable="false"> CgkI2 </string>
      <string name="achievement_something_else" translatable="false">CgkI3</string>
    </resources>`
    expect(playIdsFromResources(xml, ACHIEVEMENTS)).toEqual({
      'first-win': 'CgkI1',
      'speedrun:gold': 'CgkI2',
    })
  })

  it('finds nothing in a file with no achievement strings', () => {
    expect(playIdsFromResources('<resources></resources>', ACHIEVEMENTS)).toEqual({})
  })
})

describe('CSV', () => {
  it('quotes a field holding a comma, a quote or a line break, and nothing else', () => {
    expect(csvField('plain')).toBe('plain')
    expect(csvField(5)).toBe('5')
    expect(csvField('a,b')).toBe('"a,b"')
    expect(csvField('say "hi"')).toBe('"say ""hi"""')
    expect(csvField('one\ntwo')).toBe('"one\ntwo"')
    expect(csvRow(['a', 'b,c', 3])).toBe('a,"b,c",3')
  })
})
