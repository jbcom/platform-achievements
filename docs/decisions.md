# Decisions

## 2026-10-07: open source under the owner's npm user, as `platform-achievements`

**Decision.** The package is published to npmjs as `platform-achievements`, from
`github.com/jbcom/platform-achievements`, MIT licensed, first version 0.1.0.

**Why the name.** It says what the package is for (achievements) and what is distinctive about it
(several platforms at once), is free on npmjs, and is unscoped so it is easy to find.

## The model is keyed by a flat list, not by grades

Google Play Games, Game Center and Steam have no grades, so the package knows only a flat list of
achievements. A game that grades an achievement defines one per grade and builds `earned` from its own
save data. This keeps the sync, the adapters and the export free of any one game's notions.

## `earned` and `acks` have the same shape

Both are a map from key to a number: `1` for a standard unlock, steps for an incremental one. The
difference between them is the whole sync, and having one shape makes `outstanding` a short pure
function that is easy to test exhaustively.

## `syncAchievements` takes one request object

It needs the list, what is earned, an adapter and a store. Four positional arguments of mixed kinds were
easy to transpose, so it takes an object.

## Adapters are structural

`GameServicesPlugin` and `SteamClient` list the methods used. No peer dependency is declared because
nothing is imported; the shapes match `@idleflowgames/capacitor-play-games` 0.3 on Capacitor 8 and
`steamworks.js` 0.4.

## Added over the original code: `validateAchievements` and `createZip`

Console limits are facts about the platforms and are cheap to check in a unit test, so they ship with the
package. The Play Console's import wants a flat ZIP; a small deterministic stored-ZIP writer avoids
requiring a system `zip` binary.

## Toolchain: Node 26, pnpm 12, TypeScript 7

Built on Node 26 and pnpm 12 with TypeScript 7 (native), every tsconfig on `moduleResolution:
bundler`. The CommonJS build emits its own `.d.cts` declarations so a CommonJS consumer resolves
correct types. `engines.node` is `>=24`. The first release is published locally once, with a token
passed only through `--userconfig`; later releases publish from `cd.yml` by OIDC trusted publishing.
