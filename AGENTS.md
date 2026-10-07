# Agent notes

This file is for an autonomous coding agent working in this repository. It covers what isn't obvious
from reading the code alone.

## Toolchain

- Package manager: pnpm 12, pinned in `package.json#packageManager`. Use `mise install` (reads
  `mise.toml`) for a matching local Node 26 / pnpm 12 toolchain, or `corepack enable`.
- TypeScript 7 (native). `moduleResolution: node10` no longer exists; all tsconfigs use `bundler`.
- This is a pnpm workspace with two members: `.` (the published library) and `docs/` (the private
  Sourcey documentation site). Root scripts operate on the library; `pnpm docs:*` delegate to `docs/`.
  Sourcey emits `docs/dist/`, including the site `llms.txt`; the root `llms.txt` is separate, concise
  repository orientation.
- `pnpm verify` is the single gate CI runs: Biome, markdownlint on the published docs, strict
  TypeScript, the test suite with coverage, the dual-format build, `publint`, Are The Types Wrong, a
  packed-tarball content and ESM/CommonJS equivalence check, and a packed-consumer smoke against
  npmjs. A change is not done while any part of it is red. CI's `docs` job runs `pnpm docs:build`.

## Core invariants: do not violate these when editing `src/`

1. No runtime dependencies and no Capacitor, Play Games or Steam import. The plugin and the client are
   passed in and typed by the structural interfaces in `src/adapters/`.
2. Nothing is queued. What a platform needs is `outstanding(earned, acks)`, a pure function; the only
   state is what was earned and what each platform acknowledged.
3. An acknowledgement is recorded only after the platform confirmed it, and a store never lowers one.
4. Progress is absolute in the model. Only an adapter translates it (steps, percentage points, a stat).
5. An adapter failure becomes an entry in `SyncResult.errors`; it never throws out of
   `syncAchievements` and never stops the other reports.
6. `src/export/` is pure: it returns text and icon descriptions and never touches the file system.
7. Console limits in `validate.ts` move only with the console's documentation, never to make a test pass.

## Keeping docs and tests in sync

A change to `src/*.ts`'s public surface needs matching updates in `tests/`, `docs/API.md` and
`docs/ARCHITECTURE.md`, and in `README.md` if the quick start or API table is affected. Examples in
docs and tests stay neutral and written for this package.

## Commits and releases

- Conventional Commits only. A required CI check enforces conventional PR titles and Release Please
  drives `CHANGELOG.md` and the version. Never hand-edit the changelog or bump a version.
- `simple-git-hooks`, `lint-staged` and `commitlint` run locally after `pnpm install`; don't bypass
  them with `--no-verify`.
- Publishing is by OIDC from `.github/workflows/cd.yml` (the trusted-publisher workflow).

## Files most likely to surprise you

- `pnpm-workspace.yaml`'s `allowBuilds` map controls which packages' install scripts run; a new
  dependency needing a native build step silently no-ops until it is added there.
- `scripts/build.mjs` renames the CommonJS output to `.cjs`/`.d.cts` and rewrites specifiers; change
  it only together with `scripts/verify-package.mjs`.
