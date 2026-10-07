---
title: API reference
description: Every export of platform-achievements, by entry point.
---

## `platform-achievements`

### `resolveAchievements(definitions, options?)`

Turns `AchievementDefinition[]` into `PlatformAchievement[]`, in list order.

| `AchievementDefinition` field | Meaning |
| --- | --- |
| `key` | Permanent key: lowercase letters and digits with single `-`, `_`, `.` or `:` separators |
| `name`, `description` | What players see. Each unique across the list |
| `earnedDescription?` | Game Center's after-earned text. Defaults to `description` |
| `points` | A multiple of 5 from 5 to 100 is valid on Play Games and Game Center |
| `hidden?` | Hidden until earned. Default `false` |
| `steps?` | Total steps of an incremental achievement, a whole number of at least 2 |
| `ids?` | `gameCenter`, `steam`, `steamStat`, `play`: ids an achievement already has, replacing derived ones |

| `ResolveOptions` field | Meaning |
| --- | --- |
| `gameCenterNamespace?` | Prefix for derived Game Center ids. Default `achievement` |
| `playIds?` | The Play Console's generated ids by key |

A `PlatformAchievement` has every definition field resolved plus `order` (from 1), `steps` (`null` for
a standard achievement), `gameCenterId`, `steamApiName`, `steamStat` (`null` unless incremental) and
`playId` (`null` until known).

Throws `RangeError` for an invalid or duplicate key, or `steps` below 2 or not whole.

### `findAchievement(achievements, key)`

The achievement with `key`; throws `RangeError` when there is none.

### `gameCenterId(namespace, key)`, `steamApiName(key)`, `steamStat(key)`

The id derivations: `<namespace>.<key with separators as _>`, `ACH_<KEY>` and `STAT_<KEY>`.

### `outstanding(achievements, earned, acks, { progress })`

What a platform still needs, as `Report[]` in list order. A `Report` is
`{ kind: 'unlock', achievement }` or `{ kind: 'progress', achievement, steps }`. Pure.

- `earned` (`Earned`): key to what the player has. `1` for a standard achievement; steps reached for
  an incremental one, which is earned once that reaches `steps`. Absent and `0` mean not started;
  fractions are floored.
- `acks` (`Acks`): key to what the platform acknowledged, in the same terms.
- `progress: false` omits progress reports: an unfinished incremental achievement is then not reported.

### `ackValue(report)`

The value to record as acknowledged for a report: the steps for progress, the achievement's total (or `1`) for an unlock.

### `syncAchievements({ achievements, earned, adapter, store })`

Sends what the adapter's platform still needs and records each confirmation. Returns
`{ sent, failed, errors: { key, message }[], unaddressed, signedIn }`. Returns `signedIn: false` and
sends nothing for an adapter with no platform or no sign-in. A report the adapter does not `know` is
counted in `unaddressed` and stays outstanding; a throwing report is counted in `failed` and stays
outstanding; neither stops the others. Progress is requested only when
`adapter.reportsProgress && store.durable`.

### `AcknowledgementStore`

```ts
interface AcknowledgementStore {
  readonly durable: boolean
  acks(platform: AchievementPlatform): Promise<Acks>
  ack(platform: AchievementPlatform, key: string, value: number): Promise<void> // never lowers
}
```

`MemoryAcknowledgementStore` implements it in memory with `durable: false`.

### `PlatformAchievements`

The adapter contract: `platform` (`'play' | 'game-center' | 'steam' | null`), `reportsProgress`,
`signedIn()`, `knows(a)`, `unlock(a)`, `setProgress(a, steps, acked)` and `show()`. `unlock` is
idempotent. `setProgress` is absolute; `acked` is for APIs that can only add.

### `validateAchievements(achievements)` and `CONSOLE_LIMITS`

Returns `{ key, platform, message }[]` for every limit broken (count, points, steps, id characters and
length, name and description lengths, duplicate names, descriptions, ids and stats). Empty means the
list is acceptable. `CONSOLE_LIMITS` holds the numbers.

## `platform-achievements/game-services`

`gameServicesAchievements(plugin, 'play' | 'game-center')`. `GameServicesPlugin` needs
`isSignedIn(): Promise<{ signedIn: boolean }>`, `unlockAchievement({ id })`,
`incrementAchievement({ id, steps })` and `showAchievements()`.

## `platform-achievements/steam`

`steamAchievements(client | null)`, `SteamClient` (`achievement.activate`, `stats.setInt`,
`stats.store`, `overlay.activateDialog`) and `STEAM_ACHIEVEMENTS_DIALOG` (`6`).

## `platform-achievements/web`

`webAchievements`: platform `null`, never signed in, `unlock` and `setProgress` reject.

## `platform-achievements/export`

All pure; none touches the file system.

- `submission(achievements, { locale? })`: `{ files, icons }` for all three consoles.
- `playConsoleSubmission`, `appStoreConnectSubmission`, `steamworksSubmission`: one console each.
- `playIdsFromResources(xml, achievements)`: key to Play id from the console's resources file.
- `createZip(entries)`, `playConsoleZip(files)`: a deterministic stored ZIP; the Play one keeps only
  `play/` entries and zips them flat. `crc32(bytes)`.
- `csvField`, `csvRow`, `csvLines`, `fileStem`, and the constants `PLAY_ICON` (512),
  `GAME_CENTER_ICON` (1024), `STEAM_ICON` (256) and `DEFAULT_LOCALE`.
- `IconFile` is `{ path, key, size, format: 'png' | 'jpeg', locked }`: draw it at `size`.
