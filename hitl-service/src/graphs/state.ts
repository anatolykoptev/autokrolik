import { Annotation, messagesStateReducer } from '@langchain/langgraph'
import type { BaseMessage } from '@langchain/core/messages'
import type {
  TaskTier,
  TaskStatus,
  EscalationReason,
} from '../types/task.js'
import type {
  AIRecommendation,
  EscalationDecision,
} from '../types/escalation.js'
import type {
  GraphCheckpoint,
  ToolCallRecord,
  ToolCallRequest,
  GraphError,
} from '../types/graph.js'

/**
 * HOTL Graph State Annotation
 *
 * This defines the state shape for the Human-on-the-Loop workflow graph.
 * Uses LangGraph's Annotation system for type-safe state management.
 */
export const HOTLStateAnnotation = Annotation.Root({
  // =========================================================================
  // Task Identification
  // =========================================================================
  taskId: Annotation<string>({
    reducer: (_, value) => value,
    default: () => '',
  }),

  externalId: Annotation<string | undefined>({
    reducer: (_, value) => value,
    default: () => undefined,
  }),

  taskType: Annotation<string>({
    reducer: (_, value) => value,
    default: () => '',
  }),

  // =========================================================================
  // Input/Output
  // =========================================================================
  input: Annotation<Record<string, unknown>>({
    reducer: (_, value) => value,
    default: () => ({}),
  }),

  output: Annotation<Record<string, unknown> | undefined>({
    reducer: (prev, value) => (value ? { ...prev, ...value } : prev),
    default: () => undefined,
  }),

  // =========================================================================
  // Classification & Status
  // =========================================================================
  tier: Annotation<TaskTier>({
    reducer: (_, value) => value,
    default: () => 'T1',
  }),

  determinedTier: Annotation<TaskTier | undefined>({
    reducer: (_, value) => value,
    default: () => undefined,
  }),

  status: Annotation<TaskStatus>({
    reducer: (_, value) => value,
    default: () => 'PENDING',
  }),

  // =========================================================================
  // Execution Tracking
  // =========================================================================
  currentNode: Annotation<string>({
    reducer: (_, value) => value,
    default: () => 'entry',
  }),

  nodeHistory: Annotation<string[]>({
    reducer: (prev, value) => [...prev, ...value],
    default: () => [],
  }),

  checkpoints: Annotation<GraphCheckpoint[]>({
    reducer: (prev, value) => [...prev, ...value],
    default: () => [],
  }),

  // =========================================================================
  // AI Assessment
  // =========================================================================
  confidenceScore: Annotation<number | undefined>({
    reducer: (_, value) => value,
    default: () => undefined,
  }),

  riskScore: Annotation<number | undefined>({
    reducer: (_, value) => value,
    default: () => undefined,
  }),

  aiRecommendation: Annotation<AIRecommendation | undefined>({
    reducer: (_, value) => value,
    default: () => undefined,
  }),

  // =========================================================================
  // Escalation State
  // =========================================================================
  escalationId: Annotation<string | undefined>({
    reducer: (_, value) => value,
    default: () => undefined,
  }),

  escalationReason: Annotation<EscalationReason | undefined>({
    reducer: (_, value) => value,
    default: () => undefined,
  }),

  humanDecision: Annotation<EscalationDecision | undefined>({
    reducer: (_, value) => value,
    default: () => undefined,
  }),

  humanFeedback: Annotation<string | undefined>({
    reducer: (_, value) => value,
    default: () => undefined,
  }),

  humanModifications: Annotation<Record<string, unknown> | undefined>({
    reducer: (_, value) => value,
    default: () => undefined,
  }),

  // =========================================================================
  // Context & Messages
  // =========================================================================
  contextData: Annotation<Record<string, unknown>>({
    reducer: (prev, value) => ({ ...prev, ...value }),
    default: () => ({}),
  }),

  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  // =========================================================================
  // Tool Execution
  // =========================================================================
  toolCalls: Annotation<ToolCallRecord[]>({
    reducer: (prev, value) => [...prev, ...value],
    default: () => [],
  }),

  pendingToolCalls: Annotation<ToolCallRequest[]>({
    reducer: (_, value) => value,
    default: () => [],
  }),

  // =========================================================================
  // Error Handling
  // =========================================================================
  error: Annotation<GraphError | undefined>({
    reducer: (_, value) => value,
    default: () => undefined,
  }),

  retryCount: Annotation<number>({
    reducer: (_, value) => value,
    default: () => 0,
  }),

  // =========================================================================
  // Metadata & Timing
  // =========================================================================
  startedAt: Annotation<Date>({
    reducer: (prev, value) => value ?? prev,
    default: () => new Date(),
  }),

  metadata: Annotation<Record<string, unknown>>({
    reducer: (prev, value) => ({ ...prev, ...value }),
    default: () => ({}),
  }),
})

export type HOTLState = typeof HOTLStateAnnotation.State

/**
 * Create initial state for a new HOTL task
 */
export function createInitialState(params: {
  taskId: string
  taskType: string
  input: Record<string, unknown>
  tier?: TaskTier
  externalId?: string
  metadata?: Record<string, unknown>
}): Partial<HOTLState> {
  return {
    taskId: params.taskId,
    externalId: params.externalId,
    taskType: params.taskType,
    input: params.input,
    tier: params.tier ?? 'T1',
    status: 'PENDING',
    currentNode: 'entry',
    nodeHistory: [],
    checkpoints: [],
    contextData: {},
    messages: [],
    toolCalls: [],
    pendingToolCalls: [],
    retryCount: 0,
    startedAt: new Date(),
    metadata: params.metadata ?? {},
  }
}
