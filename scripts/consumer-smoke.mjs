#!/usr/bin/env node
// Built-tarball consumer smoke: pack the package, install the tarball into a clean scratch
// consumer against npmjs only (no scoped registry, no token), then load every entry point through
// both ESM import and CommonJS require and exercise one call per module. Proves the exports map,
// the .cjs rewrite and the files list.
// With ACHIEVEMENTS_CONSUMER_SOURCE=platform-achievements@<version> it installs that published version
// from npmjs instead: the cold-install proof after a release.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const scratch = mkdtempSync(path.join(tmpdir(), 'platform-achievements-smoke-'))
const registrySource = process.env.ACHIEVEMENTS_CONSUMER_SOURCE

// Anonymous: no inherited npm_config_* (pnpm run exports them into scripts) and no
// credential-looking variables, so no token on the machine can authenticate any npm call here.
const anonymousEnv = {
  ...Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !/^npm_config_/i.test(key) && !/auth|token|secret|password|credential/i.test(key),
    ),
  ),
  // `npm pack` runs the package's own `prepare` (the git-hook installer); hooks are irrelevant here.
  SKIP_INSTALL_SIMPLE_GIT_HOOKS: '1',
}

try {
  if (
    registrySource &&
    !/^platform-achievements@\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(registrySource)
  ) {
    throw new Error(
      'ACHIEVEMENTS_CONSUMER_SOURCE must be an exact platform-achievements@<version> spec',
    )
  }
  let source = registrySource
  if (!source) {
    execFileSync('npm', ['pack', '--pack-destination', scratch], {
      cwd: pkgRoot,
      stdio: 'inherit',
      env: anonymousEnv,
    })
    const tarball = readdirSync(scratch).find((file) => file.endsWith('.tgz'))
    if (!tarball) throw new Error('npm pack produced no tarball')
    source = path.join(scratch, tarball)
  }

  const consumer = path.join(scratch, 'consumer')
  mkdirSync(consumer, { recursive: true })
  writeFileSync(
    path.join(consumer, 'package.json'),
    JSON.stringify({ name: 'platform-achievements-smoke-consumer', private: true, type: 'module' }),
  )
  const userConfig = path.join(scratch, 'anonymous.npmrc')
  const globalConfig = path.join(scratch, 'empty-global.npmrc')
  writeFileSync(userConfig, 'registry=https://registry.npmjs.org/\n')
  writeFileSync(globalConfig, '')
  execFileSync(
    'npm',
    [
      'install',
      '--no-audit',
      '--no-fund',
      '--ignore-scripts',
      '--userconfig',
      userConfig,
      '--globalconfig',
      globalConfig,
      source,
    ],
    { cwd: consumer, stdio: 'inherit', env: anonymousEnv },
  )

  const esm = `
    import { MemoryAcknowledgementStore, resolveAchievements, syncAchievements } from 'platform-achievements'
    import { gameServicesAchievements } from 'platform-achievements/game-services'
    import { steamAchievements } from 'platform-achievements/steam'
    import { webAchievements } from 'platform-achievements/web'
    import { createZip, submission } from 'platform-achievements/export'

    const achievements = resolveAchievements(
      [{ key: 'first-win', name: 'First Win', description: 'Win a match.', points: 5 }],
      { gameCenterNamespace: 'com.example.game' },
    )
    const unlocked = []
    const adapter = gameServicesAchievements(
      {
        isSignedIn: async () => ({ signedIn: true }),
        unlockAchievement: async ({ id }) => { unlocked.push(id) },
        incrementAchievement: async () => {},
        showAchievements: async () => {},
      },
      'game-center',
    )
    const result = await syncAchievements({
      achievements,
      earned: { 'first-win': 1 },
      adapter,
      store: new MemoryAcknowledgementStore(),
    })
    if (result.sent !== 1 || unlocked[0] !== 'com.example.game.first_win') throw new Error('ESM sync')
    if (steamAchievements(null).platform !== 'steam') throw new Error('ESM steam')
    if (webAchievements.platform !== null) throw new Error('ESM web')
    if (!submission(achievements).files['play/AchievementsMetadata.csv']) throw new Error('ESM export')
    if (createZip({ 'a.txt': 'a' }).length === 0) throw new Error('ESM zip')
    console.log('esm ok')
  `
  const cjs = `
    const { resolveAchievements, outstanding } = require('platform-achievements')
    const { gameServicesAchievements } = require('platform-achievements/game-services')
    const { steamAchievements } = require('platform-achievements/steam')
    const { webAchievements } = require('platform-achievements/web')
    const { submission } = require('platform-achievements/export')
    const achievements = resolveAchievements([
      { key: 'ten-wins', name: 'Ten Wins', description: 'Win ten matches.', points: 10, steps: 10 },
    ])
    const reports = outstanding(achievements, { 'ten-wins': 4 }, {}, { progress: true })
    if (reports.length !== 1 || reports[0].kind !== 'progress' || reports[0].steps !== 4) throw new Error('CJS outstanding')
    for (const fn of [gameServicesAchievements, steamAchievements]) {
      if (typeof fn !== 'function') throw new Error('CJS adapter export missing')
    }
    if (webAchievements.reportsProgress) throw new Error('CJS web')
    if (!submission(achievements).files['steamworks/steamworks.json']) throw new Error('CJS export')
    console.log('cjs ok')
  `
  writeFileSync(path.join(consumer, 'esm.mjs'), esm)
  writeFileSync(path.join(consumer, 'cjs.cjs'), cjs)
  execFileSync(process.execPath, ['esm.mjs'], { cwd: consumer, stdio: 'inherit' })
  execFileSync(process.execPath, ['cjs.cjs'], { cwd: consumer, stdio: 'inherit' })
  console.info(
    `platform-achievements: consumer smoke passed (ESM + CJS) from ${registrySource ?? 'the packed tarball'}`,
  )
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
