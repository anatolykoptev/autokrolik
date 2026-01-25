import { StateGraph, END, START } from '@langchain/langgraph'
import { MemorySaver } from '@langchain/langgraph'
import { HOTLStateAnnotation, type HOTLState } from './state.js'
import {
  entryNode,
  classifyTierNode,
  aiExecuteNode,
  escalateNode,
  awaitApprovalNode,
  processHumanInput,
  finalizeNode,
} from './nodes/index.js'

/**
 * Build the HOTL (Human-on-the-Loop) workflow graph
 *
 * Graph Structure:
 *
 * START
 *   │
 *   ▼
 * entry ──► classify_tier
 *              │
 *   ┌──────────┼──────────┐
 *   │          │          │
 *   ▼          ▼          ▼
 * (T0)      (T1/T2)     (T3)
 *   │          │          │
 *   │          ▼          │
 *   │     ai_execute ◄────┘
 *   │          │
 *   │    ┌─────┼─────┬──────────┐
 *   │    │     │     │          │
 *   │    ▼     │     ▼          │
 *   │ escalate │  finalize      │
 *   │    │     │     │          │
 *   │    ▼     │     │          │
 *   │ await_approval │          │
 *   │    │     │     │          │
 *   │    ▼     │     │          │
 *   │ process_feedback          │
 *   │    │     │                │
 *   │    │     ▼                │
 *   │    └──► finalize ◄────────┘
 *   │            │
 *   └──────────► END
 */
export function buildHOTLGraph() {
  const workflow = new StateGraph(HOTLStateAnnotation)
    // Add all nodes
    .addNode('entry', entryNode)
    .addNode('classify_tier', classifyTierNode)
    .addNode('ai_execute', aiExecuteNode)
    .addNode('escalate', escalateNode)
    .addNode('await_approval', awaitApprovalNode)
    .addNode('process_feedback', processHumanInput)
    .addNode('finalize', finalizeNode)

    // Entry point
    .addEdge(START, 'entry')
    .addEdge('entry', 'classify_tier')

    // Classification routing
    .addConditionalEdges('classify_tier', routeFromClassification, [
      'ai_execute',
      'finalize',
    ])

    // AI execution routing
    .addConditionalEdges('ai_execute', routeFromAiExecute, [
      'escalate',
      'await_approval',
      'finalize',
      'ai_execute', // retry
    ])

    // Escalation goes to await approval
    .addEdge('escalate', 'await_approval')

    // After human review
    .addConditionalEdges('await_approval', routeFromAwaitApproval, [
      'process_feedback',
    ])

    // Process feedback routing
    .addConditionalEdges('process_feedback', routeFromFeedback, [
      'ai_execute',
      'escalate',
      'finalize',
    ])

    // Finalize always ends
    .addEdge('finalize', END)

  return workflow
}

/**
 * Route from classification node based on tier
 */
function routeFromClassification(state: HOTLState): string {
  // T0 tasks go directly to finalize (rules engine)
  if (state.tier === 'T0') {
    return 'finalize'
  }

  // All other tiers go through AI execution
  return 'ai_execute'
}

/**
 * Route from AI execution based on results
 */
function routeFromAiExecute(state: HOTLState): string {
  // Error with retries available
  if (state.error && state.error.recoverable && state.retryCount < 3) {
    return 'ai_execute'
  }

  // Error without retries
  if (state.error) {
    return 'escalate'
  }

  // Should escalate flag
  const metadata = state.metadata as Record<string, unknown>
  if (metadata['shouldEscalate']) {
    return 'escalate'
  }

  // T1 with high confidence can finalize directly
  if (state.tier === 'T1' && (state.confidenceScore ?? 0) >= 0.85) {
    return 'finalize'
  }

  // T2 and T3 always need approval
  if (state.tier === 'T2' || state.tier === 'T3') {
    return 'await_approval'
  }

  // T1 with lower confidence needs approval
  if (state.tier === 'T1' && (state.confidenceScore ?? 0) < 0.85) {
    return 'await_approval'
  }

  return 'finalize'
}

/**
 * Route from await approval - always goes to process feedback
 */
function routeFromAwaitApproval(_state: HOTLState): string {
  return 'process_feedback'
}

/**
 * Route from feedback processing based on human decision
 */
function routeFromFeedback(state: HOTLState): string {
  switch (state.humanDecision) {
    case 'APPROVE':
    case 'MODIFY_AND_APPROVE':
      return 'finalize'

    case 'REJECT':
      return 'finalize'

    case 'DELEGATE':
      return 'escalate'

    case 'REQUEST_INFO':
      return 'ai_execute'

    default:
      return 'finalize'
  }
}

/**
 * Create a compiled HOTL graph with memory persistence
 */
export function createHOTLGraph(checkpointer?: MemorySaver) {
  const workflow = buildHOTLGraph()

  const memoryCheckpointer = checkpointer ?? new MemorySaver()

  return workflow.compile({
    checkpointer: memoryCheckpointer,
    interruptBefore: ['await_approval'],
  })
}

export type HOTLGraph = ReturnType<typeof createHOTLGraph>
