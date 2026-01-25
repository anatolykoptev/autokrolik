import { ulid } from 'ulid'
import type { HOTLState } from '../state.js'
import type { GraphCheckpoint } from '../../types/graph.js'

/**
 * Entry Node
 *
 * First node in the HOTL graph. Validates input, initializes state,
 * and prepares task for classification.
 */
export async function entryNode(
  state: HOTLState
): Promise<Partial<HOTLState>> {
  const checkpoint: GraphCheckpoint = {
    id: ulid(),
    nodeName: 'entry',
    state: {
      taskId: state.taskId,
      taskType: state.taskType,
      input: state.input,
      tier: state.tier,
    },
    timestamp: new Date(),
  }

  return {
    status: 'RUNNING',
    currentNode: 'entry',
    nodeHistory: ['entry'],
    checkpoints: [checkpoint],
    startedAt: new Date(),
    metadata: {
      ...state.metadata,
      entryTimestamp: Date.now(),
    },
  }
}
