import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { ulid } from 'ulid'
import type { HOTLState } from '../state.js'
import type { GraphCheckpoint, ToolCallRequest } from '../../types/graph.js'
import { createExecutionModel, VIBEPROXY_MODELS } from '../../lib/vibeproxy.js'

const EXECUTION_SYSTEM_PROMPT = `You are an AI agent executing tasks in a Human-on-the-Loop system.

Your goal is to complete the given task accurately and safely.

Guidelines:
1. Analyze the task thoroughly before acting
2. Use available tools when needed
3. Provide clear reasoning for your decisions
4. Report confidence level (0.0-1.0) in your output
5. Flag any risks or concerns

If you need human input, clearly state what information is missing.
If the task seems risky or ambiguous, recommend escalation.

Available context:
{{context}}

Task Type: {{taskType}}
Task Tier: {{tier}} ({{tierDescription}})
`

const TIER_DESCRIPTIONS: Record<string, string> = {
  T0: 'Fully automated - execute deterministic rules',
  T1: 'Auto-execute with audit - proceed if confident',
  T2: 'Approval required - prepare recommendation for human',
  T3: 'Human-driven - assist and suggest only',
}

interface ExecutionResult {
  output: Record<string, unknown>
  confidence: number
  reasoning: string
  toolCallsNeeded?: ToolCallRequest[]
  shouldEscalate?: boolean
  escalationReason?: string
}

/**
 * AI Execute Node
 *
 * Main AI execution node that processes tasks based on their tier.
 * Uses LLM with optional tool calling for complex tasks.
 */
export async function aiExecuteNode(
  state: HOTLState
): Promise<Partial<HOTLState>> {
  // Use VibeProxy sonnet model for execution
  const model = createExecutionModel()

  const systemPrompt = EXECUTION_SYSTEM_PROMPT
    .replace('{{context}}', JSON.stringify(state.contextData, null, 2))
    .replace('{{taskType}}', state.taskType)
    .replace('{{tier}}', state.tier)
    .replace('{{tierDescription}}', TIER_DESCRIPTIONS[state.tier] ?? 'Unknown')

  const userPrompt = buildUserPrompt(state)

  try {
    const response = await model.invoke([
      new SystemMessage(systemPrompt),
      ...state.messages,
      new HumanMessage(userPrompt),
    ])

    const content = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content)

    const result = parseExecutionResult(content, state)

    const checkpoint: GraphCheckpoint = {
      id: ulid(),
      nodeName: 'ai_execute',
      state: {
        output: result.output,
        confidence: result.confidence,
        shouldEscalate: result.shouldEscalate,
      },
      timestamp: new Date(),
    }

    const newStatus = determineNextStatus(state.tier, result)

    return {
      status: newStatus,
      currentNode: 'ai_execute',
      nodeHistory: ['ai_execute'],
      output: result.output,
      confidenceScore: result.confidence,
      pendingToolCalls: result.toolCallsNeeded ?? [],
      checkpoints: [checkpoint],
      messages: [response],
      contextData: {
        executionReasoning: result.reasoning,
        executionTimestamp: Date.now(),
      },
      metadata: {
        executionModel: VIBEPROXY_MODELS.SONNET,
        shouldEscalate: result.shouldEscalate,
        escalationReason: result.escalationReason,
      },
    }
  } catch (error) {
    const checkpoint: GraphCheckpoint = {
      id: ulid(),
      nodeName: 'ai_execute',
      state: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      timestamp: new Date(),
    }

    return {
      currentNode: 'ai_execute',
      nodeHistory: ['ai_execute'],
      checkpoints: [checkpoint],
      error: {
        code: 'AI_EXECUTION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        recoverable: true,
        retryAfterMs: 5000,
      },
      retryCount: state.retryCount + 1,
    }
  }
}

function buildUserPrompt(state: HOTLState): string {
  const parts: string[] = [
    `Task: ${state.taskType}`,
    `Input: ${JSON.stringify(state.input, null, 2)}`,
  ]

  if (state.humanFeedback) {
    parts.push(`Human Feedback: ${state.humanFeedback}`)
  }

  if (state.humanModifications) {
    parts.push(`Human Modifications: ${JSON.stringify(state.humanModifications, null, 2)}`)
  }

  if (state.toolCalls.length > 0) {
    const lastToolCall = state.toolCalls[state.toolCalls.length - 1]
    if (lastToolCall) {
      parts.push(`Previous Tool Result: ${JSON.stringify(lastToolCall.result)}`)
    }
  }

  parts.push(`
Please complete this task. Respond with JSON:
{
  "output": { /* task result */ },
  "confidence": 0.0-1.0,
  "reasoning": "Explanation of your approach",
  "shouldEscalate": true/false,
  "escalationReason": "If shouldEscalate is true, explain why"
}`)

  return parts.join('\n\n')
}

function parseExecutionResult(
  content: string,
  state: HOTLState
): ExecutionResult {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        output: parsed.output ?? {},
        confidence: parsed.confidence ?? 0.5,
        reasoning: parsed.reasoning ?? 'No reasoning provided',
        shouldEscalate: parsed.shouldEscalate ?? false,
        escalationReason: parsed.escalationReason,
      }
    }
  } catch {
    // Parse failed, use fallback
  }

  return {
    output: { rawResponse: content },
    confidence: 0.5,
    reasoning: 'Could not parse structured response',
    shouldEscalate: true,
    escalationReason: 'Unstructured AI response requires human review',
  }
}

function determineNextStatus(
  tier: string,
  result: ExecutionResult
): 'COMPLETED' | 'AWAITING_APPROVAL' | 'ESCALATED' | 'RUNNING' {
  if (result.shouldEscalate) {
    return 'ESCALATED'
  }

  if (tier === 'T0' || tier === 'T1') {
    return result.confidence >= 0.85 ? 'COMPLETED' : 'AWAITING_APPROVAL'
  }

  if (tier === 'T2') {
    return 'AWAITING_APPROVAL'
  }

  // T3
  return 'AWAITING_APPROVAL'
}
