# autokrolik

Human-on-the-Loop AI Automation Framework — AI agents handle 70-90% autonomously, humans handle edge cases.

## Architecture

**Formula:** High-Quality Model + Context + Tooling + Escalation Logic = High Automation

### Tier System

| Tier | Name | Confidence | Human | Distribution |
|------|------|------------|-------|--------------|
| T0 | Rules Engine | >=99% | None | 60% |
| T1 | Auto + Audit | >=85% | Async review | 20% |
| T2 | Approval Required | >=70% | Sync approval | 15% |
| T3 | Human-Driven | Any | Human leads | 5% |

### Flow

```
Request -> Classify Tier -> T0: Auto-execute
                         -> T1: Execute + async audit
                         -> T2: AI draft -> await approval -> execute
                         -> T3: Route to human
```

## Stack

- TypeScript + LangGraph
- Prisma ORM
- Tiered confidence routing

## Install and use

The code lives in [hitl-service/](hitl-service/) (Node 22 or newer, pnpm). It is a library-style
service: `src/index.ts` exports a `HOTLService` class, there is no HTTP server yet.

```sh
cd hitl-service
pnpm install
pnpm typecheck        # tsc --noEmit
pnpm build            # tsc, output in dist/
```

```ts
import { HOTLService } from 'hitl-service'

const service = new HOTLService()
const result = await service.executeTask({ taskType: 'refund_approval', input: { orderId: '12345', amount: 150 } })
if (result.status === 'AWAITING_APPROVAL') {
  await service.resumeWithHumanInput(result.taskId, { decision: 'APPROVE', reviewerId: 'user-123' })
}
```

The LangGraph checkpointer is in memory (`MemorySaver`), so a paused task does not survive a restart.

## Configuration

Copy `hitl-service/.env.example`; every setting is an environment variable read in
`hitl-service/src/config/index.ts`: `DATABASE_URL`, `DATABASE_POOL_SIZE`, `REDIS_URL`,
`VIBEPROXY_BASE_URL`, `VIBEPROXY_API_KEY`, `VIBEPROXY_EXECUTION_MODEL`,
`VIBEPROXY_CLASSIFICATION_MODEL`, `VIBEPROXY_REASONING_MODEL`, `T0_CONFIDENCE_THRESHOLD`,
`T1_CONFIDENCE_THRESHOLD`, `T2_CONFIDENCE_THRESHOLD`, `DEFAULT_RISK_THRESHOLD`,
`ESCALATION_DEFAULT_SLA_MINUTES`, `ESCALATION_MAX_TIME_MINUTES`, `ESCALATION_REMINDER_INTERVALS`,
`ESCALATION_AUTO_EXPIRE`, `OTLP_ENDPOINT`, `PROMETHEUS_ENABLED`, `LOG_LEVEL`, `PORT`, `HOST`.
Models are reached through an OpenAI-compatible proxy (VibeProxy) at `VIBEPROXY_BASE_URL`.

## Status

Early (v0.1.0): the graph, state and node implementations exist; there are no tests yet. The
framework background (in Russian) is in [docs/info.md](docs/info.md). Agent notes:
[CLAUDE.md](CLAUDE.md); all documents: [docs/INDEX.md](docs/INDEX.md).

## License

Apache-2.0; see [LICENSE](LICENSE).
