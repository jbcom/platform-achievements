---
title: Architecture
description: Module boundaries, invariants and intentional limits of platform-achievements.
---

## Modules

| Module | Role |
| --- | --- |
| `platform.ts` | The model: definitions, `resolveAchievements`, `outstanding`, and the adapter contract |
| `sync.ts` | `syncAchievements`: the only code that talks to an adapter and a store together |
| `store.ts` | The `AcknowledgementStore` interface and an in-memory implementation |
| `validate.ts` | Console limits and `validateAchievements` |
| `adapters/*.ts` | One file per platform, each depending on `platform.ts` types only |
| `export/*.ts` | Pure submission writers, one file per console, plus CSV and ZIP helpers |

The root entry point re-exports `platform`, `store`, `sync` and `validate`. Adapters and `export` are
separate entry points, so an app that ships only the Steam build never bundles the Play adapter.

## Invariants

1. **Nothing is queued.** The only state is what the game has earned and what each platform has
   acknowledged. Outstanding work is a pure function of the two (`outstanding`).
2. **Acknowledge after confirmation.** `syncAchievements` records a value only after the adapter's call
   resolved, and a store never lowers a value.
3. **Progress is absolute in the model** and translated per platform inside the adapter (steps,
   percentage points, a stat).
4. **No runtime dependencies and no platform imports.** Adapters take structural interfaces. A change
   that imports Capacitor, a Play Games plugin or `steamworks.js` is wrong.
5. **A failure is data.** A refused report becomes an entry in `SyncResult.errors`; one failure never
   stops the rest and nothing throws out of `syncAchievements` for an adapter error.
6. **Export is pure.** Writers return strings and icon descriptions; the caller touches the file system and
   draws the icons.

## Intentional limits

- An add-only platform with a non-durable store gets unlocks only. Sending progress there would add the
  same steps again after a restart.
- One sync at a time per platform. The store has no locking.
- No tiers, repeatable achievements, or leaderboards. Tiered achievements are separate achievements.
- No Play Console API calls. The Play ids come back through the resources file the console offers.
