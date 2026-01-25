import { z } from 'zod'
import { EscalationReasonSchema } from './task.js'

// =============================================================================
// ENUMS
// =============================================================================

export const EscalationStatus = {
  PENDING: 'PENDING',
  IN_REVIEW: 'IN_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  DELEGATED: 'DELEGATED',
  EXPIRED: 'EXPIRED',
} as const

export type EscalationStatus =
  (typeof EscalationStatus)[keyof typeof EscalationStatus]

export const ReviewerRole = {
  OPERATOR: 'OPERATOR',
  SUPERVISOR: 'SUPERVISOR',
  MANAGER: 'MANAGER',
  ADMIN: 'ADMIN',
  SYSTEM: 'SYSTEM',
} as const

export type ReviewerRole = (typeof ReviewerRole)[keyof typeof ReviewerRole]

export const EscalationDecision = {
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  DELEGATE: 'DELEGATE',
  REQUEST_INFO: 'REQUEST_INFO',
  MODIFY_AND_APPROVE: 'MODIFY_AND_APPROVE',
} as const

export type EscalationDecision =
  (typeof EscalationDecision)[keyof typeof EscalationDecision]

// =============================================================================
// ZOD SCHEMAS
// =============================================================================

export const EscalationStatusSchema = z.enum([
  'PENDING',
  'IN_REVIEW',
  'APPROVED',
  'REJECTED',
  'DELEGATED',
  'EXPIRED',
])

export const ReviewerRoleSchema = z.enum([
  'OPERATOR',
  'SUPERVISOR',
  'MANAGER',
  'ADMIN',
  'SYSTEM',
])

export const EscalationDecisionSchema = z.enum([
  'APPROVE',
  'REJECT',
  'DELEGATE',
  'REQUEST_INFO',
  'MODIFY_AND_APPROVE',
])

export const AIRecommendationSchema = z.object({
  suggestedAction: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  alternatives: z
    .array(
      z.object({
        action: z.string(),
        confidence: z.number().min(0).max(1),
        pros: z.array(z.string()),
        cons: z.array(z.string()),
      })
    )
    .optional(),
  riskAssessment: z
    .object({
      level: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
      factors: z.array(z.string()),
    })
    .optional(),
})

export const EscalationSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  reason: EscalationReasonSchema,
  status: EscalationStatusSchema,
  priority: z.number().int().min(1).max(10).default(5),
  aiRecommendation: AIRecommendationSchema.optional(),
  contextData: z.record(z.unknown()).optional(),
  assignedTo: z.string().uuid().optional(),
  escalatedBy: z.string().uuid().optional(),
  slaDeadline: z.date().optional(),
  createdAt: z.date(),
  resolvedAt: z.date().optional(),
})

export const CreateEscalationSchema = z.object({
  taskId: z.string().uuid(),
  reason: EscalationReasonSchema,
  priority: z.number().int().min(1).max(10).optional(),
  aiRecommendation: AIRecommendationSchema.optional(),
  contextData: z.record(z.unknown()).optional(),
  assignedTo: z.string().uuid().optional(),
  slaMinutes: z.number().int().min(1).optional(),
})

export const EscalationResponseSchema = z.object({
  escalationId: z.string().uuid(),
  reviewerId: z.string().uuid(),
  decision: EscalationDecisionSchema,
  reasoning: z.string().optional(),
  modifications: z.record(z.unknown()).optional(),
  delegateTo: z.string().uuid().optional(),
})

export const ReviewerSchema = z.object({
  id: z.string().uuid(),
  externalId: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: ReviewerRoleSchema,
  isActive: z.boolean().default(true),
  preferences: z
    .object({
      notificationChannels: z.array(z.string()).optional(),
      maxConcurrentEscalations: z.number().int().optional(),
      workingHours: z
        .object({
          start: z.string(),
          end: z.string(),
          timezone: z.string(),
        })
        .optional(),
    })
    .optional(),
})

// =============================================================================
// TYPES
// =============================================================================

export type AIRecommendation = z.infer<typeof AIRecommendationSchema>
export type Escalation = z.infer<typeof EscalationSchema>
export type CreateEscalationInput = z.infer<typeof CreateEscalationSchema>
export type EscalationResponseInput = z.infer<typeof EscalationResponseSchema>
export type Reviewer = z.infer<typeof ReviewerSchema>

export interface EscalationWithContext extends Escalation {
  task: {
    id: string
    taskType: string
    inputData: unknown
    outputData?: unknown
    confidenceScore?: number
    riskScore?: number
  }
  assignee?: Reviewer
  responseHistory: Array<{
    decision: EscalationDecision
    reasoning?: string
    reviewer: Reviewer
    createdAt: Date
  }>
}

export interface EscalationPolicy {
  maxEscalationTime: number // minutes
  reminderIntervals: number[] // minutes after creation
  autoExpireEnabled: boolean
  delegationChain: ReviewerRole[]
  notificationChannels: string[]
}

export const DEFAULT_ESCALATION_POLICY: EscalationPolicy = {
  maxEscalationTime: 240, // 4 hours
  reminderIntervals: [15, 30, 60, 120],
  autoExpireEnabled: true,
  delegationChain: ['OPERATOR', 'SUPERVISOR', 'MANAGER', 'ADMIN'],
  notificationChannels: ['email', 'slack'],
}
