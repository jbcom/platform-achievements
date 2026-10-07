/**
 * Where acknowledgements live. A platform's confirmation is recorded only after the platform has
 * confirmed it, and survives restarts when the store is durable: that is what makes the sync idempotent.
 */
import type { AchievementPlatform, Acks } from './platform.js'

export interface AcknowledgementStore {
  /**
   * Whether acknowledgements outlive the session. An add-only platform API (Play Games, Game Center)
   * can be sent progress only when they do; otherwise it is sent unlocks only.
   */
  readonly durable: boolean
  /** Everything `platform` has acknowledged, by achievement key. */
  acks(platform: AchievementPlatform): Promise<Acks>
  /**
   * Record that `platform` acknowledged `value` for `key`. Never lowers a recorded value, so a late or
   * repeated write cannot walk progress backwards.
   */
  ack(platform: AchievementPlatform, key: string, value: number): Promise<void>
}

/**
 * An in-memory store for tests and for builds with no storage. It is not durable, so progress to an
 * add-only platform is withheld and only unlocks are sent.
 */
export class MemoryAcknowledgementStore implements AcknowledgementStore {
  readonly durable: boolean = false
  readonly #acks = new Map<AchievementPlatform, Record<string, number>>()

  async acks(platform: AchievementPlatform): Promise<Acks> {
    return { ...(this.#acks.get(platform) ?? {}) }
  }

  async ack(platform: AchievementPlatform, key: string, value: number): Promise<void> {
    const held = this.#acks.get(platform) ?? {}
    held[key] = Math.max(held[key] ?? 0, value)
    this.#acks.set(platform, held)
  }
}
