---
title: "platform-achievements"
description: Cross-platform game achievements for Google Play Games, Game Center and Steam, with an idempotent sync and store-console submission files.
---

`platform-achievements` mirrors a game's achievements to Google Play Games, Game Center and Steam. You
describe the achievements once. The package works out what each platform still needs, sends it, and
remembers what each platform confirmed, so the same call is correct on sign-in, on resume, after a
match, and after a week offline.

It has no runtime dependencies. The Capacitor game-services plugin and the `steamworks.js` client are
passed in, so the package carries no Capacitor or Steam version and every adapter is unit-testable
against a fake.

## Why use it?

| Problem | Convention |
| --- | --- |
| A report lost to a dropped connection is lost forever | Nothing is queued: what a platform still needs is always `earned − acknowledged` |
| Two platforms count progress differently | Progress is stored absolutely; adapters turn it into steps, percentage points or a stat |
| A repeated unlock call errors or double-counts | A platform's confirmation is recorded only after it arrives and never goes backwards, so a repeat sends nothing |
| Ids, point values and icons drift between the code and three consoles | Submission files are generated from the same list the game runs |
| A plugin import drags a native module into tests | Adapters are structural interfaces; tests pass a fake |

Start with [Getting started](./getting-started/), read how each service behaves in
[Platforms](./platforms/), then use the [API reference](./API/) and the
[architecture notes](./ARCHITECTURE/).
