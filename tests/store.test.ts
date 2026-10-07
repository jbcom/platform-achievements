import { describe, expect, it } from 'vitest'
import { MemoryAcknowledgementStore } from '../src'

describe('the in-memory store', () => {
  it('keeps acknowledgements per platform and never lowers one', async () => {
    const store = new MemoryAcknowledgementStore()
    await store.ack('steam', 'ten-wins', 7)
    await store.ack('steam', 'ten-wins', 3)
    expect(await store.acks('steam')).toEqual({ 'ten-wins': 7 })
    expect(await store.acks('play')).toEqual({})
    expect(store.durable).toBe(false)
  })

  it('hands out copies, so a caller cannot edit what was acknowledged', async () => {
    const store = new MemoryAcknowledgementStore()
    await store.ack('steam', 'first-win', 1)
    const held = (await store.acks('steam')) as Record<string, number>
    held['first-win'] = 0
    expect(await store.acks('steam')).toEqual({ 'first-win': 1 })
  })
})
