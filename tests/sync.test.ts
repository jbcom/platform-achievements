import { describe, expect, it } from 'vitest'
import { type AcknowledgementStore, MemoryAcknowledgementStore, syncAchievements } from '../src'
import { webAchievements } from '../src/adapters/web'
import { ACHIEVEMENTS, fakeAdapter } from './support/fixtures'

const earned = { 'first-win': 1, 'ten-wins': 7, 'speedrun:silver': 1 }

/** A store whose acknowledgements outlive the session, as a database-backed one would. */
class DurableStore extends MemoryAcknowledgementStore {
  override readonly durable = true
}

const sync = (adapter: ReturnType<typeof fakeAdapter>['adapter'], store: AcknowledgementStore) =>
  syncAchievements({ achievements: ACHIEVEMENTS, earned, adapter, store })

describe('syncing', () => {
  it('sends nothing while signed out, and nothing is lost', async () => {
    const store = new MemoryAcknowledgementStore()
    const { adapter, calls } = fakeAdapter({ signedIn: false })
    expect(await sync(adapter, store)).toMatchObject({ signedIn: false, sent: 0 })
    expect(calls).toEqual([])
    expect(await store.acks('steam')).toEqual({})
  })

  it('a failed report stays outstanding and goes on the next sync; then nothing is sent twice', async () => {
    const store = new DurableStore()
    let failing = true
    const { adapter, calls } = fakeAdapter({
      fail: (call) => failing && call === 'unlock speedrun:silver',
    })
    const first = await sync(adapter, store)
    expect(first).toMatchObject({ sent: 2, failed: 1, unaddressed: 0, signedIn: true })
    expect(first.errors).toEqual([
      { key: 'speedrun:silver', message: 'refused unlock speedrun:silver' },
    ])
    expect(calls).toEqual(['unlock first-win', 'progress ten-wins 7 from 0'])

    failing = false
    expect(await sync(adapter, store)).toMatchObject({ sent: 1, failed: 0 })
    expect(calls.at(-1)).toBe('unlock speedrun:silver')
    expect(await sync(adapter, store)).toMatchObject({ sent: 0, failed: 0 })
    expect(calls).toHaveLength(3)
  })

  it('sends only the difference once a later sync has more progress', async () => {
    const store = new DurableStore()
    const { adapter, calls } = fakeAdapter()
    await sync(adapter, store)
    await syncAchievements({
      achievements: ACHIEVEMENTS,
      earned: { ...earned, 'ten-wins': 10 },
      adapter,
      store,
    })
    expect(calls.slice(3)).toEqual(['unlock ten-wins'])
    expect(await store.acks('steam')).toMatchObject({ 'ten-wins': 10 })
  })

  it('without durable acknowledgements an add-only platform is sent unlocks only', async () => {
    const { adapter, calls } = fakeAdapter()
    await sync(adapter, new MemoryAcknowledgementStore())
    expect(calls).toEqual(['unlock first-win', 'unlock speedrun:silver'])
  })

  it('an adapter that cannot report progress is sent unlocks only, even with a durable store', async () => {
    const { adapter, calls } = fakeAdapter({ reportsProgress: false })
    await sync(adapter, new DurableStore())
    expect(calls).toEqual(['unlock first-win', 'unlock speedrun:silver'])
  })

  it('counts what the platform cannot address yet and leaves it outstanding', async () => {
    const store = new DurableStore()
    const { adapter } = fakeAdapter({ platform: 'play', knows: () => false })
    expect(await sync(adapter, store)).toMatchObject({ sent: 0, unaddressed: 3 })
    expect(await store.acks('play')).toEqual({})
  })

  it('keeps each platform’s acknowledgements apart', async () => {
    const store = new DurableStore()
    await sync(fakeAdapter({ platform: 'steam' }).adapter, store)
    const play = fakeAdapter({ platform: 'play' })
    expect(await sync(play.adapter, store)).toMatchObject({ sent: 3 })
  })

  it('records a non-Error failure by its text', async () => {
    const { adapter } = fakeAdapter()
    const thrower = {
      ...adapter,
      unlock: async () => {
        throw 'plugin said no'
      },
    }
    const result = await sync(thrower, new MemoryAcknowledgementStore())
    expect(result.errors[0]).toEqual({ key: 'first-win', message: 'plugin said no' })
  })

  it('the web is mirrored nowhere', async () => {
    expect(await sync(webAchievements, new DurableStore())).toMatchObject({
      signedIn: false,
      sent: 0,
    })
  })
})
