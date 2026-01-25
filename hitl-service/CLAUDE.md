# HITL Service - Human-on-the-Loop AI Automation

## Overview

TypeScript service implementing Human-on-the-Loop (HOTL) AI automation with LangGraph.

**Formula:** High-Quality Model + Context + Tooling + Escalation Logic = High Automation

**Target:** AI handles 70-90% autonomously, humans handle 10-30% edge cases.

---

## Architecture

### Tier System

| Tier | Name | Confidence | Human | Distribution |
|------|------|------------|-------|--------------|
| T0 | Rules Engine | ≥99% | None | 60% |
| T1 | Auto + Audit | ≥85% | Async | 20% |
| T2 | Approval Required | ≥70% | Sync | 15% |
| T3 | Human-Driven | Any | Lead | 5% |

### Graph Flow

```
START → entry → classify_tier
                    ↓
         ┌─────────┼─────────┐
         T0       T1/T2      T3
         ↓         ↓         ↓
      finalize  ai_execute ←─┘
                    ↓
         ┌─────────┼─────────┐
         ↓         ↓         ↓
      escalate  approve   finalize
         ↓         ↓
    await_approval ←┘
         ↓
    process_feedback
         ↓
      finalize → END
```

---

## Key Files

| Path | Description |
|------|-------------|
| `src/types/` | Zod schemas & TypeScript types |
| `src/lib/vibeproxy.ts` | VibeProxy integration for LangChain |
| `src/graphs/state.ts` | LangGraph state annotation |
| `src/graphs/hotl-graph.ts` | Main graph builder |
| `src/graphs/nodes/` | Individual node implementations |
| `prisma/schema.prisma` | Database schema |

---

## VibeProxy Integration

Uses local VibeProxy server (`http://localhost:8318`) for OpenAI-compatible API:

| Model | Alias | Use Case |
|-------|-------|----------|
| `gemini-claude-sonnet-4-5-thinking` | `sonnet` | Execution |
| `gemini-claude-opus-4-5-thinking` | `opus` | Reasoning |
| `gemini-2.0-flash-exp` | `flash` | Classification |

```typescript
import { createVibeProxyModel, createExecutionModel } from './lib/vibeproxy.js'

// Quick usage
const model = createVibeProxyModel({ model: 'sonnet' })

// Specialized models
const classificationModel = createClassificationModel() // flash
const executionModel = createExecutionModel()           // sonnet
const reasoningModel = createReasoningModel()           // opus
```

Antigravity models (Claude via Google) are FREE.

---

## Commands

```bash
pnpm dev           # Start dev server
pnpm build         # Build TypeScript
pnpm db:generate   # Generate Prisma client
pnpm db:migrate    # Run migrations
pnpm test          # Run tests
```

---

## Human Interrupt

Graph uses `interrupt()` at `await_approval` node:

```typescript
// Resume with human input
const result = await graph.invoke(null, config, {
  decision: 'APPROVE',
  feedback: 'Looks good',
  reviewerId: 'user-123',
})
```

---

## Escalation Reasons

- `LOW_CONFIDENCE` - AI confidence below threshold
- `HIGH_RISK` - Risk score exceeds threshold
- `ANOMALY_DETECTED` - Unusual pattern detected
- `POLICY_VIOLATION` - Rule or policy breach
- `TIMEOUT` - SLA deadline exceeded
- `ERROR` - Execution error occurred
