import { ulid } from 'ulid'
import { interrupt } from '@langchain/langgraph'
import type { HOTLState } from '../state.js'
import type { GraphCheckpoint } from '../../types/graph.js'
import type { EscalationDecision } from '../../types/escalation.js'

/**
 * Human Input for resuming from interrupt
 */
export interface HumanReviewInput {
  decision: EscalationDecision
  feedback?: string
  modifications?: Record<string, unknown>
  reviewerId: string
}

/**
 * Await Approval Node
 *
 * Interrupts the graph execution to wait for human review.
 * Uses LangGraph's interrupt() for durable human-in-the-loop.
 */
export async function awaitApprovalNode(
  state: HOTLState
): Promise<Partial<HOTLState>> {
  const checkpoint: GraphCheckpoint = {
    id: ulid(),
    nodeName: 'await_approval',
    state: {
      status: 'AWAITING_APPROVAL',
      output: state.output,
      aiRecommendation: state.aiRecommendation,
    },
    timestamp: new Date(),
  }

  const interruptPayload = {
    taskId: state.taskId,
    taskType: state.taskType,
    escalationId: state.escalationId,
    output: state.output,
    confidenceScore: state.confidenceScore,
    aiRecommendation: state.aiRecommendation,
    requestedAt: new Date().toISOString(),
  }

  // Interrupt execution and wait for human input
  const humanInput = interrupt<HumanReviewInput>(interruptPayload)

  return {
    status: 'AWAITING_APPROVAL',
    currentNode: 'await_approval',
    nodeHistory: ['await_approval'],
    checkpoints: [checkpoint],
    humanDecision: humanInput.decision,
    humanFeedback: humanInput.feedback,
    humanModifications: humanInput.modifications,
    metadata: {
      awaitStartTimestamp: Date.now(),
      reviewerId: humanInput.reviewerId,
    },
  }
}

/**
 * Process Feedback Node
 *
 * Processes human decision and determines next step in workflow.
 */
export async function processHumanInput(
  state: HOTLState
): Promise<Partial<HOTLState>> {
  const decision = state.humanDecision

  const checkpoint: GraphCheckpoint = {
    id: ulid(),
    nodeName: 'process_feedback',
    state: {
      humanDecision: decision,
      humanFeedback: state.humanFeedback,
      hasModifications: state.humanModifications !== undefined,
    },
    timestamp: new Date(),
  }

  const newStatus = mapDecisionToStatus(decision)

  const updatedOutput = state.humanModifications
    ? { ...state.output, ...state.humanModifications }
    : state.output

  return {
    status: newStatus,
    currentNode: 'process_feedback',
    nodeHistory: ['process_feedback'],
    output: updatedOutput,
    checkpoints: [checkpoint],
    contextData: {
      humanReviewCompleted: true,
      reviewDecision: decision,
      reviewFeedback: state.humanFeedback,
    },
    metadata: {
      feedbackProcessedTimestamp: Date.now(),
    },
  }
}

function mapDecisionToStatus(
  decision: EscalationDecision | undefined
): 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'RUNNING' {
  switch (decision) {
    case 'APPROVE':
    case 'MODIFY_AND_APPROVE':
      return 'APPROVED'
    case 'REJECT':
      return 'REJECTED'
    case 'DELEGATE':
      return 'ESCALATED'
    case 'REQUEST_INFO':
      return 'RUNNING'
    default:
      return 'RUNNING'
  }
}
