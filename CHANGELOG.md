# Changelog

## [0.1.1](https://github.com/jbcom/platform-achievements/compare/v0.1.0...v0.1.1) (2026-10-07)


### Bug Fixes

* support every maintained Node line (22, 24 and 26) ([e171c78](https://github.com/jbcom/platform-achievements/commit/e171c788d0a6c498e58ae19388c3bd61fc5326a0))
* support maintained Node lines and standardize OSS gates ([6fa06a9](https://github.com/jbcom/platform-achievements/commit/6fa06a97cae42cd1aaa12c76f78a87d270a898cc))

## 0.1.0 (2026-10-07)

First release on npmjs, as `platform-achievements`, MIT licensed, from `github.com/jbcom/platform-achievements`.

### Features

* describe achievements once and resolve their ids on Google Play Games, Game Center and Steam
* an idempotent earned-minus-acknowledged sync with absolute progress and an `AcknowledgementStore`
* structural adapters for the Capacitor game-services plugin, `steamworks.js` and the web
* Play Console, App Store Connect and Steamworks submission files, and a deterministic Play import ZIP
* `validateAchievements` for the consoles' limits
* dual ESM and CommonJS builds with format-correct declarations
