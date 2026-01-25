import { ulid } from 'ulid'
import type { HOTLState } from '../state.js'
import type { GraphCheckpoint } from '../../types/graph.js'

/**
 * Finalize Node
 *
 * Completes task processing, records final state, and prepares for exit.
 */
export async function finalizeNode(
  state: HOTLState
): Promise<Partial<HOTLState>> {
  const completedAt = new Date()
  const durationMs = completedAt.getTime() - state.startedAt.getTime()

  const finalStatus = determineFinalStatus(state)

  const checkpoint: GraphCheckpoint = {
    id: ulid(),
    nodeName: 'finalize',
    state: {
      status: finalStatus,
      output: state.output,
      confidenceScore: state.confidenceScore,
      durationMs,
    },
    timestamp: completedAt,
  }

  return {
    status: finalStatus,
    currentNode: 'finalize',
    nodeHistory: ['finalize'],
    checkpoints: [checkpoint],
    metadata: {
      completedAt: completedAt.toISOString(),
      totalDurationMs: durationMs,
      totalNodes: state.nodeHistory.length + 1,
      wasEscalated: state.escalationId !== undefined,
      finalTier: state.tier,
      autonomyAchieved: calculateAutonomy(state),
    },
  }
}

function determineFinalStatus(
  state: HOTLState
): 'COMPLETED' | 'APPROVED' | 'REJECTED' | 'FAILED' {
  if (state.error) {
    return 'FAILED'
  }

  if (state.humanDecision === 'REJECT') {
    return 'REJECTED'
  }

  if (state.humanDecision === 'APPROVE' || state.humanDecision === 'MODIFY_AND_APPROVE') {
    return 'APPROVED'
  }

  if (state.tier === 'T0' || state.tier === 'T1') {
    const confidence = state.confidenceScore ?? 0
    if (confidence >= 0.85) {
      return 'COMPLETED'
    }
  }

  return 'COMPLETED'
}

function calculateAutonomy(state: HOTLState): number {
  // Calculate autonomy score based on how much human intervention was needed
  const factors: number[] = []

  // Tier factor (T0=1.0, T1=0.9, T2=0.5, T3=0.1)
  const tierScores: Record<string, number> = { T0: 1.0, T1: 0.9, T2: 0.5, T3: 0.1 }
  factors.push(tierScores[state.tier] ?? 0.5)

  // Escalation factor (no escalation = 1.0, escalated = 0.3)
  factors.push(state.escalationId ? 0.3 : 1.0)

  // Human decision factor
  if (state.humanDecision) {
    factors.push(0.5) // Human was involved
  } else {
    factors.push(1.0) // Fully autonomous
  }

  // Confidence factor
  const confidence = state.confidenceScore ?? 0.5
  factors.push(confidence)

  // Average all factors
  const sum = factors.reduce((a, b) => a + b, 0)
  return sum / factors.length
}
