/**
 * Mirroring achievements to the platforms (docs/design/07-meta.md, Storage and sync; Submission files): what a
 * platform still needs (earned less acknowledged), the sync's offline and failure safety and its idempotence, the
 * Play Games / Game Center, Steam and web adapters against fakes of their SDKs, the in-memory store, and the generated
 * Play Console, App Store Connect and Steamworks files.
 */
import { describe, expect, it } from 'vitest'
import type { AchievementProgress } from '@/game/meta/achievements/evaluate'
import { platformText, playIdsFromResources, submission } from '@/game/meta/achievements/export'
import {
  outstanding,
  PLATFORM_ACHIEVEMENTS,
  type PlatformAchievement,
  type PlatformAchievements,
  platformAchievement,
} from '@/game/meta/achievements/platform'
import { MemoryAchievementStore } from '@/game/meta/achievements/store'
import { syncAchievements } from '@/game/meta/achievements/sync'
import {
  type GameServicesPlugin,
  gameServicesAchievements,
} from '@/platform/achievements/gameServices'
import { type SteamClient, steamAchievements } from '@/platform/achievements/steam'
import { webAchievements } from '@/platform/achievements/web'
import { type StringKey, t } from '@/ui/text/t'

const text = (key: string, params?: Readonly<Record<string, string | number>>) =>
  t(key as StringKey, params)
const keys = (reports: ReturnType<typeof outstanding>) =>
  reports.map((r) =>
    r.kind === 'progress' ? `${r.achievement.key}=${r.steps}` : r.achievement.key,
  )

const progress: AchievementProgress = {
  'darkness-falls': { grade: 'silver', best: 6 },
  'the-hunt': { grade: null, best: 1 },
  undying: { grade: null, best: 7 },
}

describe('what a platform still needs', () => {
  it('is every grade earned that it has not acknowledged, and progress when it can take it', () => {
    expect(keys(outstanding(progress, {}, { progress: true }))).toEqual([
      'darkness-falls:bronze',
      'darkness-falls:silver',
      'undying:bronze=7',
    ])
    expect(
      keys(outstanding(progress, { 'darkness-falls:bronze': 1 }, { progress: false })),
    ).toEqual(['darkness-falls:silver'])
    expect(keys(outstanding(progress, { 'undying:bronze': 7 }, { progress: true }))).toEqual([
      'darkness-falls:bronze',
      'darkness-falls:silver',
    ])
  })

  it('reports an incremental achievement by its unlock once earned, and never progress at its last step', () => {
    const done: AchievementProgress = { undying: { grade: 'bronze', best: 12 } }
    expect(keys(outstanding(done, { 'undying:bronze': 7 }, { progress: true }))).toEqual([
      'undying:bronze',
    ])
    expect(keys(outstanding(done, { 'undying:bronze': 10 }, { progress: true }))).toEqual([])
    const nearly: AchievementProgress = { undying: { grade: null, best: 15 } }
    expect(keys(outstanding(nearly, {}, { progress: true }))).toEqual(['undying:bronze=9'])
  })
})

/** A fake platform recording what it was sent; `failOn` keys throw once. */
function fakePlatform(over: Partial<PlatformAchievements> = {}, failOn = new Set<string>()) {
  const sent: string[] = []
  const adapter: PlatformAchievements = {
    platform: 'game-center',
    reportsProgress: true,
    signedIn: async () => true,
    knows: () => true,
    unlock: async (a) => {
      if (failOn.delete(a.key)) throw new Error(`offline at ${a.key}`)
      sent.push(a.key)
    },
    setProgress: async (a, steps) => {
      sent.push(`${a.key}=${steps}`)
    },
    show: async () => {},
    ...over,
  }
  return { adapter, sent }
}

/** A store whose acknowledgements outlive the session, as the SQLite one will. */
class DurableStore extends MemoryAchievementStore {
  override readonly durable = true
}

describe('syncing', () => {
  it('sends nothing while signed out, and nothing is lost', async () => {
    const store = new MemoryAchievementStore()
    const { adapter, sent } = fakePlatform({ signedIn: async () => false })
    expect(await syncAchievements(progress, adapter, store)).toMatchObject({
      signedIn: false,
      sent: 0,
    })
    expect(sent).toEqual([])
    expect(await store.acks('game-center')).toEqual({})
  })

  it('a failed report stays outstanding and goes on the next sync; then nothing is sent twice', async () => {
    const store = new DurableStore()
    const { adapter, sent } = fakePlatform({}, new Set(['darkness-falls:silver']))
    const first = await syncAchievements(progress, adapter, store)
    expect(first).toMatchObject({ sent: 2, failed: 1 })
    expect(first.errors).toEqual([
      { key: 'darkness-falls:silver', message: 'offline at darkness-falls:silver' },
    ])
    expect(sent).toEqual(['darkness-falls:bronze', 'undying:bronze=7'])
    const second = await syncAchievements(progress, adapter, store)
    expect(second).toMatchObject({ sent: 1, failed: 0 })
    expect(sent.at(-1)).toBe('darkness-falls:silver')
    expect(await syncAchievements(progress, adapter, store)).toMatchObject({ sent: 0, failed: 0 })
  })

  it('without durable acknowledgements an add-only platform is sent unlocks only', async () => {
    const { adapter, sent } = fakePlatform()
    await syncAchievements(progress, adapter, new MemoryAchievementStore())
    expect(sent).toEqual(['darkness-falls:bronze', 'darkness-falls:silver'])
  })

  it('counts what the platform cannot address yet (Play before its ids are imported) and leaves it outstanding', async () => {
    const store = new DurableStore()
    const { adapter } = fakePlatform({ platform: 'play', knows: () => false })
    expect(await syncAchievements(progress, adapter, store)).toMatchObject({
      sent: 0,
      unaddressed: 3,
    })
    expect(await store.acks('play')).toEqual({})
  })

  it('the web is mirrored nowhere', async () => {
    expect(await syncAchievements(progress, webAchievements, new DurableStore())).toMatchObject({
      signedIn: false,
      sent: 0,
    })
  })
})

describe('the in-memory store', () => {
  it('keeps acknowledgements per platform and never lowers one', async () => {
    const store = new MemoryAchievementStore()
    await store.ack('steam', 'undying:bronze', 7)
    await store.ack('steam', 'undying:bronze', 3)
    expect(await store.acks('steam')).toEqual({ 'undying:bronze': 7 })
    expect(await store.acks('play')).toEqual({})
    expect(store.durable).toBe(false)
  })
})

function fakePlugin(signedIn = true) {
  const calls: string[] = []
  const plugin: GameServicesPlugin = {
    isSignedIn: async () => ({ signedIn }),
    unlockAchievement: async ({ id }) => {
      calls.push(`unlock ${id}`)
    },
    incrementAchievement: async ({ id, steps }) => {
      calls.push(`increment ${id} ${steps}`)
    },
    showAchievements: async () => {
      calls.push('show')
    },
  }
  return { plugin, calls }
}

const undying = platformAchievement('undying:bronze')
const darknessGold = platformAchievement('darkness-falls:gold')
const withPlayId = (a: PlatformAchievement): PlatformAchievement => ({
  ...a,
  playId: `Cgk${a.key}`,
})

describe('the Play Games and Game Center adapter', () => {
  it('unlocks by the Game Center id, and sends progress as percentage points from the acknowledged value', async () => {
    const { plugin, calls } = fakePlugin()
    const gc = gameServicesAchievements(plugin, 'game-center')
    expect(await gc.signedIn()).toBe(true)
    expect(gc.knows(darknessGold)).toBe(true)
    await gc.unlock(darknessGold)
    await gc.setProgress(undying, 7, 4)
    await gc.setProgress(undying, 4, 4)
    await gc.show()
    expect(calls).toEqual([
      'unlock cotm.darkness_falls.gold',
      'increment cotm.undying.bronze 30',
      'show',
    ])
  })

  it('on Play, addresses only achievements with a console id and sends whole steps', async () => {
    const { plugin, calls } = fakePlugin(false)
    const play = gameServicesAchievements(plugin, 'play')
    expect(await play.signedIn()).toBe(false)
    expect(play.knows(darknessGold)).toBe(false)
    await expect(play.unlock(darknessGold)).rejects.toThrow(/no Play Console id/)
    await play.setProgress(withPlayId(undying), 7, 4)
    await play.unlock(withPlayId(darknessGold))
    expect(calls).toEqual(['increment Cgkundying:bronze 3', 'unlock Cgkdarkness-falls:gold'])
  })
})

function fakeSteam(refuse = new Set<string>()) {
  const calls: string[] = []
  const client: SteamClient = {
    achievement: {
      activate: (name) => {
        calls.push(`activate ${name}`)
        return !refuse.has(name)
      },
    },
    stats: {
      setInt: (name, value) => {
        calls.push(`set ${name} ${value}`)
        return true
      },
      store: () => {
        calls.push('store')
        return true
      },
    },
    overlay: { activateDialog: (d) => calls.push(`dialog ${d}`) },
  }
  return { client, calls }
}

describe('the Steam adapter', () => {
  it('sets progress stats absolutely, fills the stat on unlock, and stores every change', async () => {
    const { client, calls } = fakeSteam()
    const steam = steamAchievements(client)
    expect(await steam.signedIn()).toBe(true)
    await steam.setProgress(undying, 7, 0)
    await steam.unlock(undying)
    await steam.unlock(darknessGold)
    await steam.show()
    expect(calls).toEqual([
      'set STAT_UNDYING 7',
      'store',
      'set STAT_UNDYING 10',
      'activate ACH_UNDYING_BRONZE',
      'store',
      'activate ACH_DARKNESS_FALLS_GOLD',
      'store',
      'dialog 6',
    ])
  })

  it('throws when Steam refuses, so the report stays outstanding; without Steam it is signed out', async () => {
    const { client } = fakeSteam(new Set(['ACH_DARKNESS_FALLS_GOLD']))
    await expect(steamAchievements(client).unlock(darknessGold)).rejects.toThrow(/refused/)
    expect(await steamAchievements(null).signedIn()).toBe(false)
  })
})

describe('the submission files', () => {
  const { files, icons } = submission(text)
  const rows = (path: string) => (files[path] ?? '').trimEnd().split('\n')

  it('Play Console: a headerless seven-column metadata row per platform achievement, with localisations and icons', () => {
    const metadata = rows('play/AchievementsMetadata.csv')
    expect(metadata).toHaveLength(PLATFORM_ACHIEVEMENTS.length)
    expect(metadata[0]).toBe('The Hunt (Bronze),Claim 2 intruders in one run.,False,,Revealed,5,1')
    expect(metadata.find((r) => r.startsWith('Undying,'))).toBe(
      'Undying,"Climb 10 times, however each climb ends.",True,10,Revealed,5,24',
    )
    expect(metadata.find((r) => r.startsWith('No Mercy,'))).toContain(',Hidden,')
    expect(rows('play/AchievementsLocalizations.csv')[0]).toBe(
      'The Hunt (Bronze),The Hunt (Bronze),Claim 2 intruders in one run.,en-US',
    )
    expect(rows('play/AchievementsIconsMappings.csv')[0]).toBe(
      'The Hunt (Bronze),the-hunt-bronze.png',
    )
  })

  it('App Store Connect: a record per platform achievement with its permanent id, points and both descriptions', () => {
    const records = JSON.parse(files['app-store-connect/app-store-connect.json'] ?? '[]')
    expect(records).toHaveLength(PLATFORM_ACHIEVEMENTS.length)
    expect(records[0]).toEqual({
      referenceName: 'The Hunt (Bronze)',
      vendorIdentifier: 'cotm.the_hunt.bronze',
      points: 5,
      showBeforeEarned: true,
      repeatable: false,
      localizations: [
        {
          locale: 'en-US',
          name: 'The Hunt (Bronze)',
          beforeEarnedDescription: 'Claim 2 intruders in one run.',
          afterEarnedDescription: 'The expedition learned what hunts these halls.',
          image: 'the-hunt-bronze.png',
        },
      ],
    })
  })

  it('Steamworks: achievements with hidden flags and icons, and Undying’s progress stat', () => {
    const steam = JSON.parse(files['steamworks/steamworks.json'] ?? '{}')
    expect(steam.achievements).toHaveLength(PLATFORM_ACHIEVEMENTS.length)
    expect(steam.stats).toEqual([
      {
        apiName: 'STAT_UNDYING',
        type: 'INT',
        displayName: 'Undying',
        min: 0,
        max: 10,
        defaultValue: 0,
        incrementOnly: true,
        setBy: 'Client',
        unlocks: 'ACH_UNDYING_BRONZE',
      },
    ])
    expect(
      steam.achievements.find((a: { apiName: string }) => a.apiName === 'ACH_UNDYING_BRONZE'),
    ).toMatchObject({
      progressStat: 'STAT_UNDYING',
      unachievedIcon: 'undying-bronze-locked.jpg',
    })
  })

  it('lists every icon at each platform’s size and format', () => {
    expect(icons).toHaveLength(PLATFORM_ACHIEVEMENTS.length * 4)
    const sizes = new Set(
      icons.map((i) => `${i.path.split('/')[0]} ${i.size} ${i.format} ${i.locked}`),
    )
    expect([...sizes].sort()).toEqual([
      'app-store-connect 1024 png false',
      'play 512 png false',
      'steamworks 256 jpeg false',
      'steamworks 256 jpeg true',
    ])
  })

  it('reads Play’s console-generated ids back from its resources file by the exported names', () => {
    const name = (key: string) => platformText(platformAchievement(key), text).name
    const resource = (key: string) =>
      `achievement_${name(key)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')}`
    const xml = `<?xml version="1.0"?><resources>
      <string name="app_id" translatable="false">123</string>
      <string name="${resource('the-hunt:bronze')}" translatable="false">CgkI1</string>
      <string name="${resource('undying:bronze')}" translatable="false">CgkI2</string>
    </resources>`
    expect(resource('the-hunt:bronze')).toBe('achievement_the_hunt_bronze')
    expect(playIdsFromResources(xml, text)).toEqual({
      'the-hunt:bronze': 'CgkI1',
      'undying:bronze': 'CgkI2',
    })
  })
})
