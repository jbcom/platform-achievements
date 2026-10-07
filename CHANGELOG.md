# Changelog

## 0.1.0 (2026-10-07)

First release on npmjs, as `platform-achievements`, MIT licensed, from `github.com/jbcom/platform-achievements`.

### Features

* describe achievements once and resolve their ids on Google Play Games, Game Center and Steam
* an idempotent earned-minus-acknowledged sync with absolute progress and an `AcknowledgementStore`
* structural adapters for the Capacitor game-services plugin, `steamworks.js` and the web
* Play Console, App Store Connect and Steamworks submission files, and a deterministic Play import ZIP
* `validateAchievements` for the consoles' limits
* dual ESM and CommonJS builds with format-correct declarations
