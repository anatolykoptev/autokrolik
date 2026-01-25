import { ulid } from 'ulid'
import type { HOTLState } from '../state.js'
import type { GraphCheckpoint } from '../../types/graph.js'
import type { EscalationReason } from '../../types/task.js'
import type { AIRecommendation } from '../../types/escalation.js'

/**
 * Escalate Node
 *
 * Creates an escalation record and transitions task to human review.
 * Generates AI recommendation for the reviewer.
 */
export async function escalateNode(
  state: HOTLState
): Promise<Partial<HOTLState>> {
  const escalationId = ulid()

  const reason = determineEscalationReason(state)

  const aiRecommendation = generateRecommendation(state)

  const checkpoint: GraphCheckpoint = {
    id: ulid(),
    nodeName: 'escalate',
    state: {
      escalationId,
      reason,
      confidenceScore: state.confidenceScore,
      riskScore: state.riskScore,
    },
    timestamp: new Date(),
  }

  return {
    status: 'ESCALATED',
    currentNode: 'escalate',
    nodeHistory: ['escalate'],
    escalationId,
    escalationReason: reason,
    aiRecommendation,
    checkpoints: [checkpoint],
    metadata: {
      escalationTimestamp: Date.now(),
    },
  }
}

function determineEscalationReason(state: HOTLState): EscalationReason {
  if (state.error) {
    return 'ERROR'
  }

  if (state.confidenceScore !== undefined && state.confidenceScore < 0.7) {
    return 'LOW_CONFIDENCE'
  }

  if (state.riskScore !== undefined && state.riskScore > 0.5) {
    return 'HIGH_RISK'
  }

  const contextFlags = state.contextData as Record<string, unknown>
  if (contextFlags['anomalyDetected']) {
    return 'ANOMALY_DETECTED'
  }

  if (contextFlags['policyViolation']) {
    return 'POLICY_VIOLATION'
  }

  if (contextFlags['manualRequest']) {
    return 'MANUAL_REQUEST'
  }

  return 'THRESHOLD_EXCEEDED'
}

function generateRecommendation(state: HOTLState): AIRecommendation {
  const confidence = state.confidenceScore ?? 0.5
  const hasOutput = state.output !== undefined

  if (!hasOutput) {
    return {
      suggestedAction: 'Review task input and provide guidance',
      confidence: 0.3,
      reasoning:
        'Task could not be completed automatically. Human expertise required.',
      alternatives: [
        {
          action: 'Delegate to specialist',
          confidence: 0.4,
          pros: ['Expert handling', 'Better outcome'],
          cons: ['Longer resolution time'],
        },
        {
          action: 'Request more information',
          confidence: 0.5,
          pros: ['May enable automation'],
          cons: ['Delays resolution'],
        },
      ],
      riskAssessment: {
        level: 'MEDIUM',
        factors: ['Incomplete processing', 'Missing output'],
      },
    }
  }

  return {
    suggestedAction: 'Approve AI-generated output',
    confidence,
    reasoning: `AI completed task with ${(confidence * 100).toFixed(1)}% confidence. Review recommended before final approval.`,
    alternatives: [
      {
        action: 'Modify and approve',
        confidence: confidence * 0.9,
        pros: ['Human refinement', 'Higher quality'],
        cons: ['Additional time required'],
      },
      {
        action: 'Reject and redo manually',
        confidence: 0.3,
        pros: ['Full control', 'Custom approach'],
        cons: ['Significantly more effort'],
      },
    ],
    riskAssessment: {
      level: confidence > 0.8 ? 'LOW' : confidence > 0.6 ? 'MEDIUM' : 'HIGH',
      factors: state.riskScore && state.riskScore > 0.3
        ? ['Elevated risk score', 'Requires careful review']
        : ['Standard risk level'],
    },
  }
}
