#!/usr/bin/env node
// Package contract gate (run after `pnpm build`): the packed file list is exactly what ships, and
// the built ESM and CommonJS entry points export the same runtime surface with the same behavior.
// Registry-only install proof lives in consumer-smoke.mjs; this gate inspects the pack itself.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
// pnpm forwards its own npm_config_* settings to child processes; newer npm versions warn about
// pnpm-only keys, so this read-only pack inspection gets a clean npm configuration. npm always runs
// `prepare` for `npm pack`, which would print the git-hook installer's [INFO] line into the --json
// stream, so hook installation is skipped for this dry run.
const npmEnvironment = {
  ...Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.toLowerCase().startsWith('npm_config_')),
  ),
  SKIP_INSTALL_SIMPLE_GIT_HOOKS: '1',
}

const scratch = mkdtempSync(path.join(tmpdir(), 'platform-achievements-package-'))

// Every entry point, and the runtime exports it must have as a function or value of a given type.
const entryPoints = {
  index: {
    file: 'index',
    functions: [
      'ackValue',
      'findAchievement',
      'gameCenterId',
      'outstanding',
      'resolveAchievements',
      'steamApiName',
      'steamStat',
      'syncAchievements',
      'validateAchievements',
    ],
    classes: ['MemoryAcknowledgementStore'],
  },
  'game-services': { file: 'adapters/game-services', functions: ['gameServicesAchievements'] },
  steam: { file: 'adapters/steam', functions: ['steamAchievements'] },
  web: { file: 'adapters/web', functions: [] },
  export: {
    file: 'export/index',
    functions: [
      'appStoreConnectSubmission',
      'createZip',
      'crc32',
      'csvField',
      'csvLines',
      'csvRow',
      'fileStem',
      'playConsoleSubmission',
      'playConsoleZip',
      'playIdsFromResources',
      'steamworksSubmission',
      'submission',
    ],
  },
}

try {
  const packOutput = execFileSync(
    'npm',
    ['pack', '--pack-destination', scratch, '--ignore-scripts', '--json'],
    { cwd: packageRoot, encoding: 'utf8', env: npmEnvironment },
  )
  // Any other lifecycle script writing text around the JSON array must not break parsing: try each
  // line-leading "[" until one parses.
  const jsonEnd = packOutput.lastIndexOf(']')
  assert(jsonEnd !== -1, `npm pack produced no JSON array:\n${packOutput}`)
  let pack
  for (const match of packOutput.matchAll(/^\[/gm)) {
    try {
      ;[pack] = JSON.parse(packOutput.slice(match.index, jsonEnd + 1))
      break
    } catch {
      // Not the real array start (for example an "[INFO] ..." line): try the next "[".
    }
  }
  assert(pack, `npm pack did not return a parseable package manifest:\n${packOutput}`)

  const packedPaths = new Set(pack.files.map((file) => file.path))
  const required = [
    'LICENSE',
    'README.md',
    'CHANGELOG.md',
    'package.json',
    'docs/API.md',
    'docs/ARCHITECTURE.md',
    'docs/platforms.md',
    'dist/cjs/package.json',
  ]
  for (const { file } of Object.values(entryPoints)) {
    required.push(
      `dist/esm/${file}.js`,
      `dist/esm/${file}.d.ts`,
      `dist/cjs/${file}.cjs`,
      `dist/cjs/${file}.d.cts`,
    )
  }
  for (const file of required) assert(packedPaths.has(file), `packed artifact is missing ${file}`)
  for (const forbiddenPrefix of ['src/', 'tests/', 'coverage/', 'scripts/', '.github/']) {
    assert(
      [...packedPaths].every((file) => !file.startsWith(forbiddenPrefix)),
      `packed artifact unexpectedly contains ${forbiddenPrefix}`,
    )
  }

  const require = createRequire(import.meta.url)
  for (const [name, entry] of Object.entries(entryPoints)) {
    const esm = await import(
      pathToFileURL(path.join(packageRoot, `dist/esm/${entry.file}.js`)).href
    )
    const cjs = require(path.join(packageRoot, `dist/cjs/${entry.file}.cjs`))
    assert.deepEqual(
      Object.keys(esm).sort(),
      Object.keys(cjs).sort(),
      `${name}: ESM and CommonJS export different names`,
    )
    for (const fn of entry.functions ?? []) {
      assert.equal(typeof esm[fn], 'function', `${name}: ESM export ${fn} is missing`)
      assert.equal(typeof cjs[fn], 'function', `${name}: CommonJS export ${fn} is missing`)
    }
    for (const cls of entry.classes ?? []) {
      assert.equal(typeof esm[cls], 'function', `${name}: ESM class ${cls} is missing`)
      assert.equal(typeof cjs[cls], 'function', `${name}: CommonJS class ${cls} is missing`)
    }
  }

  // Both builds resolve and report identically.
  const esmCore = await import(pathToFileURL(path.join(packageRoot, 'dist/esm/index.js')).href)
  const cjsCore = require(path.join(packageRoot, 'dist/cjs/index.cjs'))
  const definitions = [
    { key: 'first-win', name: 'First Win', description: 'Win a match.', points: 5 },
    { key: 'ten-wins', name: 'Ten Wins', description: 'Win ten matches.', points: 10, steps: 10 },
  ]
  const earned = { 'first-win': 1, 'ten-wins': 3 }
  const outstandingFor = (core) =>
    core.outstanding(core.resolveAchievements(definitions), earned, {}, { progress: true })
  assert.deepEqual(outstandingFor(esmCore), outstandingFor(cjsCore), 'builds report differently')

  console.info(
    `platform-achievements: ${pack.entryCount} intentional files packed; ESM and CommonJS APIs agree`,
  )
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
