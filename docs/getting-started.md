---
title: Getting started
description: Install platform-achievements, describe achievements, pick an adapter and sync.
---

## Install

```sh
npm install platform-achievements
```

Node 24 or later. ESM and CommonJS are both shipped.

## 1. Describe the achievements

```ts
import { resolveAchievements } from 'platform-achievements'

export const achievements = resolveAchievements(
  [
    { key: 'first-win', name: 'First Win', description: 'Win your first match.', points: 5 },
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
  ],
  { gameCenterNamespace: 'com.example.game' },
)
```

A `key` is permanent: acknowledgements are stored under it, and ids on the platforms derive from it.
`gameCenterNamespace` is the prefix of the derived Game Center ids (`com.example.game.first_win`).
Game Center ids cannot be changed after release, so choose both once.

None of the three platforms has tiers. A game with bronze, silver and gold versions of an achievement
defines three achievements, such as `speedrun:bronze`, `speedrun:silver` and `speedrun:gold`.

## 2. Check the list against the consoles' limits

```ts
import { validateAchievements } from 'platform-achievements'

const issues = validateAchievements(achievements)
// [] when every console will accept the list; otherwise { key, platform, message } per problem
```

Put this in a unit test.

## 3. Choose an adapter

```ts
import { gameServicesAchievements } from 'platform-achievements/game-services'
import { steamAchievements } from 'platform-achievements/steam'
import { webAchievements } from 'platform-achievements/web'

const adapter =
  platform === 'android' ? gameServicesAchievements(gameServicesPlugin, 'play')
  : platform === 'ios' ? gameServicesAchievements(gameServicesPlugin, 'game-center')
  : platform === 'desktop' ? steamAchievements(steamClient) // null when Steam is not running
  : webAchievements
```

`gameServicesPlugin` is the object your Capacitor game-services plugin exports. `steamClient` is the
initialised `steamworks.js` client. Each adapter lists the methods it needs as an interface, so a
test passes a plain object with those methods.

## 4. Keep acknowledgements

Implement `AcknowledgementStore` over your save data or database:

```ts
import type { AcknowledgementStore } from 'platform-achievements'

const store: AcknowledgementStore = {
  durable: true, // acknowledgements survive a restart
  acks: (platform) => load(platform), // { 'first-win': 1, 'ten-wins': 7 }
  ack: (platform, key, value) => saveMax(platform, key, value), // never lower a stored value
}
```

`MemoryAcknowledgementStore` is the same interface in memory. It is not durable, so Play Games and
Game Center are sent unlocks only, never progress: without a durable record of what was already
added, an add-only API could count the same steps twice.

## 5. Sync

```ts
import { syncAchievements } from 'platform-achievements'

const result = await syncAchievements({
  achievements,
  earned, // { 'first-win': 1, 'ten-wins': 7 } from your save data
  adapter,
  store,
})
```

Call it on sign-in, on app resume and after earning something, as often as you like; log
`result.errors`. Run one sync per platform at a time: two overlapping syncs would both read the same
acknowledgements and could send the same report twice.

## 6. Generate the console files

```ts
import { submission } from 'platform-achievements/export'

const { files, icons } = submission(achievements, { locale: 'en-US' })
```

See [Platforms](../platforms/) for what each console imports and how to bring the Play Console's
generated ids back into `resolveAchievements`.
