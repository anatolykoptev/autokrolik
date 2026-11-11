# CLAUDE.md

Notes for coding agents. Overview and setup: [README.md](README.md); all documents:
[docs/INDEX.md](docs/INDEX.md). Service-level details (graph diagram, VibeProxy models, escalation
reasons) are in [hitl-service/CLAUDE.md](hitl-service/CLAUDE.md).

## Layout

- `hitl-service/` the only code: TypeScript, LangGraph graph in `src/graphs/` (`hotl-graph.ts`,
  `state.ts`, `nodes/`), Zod types in `src/types/`, the model client in `src/lib/vibeproxy.ts`,
  settings in `src/config/index.ts`, Prisma schema in `prisma/schema.prisma`.
- `docs/info.md` the framework write-up (Russian).

## Gate

There is no CI and no lockfile. Run inside `hitl-service/` before a commit:

```sh
pnpm typecheck
pnpm build
```

`package.json` also defines `test`, `lint` and `format`, but the repository ships no tests, no ESLint
configuration and no Prettier configuration yet, so those commands have nothing to run.

## Invariants easy to break

- Tier thresholds (T0 0.99, T1 0.85, T2 0.70) and the escalation settings come from the environment
  with these defaults in `src/config/index.ts`; the README tier table must match them.
- Human approval is a LangGraph `interrupt()` at the `await_approval` node; resuming goes through
  `HOTLService.resumeWithHumanInput`. Do not bypass the checkpointer: it is the only task state, and
  it is in memory.
- The package is ESM (`"type": "module"`); relative imports carry the `.js` extension.
- Secrets (`VIBEPROXY_API_KEY`, `DATABASE_URL`) come from the environment; `.env.example` holds names only.
