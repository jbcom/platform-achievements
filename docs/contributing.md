---
title: Contributing
description: Set up platform-achievements, validate a change, and contribute through the protected workflow.
---

## Local workflow

```sh
mise install
pnpm install --frozen-lockfile
pnpm verify
pnpm docs:build
```

`pnpm verify` is the library gate: Biome, Markdown linting, strict TypeScript 7, coverage, the dual
ESM/CommonJS build, `publint`, Are The Types Wrong, a packed-tarball content check and a clean-consumer
install against npmjs. `pnpm docs:build` validates and renders the Sourcey site.

Branch from `main`, make a focused Conventional Commit, open an upstream pull request, and keep the
branch current by merging `main` into it when necessary. The protected path uses automated checks
rather than a routine human approval; merge commits preserve the constituent history. Do not
hand-edit versions or `CHANGELOG.md`: Release Please owns them.

Read the repository [contribution guide](https://github.com/jbcom/platform-achievements/blob/main/CONTRIBUTING.md)
and [agent instructions](https://github.com/jbcom/platform-achievements/blob/main/AGENTS.md) before changing public
APIs.
