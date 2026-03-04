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

## License

MIT
