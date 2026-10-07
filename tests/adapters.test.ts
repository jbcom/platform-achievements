import { describe, expect, it } from 'vitest'
import type { PlatformAchievement } from '../src'
import { type GameServicesPlugin, gameServicesAchievements } from '../src/adapters/game-services'
import {
  STEAM_ACHIEVEMENTS_DIALOG,
  type SteamClient,
  steamAchievements,
} from '../src/adapters/steam'
import { webAchievements } from '../src/adapters/web'
import { achievement } from './support/fixtures'

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

const tenWins = achievement('ten-wins')
const gold = achievement('speedrun:gold')
const withPlayId = (a: PlatformAchievement): PlatformAchievement => ({
  ...a,
  playId: `Cgk-${a.key}`,
})

describe('the Play Games and Game Center adapter', () => {
  it('unlocks by the Game Center id, and sends progress as percentage points from the acknowledged value', async () => {
    const { plugin, calls } = fakePlugin()
    const gc = gameServicesAchievements(plugin, 'game-center')
    expect(gc.platform).toBe('game-center')
    expect(await gc.signedIn()).toBe(true)
    expect(gc.knows(gold)).toBe(true)
    await gc.unlock(gold)
    await gc.setProgress(tenWins, 7, 4)
    await gc.setProgress(tenWins, 4, 4)
    await gc.show()
    expect(calls).toEqual([
      'unlock com.example.game.speedrun_gold',
      'increment com.example.game.ten_wins 30',
      'show',
    ])
  })

  it('on Play, addresses only achievements with a console id and sends whole steps', async () => {
    const { plugin, calls } = fakePlugin(false)
    const play = gameServicesAchievements(plugin, 'play')
    expect(play.platform).toBe('play')
    expect(await play.signedIn()).toBe(false)
    expect(play.knows(gold)).toBe(false)
    await expect(play.unlock(gold)).rejects.toThrow(/no Play Console id/)
    await play.setProgress(withPlayId(tenWins), 7, 4)
    await play.unlock(withPlayId(gold))
    expect(calls).toEqual(['increment Cgk-ten-wins 3', 'unlock Cgk-speedrun:gold'])
  })

  it('refuses progress for a standard achievement', async () => {
    const { plugin } = fakePlugin()
    await expect(
      gameServicesAchievements(plugin, 'game-center').setProgress(gold, 1, 0),
    ).rejects.toThrow(/not incremental/)
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
    expect(steam.platform).toBe('steam')
    expect(await steam.signedIn()).toBe(true)
    expect(steam.knows(gold)).toBe(true)
    await steam.setProgress(tenWins, 7, 0)
    await steam.unlock(tenWins)
    await steam.unlock(gold)
    await steam.show()
    expect(calls).toEqual([
      'set STAT_TEN_WINS 7',
      'store',
      'set STAT_TEN_WINS 10',
      'activate ACH_TEN_WINS',
      'store',
      'activate ACH_SPEEDRUN_GOLD',
      'store',
      `dialog ${STEAM_ACHIEVEMENTS_DIALOG}`,
    ])
  })

  it('throws when Steam refuses, so the report stays outstanding; without Steam it is signed out', async () => {
    const { client } = fakeSteam(new Set(['ACH_SPEEDRUN_GOLD']))
    await expect(steamAchievements(client).unlock(gold)).rejects.toThrow(
      /Steam refused ACH_SPEEDRUN_GOLD/,
    )
    const none = steamAchievements(null)
    expect(await none.signedIn()).toBe(false)
    await expect(none.unlock(gold)).rejects.toThrow(/not running/)
    await expect(none.show()).rejects.toThrow(/not running/)
  })

  it('throws when Steam refuses a stat or the store, and for progress on a standard achievement', async () => {
    const refusing: SteamClient = {
      achievement: { activate: () => true },
      stats: { setInt: () => false, store: () => false },
      overlay: { activateDialog: () => {} },
    }
    await expect(steamAchievements(refusing).setProgress(tenWins, 3, 0)).rejects.toThrow(
      /STAT_TEN_WINS = 3/,
    )
    const storing: SteamClient = { ...refusing, stats: { setInt: () => true, store: () => false } }
    await expect(steamAchievements(storing).unlock(gold)).rejects.toThrow(/storing stats/)
    await expect(steamAchievements(storing).setProgress(gold, 1, 0)).rejects.toThrow(
      /not incremental/,
    )
  })
})

describe('the web adapter', () => {
  it('is never signed in, reports nothing, and has no screen to show', async () => {
    expect(webAchievements.platform).toBeNull()
    expect(webAchievements.reportsProgress).toBe(false)
    expect(await webAchievements.signedIn()).toBe(false)
    expect(webAchievements.knows(gold)).toBe(false)
    await expect(webAchievements.unlock(gold)).rejects.toThrow(/no achievements service on the web/)
    await expect(webAchievements.setProgress(tenWins, 1, 0)).rejects.toThrow(/on the web/)
    await expect(webAchievements.show()).resolves.toBeUndefined()
  })
})
