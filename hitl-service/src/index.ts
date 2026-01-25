export * from './types/index.js'
export * from './graphs/index.js'

import { createHOTLGraph, createInitialState } from './graphs/index.js'
import { ulid } from 'ulid'

/**
 * HOTL Service - Human-on-the-Loop AI Automation Framework
 *
 * This service provides AI automation with intelligent escalation to humans.
 * AI handles 70-90% of tasks autonomously, escalating edge cases to humans.
 *
 * Formula: High-Quality Model + Context + Tooling + Escalation Logic = High Automation
 *
 * @example
 * ```typescript
 * import { HOTLService } from 'hitl-service'
 *
 * const service = new HOTLService()
 *
 * // Submit a task
 * const result = await service.executeTask({
 *   taskType: 'refund_approval',
 *   input: {
 *     orderId: '12345',
 *     amount: 150,
 *     reason: 'Product damaged',
 *   },
 * })
 *
 * // Check if human review needed
 * if (result.status === 'AWAITING_APPROVAL') {
 *   // Resume with human decision
 *   const finalResult = await service.resumeWithHumanInput(result.taskId, {
 *     decision: 'APPROVE',
 *     reviewerId: 'user-123',
 *   })
 * }
 * ```
 */
export class HOTLService {
  private graph = createHOTLGraph()

  /**
   * Execute a task through the HOTL workflow
   */
  async executeTask(params: {
    taskType: string
    input: Record<string, unknown>
    tier?: 'T0' | 'T1' | 'T2' | 'T3'
    externalId?: string
    metadata?: Record<string, unknown>
  }) {
    const taskId = ulid()

    const initialState = createInitialState({
      taskId,
      taskType: params.taskType,
      input: params.input,
      tier: params.tier,
      externalId: params.externalId,
      metadata: params.metadata,
    })

    const config = {
      configurable: {
        thread_id: taskId,
      },
    }

    const result = await this.graph.invoke(initialState, config)

    return {
      taskId,
      status: result.status,
      output: result.output,
      confidenceScore: result.confidenceScore,
      tier: result.tier,
      escalationId: result.escalationId,
      aiRecommendation: result.aiRecommendation,
    }
  }

  /**
   * Resume a task with human input after escalation
   */
  async resumeWithHumanInput(
    taskId: string,
    humanInput: {
      decision: 'APPROVE' | 'REJECT' | 'DELEGATE' | 'REQUEST_INFO' | 'MODIFY_AND_APPROVE'
      feedback?: string
      modifications?: Record<string, unknown>
      reviewerId: string
    }
  ) {
    const config = {
      configurable: {
        thread_id: taskId,
      },
    }

    const result = await this.graph.invoke(null, config, humanInput)

    return {
      taskId,
      status: result.status,
      output: result.output,
      humanDecision: result.humanDecision,
    }
  }

  /**
   * Get current state of a task
   */
  async getTaskState(taskId: string) {
    const config = {
      configurable: {
        thread_id: taskId,
      },
    }

    return this.graph.getState(config)
  }
}
