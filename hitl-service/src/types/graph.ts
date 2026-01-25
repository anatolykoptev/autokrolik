import { z } from 'zod'
import type { TaskTier, TaskStatus, EscalationReason } from './task.js'
import type { AIRecommendation, EscalationDecision } from './escalation.js'

// =============================================================================
// LANGGRAPH STATE
// =============================================================================

export interface HOTLGraphState {
  // Task identification
  taskId: string
  externalId?: string
  taskType: string

  // Input/Output
  input: Record<string, unknown>
  output?: Record<string, unknown>

  // Classification
  tier: TaskTier
  determinedTier?: TaskTier

  // Execution state
  status: TaskStatus
  currentNode: string
  nodeHistory: string[]
  checkpoints: GraphCheckpoint[]

  // AI assessment
  confidenceScore?: number
  riskScore?: number
  aiRecommendation?: AIRecommendation

  // Escalation
  escalationId?: string
  escalationReason?: EscalationReason
  humanDecision?: EscalationDecision
  humanFeedback?: string
  humanModifications?: Record<string, unknown>

  // Context
  contextData: Record<string, unknown>
  messages: GraphMessage[]

  // Tool execution
  toolCalls: ToolCallRecord[]
  pendingToolCalls: ToolCallRequest[]

  // Error handling
  error?: GraphError
  retryCount: number

  // Metadata
  startedAt: Date
  metadata: Record<string, unknown>
}

export interface GraphCheckpoint {
  id: string
  nodeName: string
  state: Partial<HOTLGraphState>
  timestamp: Date
}

export interface GraphMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  name?: string
  toolCallId?: string
  metadata?: Record<string, unknown>
}

export interface ToolCallRequest {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface ToolCallRecord {
  id: string
  name: string
  arguments: Record<string, unknown>
  result?: unknown
  error?: string
  startedAt: Date
  completedAt?: Date
  durationMs?: number
}

export interface GraphError {
  code: string
  message: string
  details?: unknown
  recoverable: boolean
  retryAfterMs?: number
}

// =============================================================================
// ZOD SCHEMAS FOR STATE VALIDATION
// =============================================================================

export const GraphCheckpointSchema = z.object({
  id: z.string(),
  nodeName: z.string(),
  state: z.record(z.unknown()),
  timestamp: z.date(),
})

export const GraphMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string(),
  name: z.string().optional(),
  toolCallId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const ToolCallRequestSchema = z.object({
  id: z.string(),
  name: z.string(),
  arguments: z.record(z.unknown()),
})

export const ToolCallRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  arguments: z.record(z.unknown()),
  result: z.unknown().optional(),
  error: z.string().optional(),
  startedAt: z.date(),
  completedAt: z.date().optional(),
  durationMs: z.number().optional(),
})

export const GraphErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
  recoverable: z.boolean(),
  retryAfterMs: z.number().optional(),
})

// =============================================================================
// NODE DEFINITIONS
// =============================================================================

export const GraphNodes = {
  // Entry & Classification
  ENTRY: 'entry',
  CLASSIFY_TIER: 'classify_tier',

  // Execution paths
  RULES_ENGINE: 'rules_engine', // T0
  AI_EXECUTE: 'ai_execute', // T1, T2
  TOOL_EXECUTOR: 'tool_executor',

  // Human interaction
  HUMAN_REVIEW: 'human_review',
  AWAIT_APPROVAL: 'await_approval',
  PROCESS_FEEDBACK: 'process_feedback',

  // Escalation
  ESCALATE: 'escalate',
  AUTO_ESCALATE: 'auto_escalate',

  // Completion
  FINALIZE: 'finalize',
  ERROR_HANDLER: 'error_handler',
  EXIT: 'exit',
} as const

export type GraphNode = (typeof GraphNodes)[keyof typeof GraphNodes]

export const GraphEdges = {
  // From ENTRY
  ENTRY_TO_CLASSIFY: { from: 'entry', to: 'classify_tier' },

  // From CLASSIFY_TIER
  CLASSIFY_TO_RULES: { from: 'classify_tier', to: 'rules_engine' },
  CLASSIFY_TO_AI: { from: 'classify_tier', to: 'ai_execute' },
  CLASSIFY_TO_HUMAN: { from: 'classify_tier', to: 'human_review' },

  // From AI_EXECUTE
  AI_TO_TOOLS: { from: 'ai_execute', to: 'tool_executor' },
  AI_TO_ESCALATE: { from: 'ai_execute', to: 'escalate' },
  AI_TO_FINALIZE: { from: 'ai_execute', to: 'finalize' },
  AI_TO_AWAIT: { from: 'ai_execute', to: 'await_approval' },

  // From TOOL_EXECUTOR
  TOOLS_TO_AI: { from: 'tool_executor', to: 'ai_execute' },
  TOOLS_TO_ERROR: { from: 'tool_executor', to: 'error_handler' },

  // From AWAIT_APPROVAL
  AWAIT_TO_PROCESS: { from: 'await_approval', to: 'process_feedback' },
  AWAIT_TO_AUTO_ESCALATE: { from: 'await_approval', to: 'auto_escalate' },

  // From PROCESS_FEEDBACK
  FEEDBACK_TO_AI: { from: 'process_feedback', to: 'ai_execute' },
  FEEDBACK_TO_FINALIZE: { from: 'process_feedback', to: 'finalize' },
  FEEDBACK_TO_ESCALATE: { from: 'process_feedback', to: 'escalate' },

  // From ESCALATE
  ESCALATE_TO_AWAIT: { from: 'escalate', to: 'await_approval' },

  // From ERROR_HANDLER
  ERROR_TO_AI: { from: 'error_handler', to: 'ai_execute' },
  ERROR_TO_ESCALATE: { from: 'error_handler', to: 'escalate' },
  ERROR_TO_EXIT: { from: 'error_handler', to: 'exit' },

  // Terminal
  FINALIZE_TO_EXIT: { from: 'finalize', to: 'exit' },
  RULES_TO_EXIT: { from: 'rules_engine', to: 'exit' },
} as const

// =============================================================================
// NODE CONFIG
// =============================================================================

export interface NodeConfig {
  name: GraphNode
  timeout?: number // ms
  retryable: boolean
  maxRetries: number
  checkpointBefore: boolean
  checkpointAfter: boolean
}

export const DEFAULT_NODE_CONFIGS: Record<GraphNode, NodeConfig> = {
  entry: {
    name: 'entry',
    timeout: 5000,
    retryable: false,
    maxRetries: 0,
    checkpointBefore: false,
    checkpointAfter: true,
  },
  classify_tier: {
    name: 'classify_tier',
    timeout: 10000,
    retryable: true,
    maxRetries: 2,
    checkpointBefore: false,
    checkpointAfter: true,
  },
  rules_engine: {
    name: 'rules_engine',
    timeout: 5000,
    retryable: true,
    maxRetries: 3,
    checkpointBefore: true,
    checkpointAfter: true,
  },
  ai_execute: {
    name: 'ai_execute',
    timeout: 60000,
    retryable: true,
    maxRetries: 2,
    checkpointBefore: true,
    checkpointAfter: true,
  },
  tool_executor: {
    name: 'tool_executor',
    timeout: 30000,
    retryable: true,
    maxRetries: 2,
    checkpointBefore: true,
    checkpointAfter: true,
  },
  human_review: {
    name: 'human_review',
    timeout: undefined, // No timeout for human review
    retryable: false,
    maxRetries: 0,
    checkpointBefore: true,
    checkpointAfter: true,
  },
  await_approval: {
    name: 'await_approval',
    timeout: 14400000, // 4 hours
    retryable: false,
    maxRetries: 0,
    checkpointBefore: true,
    checkpointAfter: true,
  },
  process_feedback: {
    name: 'process_feedback',
    timeout: 10000,
    retryable: true,
    maxRetries: 2,
    checkpointBefore: true,
    checkpointAfter: true,
  },
  escalate: {
    name: 'escalate',
    timeout: 10000,
    retryable: true,
    maxRetries: 3,
    checkpointBefore: true,
    checkpointAfter: true,
  },
  auto_escalate: {
    name: 'auto_escalate',
    timeout: 10000,
    retryable: true,
    maxRetries: 2,
    checkpointBefore: true,
    checkpointAfter: true,
  },
  finalize: {
    name: 'finalize',
    timeout: 10000,
    retryable: true,
    maxRetries: 2,
    checkpointBefore: true,
    checkpointAfter: false,
  },
  error_handler: {
    name: 'error_handler',
    timeout: 10000,
    retryable: false,
    maxRetries: 0,
    checkpointBefore: true,
    checkpointAfter: true,
  },
  exit: {
    name: 'exit',
    timeout: 5000,
    retryable: false,
    maxRetries: 0,
    checkpointBefore: false,
    checkpointAfter: false,
  },
}
