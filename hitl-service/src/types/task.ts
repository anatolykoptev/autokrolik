import { z } from 'zod'

// =============================================================================
// ENUMS
// =============================================================================

export const TaskTier = {
  T0: 'T0', // Fully automated (rules engine) - 60%
  T1: 'T1', // Auto-execute with async audit - 20%
  T2: 'T2', // Human approval required - 15%
  T3: 'T3', // Human-driven with AI assistance - 5%
} as const

export type TaskTier = (typeof TaskTier)[keyof typeof TaskTier]

export const TaskStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  AWAITING_APPROVAL: 'AWAITING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  ESCALATED: 'ESCALATED',
} as const

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus]

export const EscalationReason = {
  LOW_CONFIDENCE: 'LOW_CONFIDENCE',
  HIGH_RISK: 'HIGH_RISK',
  THRESHOLD_EXCEEDED: 'THRESHOLD_EXCEEDED',
  ANOMALY_DETECTED: 'ANOMALY_DETECTED',
  POLICY_VIOLATION: 'POLICY_VIOLATION',
  MANUAL_REQUEST: 'MANUAL_REQUEST',
  TIMEOUT: 'TIMEOUT',
  ERROR: 'ERROR',
} as const

export type EscalationReason =
  (typeof EscalationReason)[keyof typeof EscalationReason]

export const DecisionType = {
  CLASSIFICATION: 'CLASSIFICATION',
  GENERATION: 'GENERATION',
  EXTRACTION: 'EXTRACTION',
  TOOL_CALL: 'TOOL_CALL',
  ROUTING: 'ROUTING',
  ESCALATION: 'ESCALATION',
} as const

export type DecisionType = (typeof DecisionType)[keyof typeof DecisionType]

// =============================================================================
// ZOD SCHEMAS
// =============================================================================

export const TaskTierSchema = z.enum(['T0', 'T1', 'T2', 'T3'])

export const TaskStatusSchema = z.enum([
  'PENDING',
  'RUNNING',
  'AWAITING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'ESCALATED',
])

export const EscalationReasonSchema = z.enum([
  'LOW_CONFIDENCE',
  'HIGH_RISK',
  'THRESHOLD_EXCEEDED',
  'ANOMALY_DETECTED',
  'POLICY_VIOLATION',
  'MANUAL_REQUEST',
  'TIMEOUT',
  'ERROR',
])

export const TaskInputSchema = z.object({
  taskType: z.string(),
  payload: z.record(z.unknown()),
  context: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const TaskOutputSchema = z.object({
  result: z.unknown(),
  confidence: z.number().min(0).max(1).optional(),
  reasoning: z.string().optional(),
  artifacts: z.array(z.record(z.unknown())).optional(),
})

export const AITaskSchema = z.object({
  id: z.string().uuid(),
  externalId: z.string().optional(),
  tier: TaskTierSchema,
  status: TaskStatusSchema,
  taskType: z.string(),
  inputData: TaskInputSchema,
  outputData: TaskOutputSchema.optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
  riskScore: z.number().min(0).max(1).optional(),
  metadata: z.record(z.unknown()).optional(),
  errorMessage: z.string().optional(),
  retryCount: z.number().int().min(0).default(0),
  maxRetries: z.number().int().min(0).default(3),
  parentTaskId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  deadlineAt: z.date().optional(),
})

export const CreateTaskSchema = z.object({
  taskType: z.string(),
  inputData: TaskInputSchema,
  tier: TaskTierSchema.optional(),
  externalId: z.string().optional(),
  parentTaskId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
  deadlineAt: z.date().optional(),
})

// =============================================================================
// TYPES
// =============================================================================

export type TaskInput = z.infer<typeof TaskInputSchema>
export type TaskOutput = z.infer<typeof TaskOutputSchema>
export type AITask = z.infer<typeof AITaskSchema>
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>

export interface TaskThresholds {
  confidenceThreshold: number
  riskThreshold: number
  escalationSlaMinutes: number
  maxRetries: number
}

export interface TierConfig {
  tier: TaskTier
  thresholds: TaskThresholds
  autoExecute: boolean
  requiresApproval: boolean
  asyncAudit: boolean
}

export const DEFAULT_TIER_CONFIGS: Record<TaskTier, TierConfig> = {
  T0: {
    tier: 'T0',
    thresholds: {
      confidenceThreshold: 0.99,
      riskThreshold: 0.01,
      escalationSlaMinutes: 0,
      maxRetries: 0,
    },
    autoExecute: true,
    requiresApproval: false,
    asyncAudit: false,
  },
  T1: {
    tier: 'T1',
    thresholds: {
      confidenceThreshold: 0.85,
      riskThreshold: 0.3,
      escalationSlaMinutes: 60,
      maxRetries: 3,
    },
    autoExecute: true,
    requiresApproval: false,
    asyncAudit: true,
  },
  T2: {
    tier: 'T2',
    thresholds: {
      confidenceThreshold: 0.7,
      riskThreshold: 0.5,
      escalationSlaMinutes: 30,
      maxRetries: 2,
    },
    autoExecute: false,
    requiresApproval: true,
    asyncAudit: true,
  },
  T3: {
    tier: 'T3',
    thresholds: {
      confidenceThreshold: 0.0,
      riskThreshold: 1.0,
      escalationSlaMinutes: 15,
      maxRetries: 1,
    },
    autoExecute: false,
    requiresApproval: true,
    asyncAudit: true,
  },
}
