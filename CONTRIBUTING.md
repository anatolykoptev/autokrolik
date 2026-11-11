# Contributing

Contributions are welcome. Open an issue first for anything larger than a fix.

## Build and test

Node 22 or newer and pnpm. All commands run inside `hitl-service/`:

```sh
pnpm install
pnpm typecheck     # tsc --noEmit
pnpm build         # tsc
pnpm db:generate   # Prisma client, after schema changes
```

The repository has no test suite or lint configuration yet (`pnpm test` and `pnpm lint` are defined
but have nothing to run). A change that adds behaviour should add a vitest test under
`hitl-service/tests/unit` and the configuration it needs, so that `pnpm test` runs it.

## Pull requests

- Branch from `main`, one concern per pull request.
- Use Conventional Commits as in the history (`feat:`, `fix:`, `docs:`, `chore:`).
- Keep [README.md](README.md) and the tier table in step with `src/config/index.ts`, and add new
  documents to [docs/INDEX.md](docs/INDEX.md).
- Report vulnerabilities as described in [SECURITY.md](SECURITY.md), not in issues.
