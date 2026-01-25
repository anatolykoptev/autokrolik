import { ChatOpenAI } from '@langchain/openai'
import { ulid } from 'ulid'
import type { HOTLState } from '../state.js'
import type { TaskTier } from '../../types/task.js'
import type { GraphCheckpoint } from '../../types/graph.js'
import { DEFAULT_TIER_CONFIGS } from '../../types/task.js'

const CLASSIFICATION_PROMPT = `You are a task classification system for Human-on-the-Loop AI automation.

Analyze the task and classify it into one of four tiers:

T0 - Fully Automated (Rules Engine):
- Simple, deterministic operations
- Pattern matching, validation, data transformation
- Zero risk tolerance, near-100% confidence required
- Examples: format validation, field mapping, duplicate detection

T1 - Auto-Execute with Async Audit:
- Standard AI tasks with high confidence
- Can be executed automatically, audited later
- Confidence threshold: 85%+
- Examples: text classification, data extraction, summarization

T2 - Human Approval Required:
- Medium confidence or moderate risk
- AI prepares recommendation, human approves
- Confidence threshold: 70-85%
- Examples: content moderation, refund approval, data correction

T3 - Human-Driven with AI Assistance:
- Low confidence or high risk
- Human leads, AI provides suggestions
- Examples: complex decisions, policy exceptions, high-value transactions

Task Type: {{taskType}}
Task Input: {{input}}

Respond with JSON:
{
  "tier": "T0" | "T1" | "T2" | "T3",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation",
  "riskFactors": ["factor1", "factor2"],
  "suggestedApproach": "How to handle this task"
}`

interface ClassificationResult {
  tier: TaskTier
  confidence: number
  reasoning: string
  riskFactors: string[]
  suggestedApproach: string
}

/**
 * Classify Tier Node
 *
 * Uses LLM to classify task complexity and determine appropriate tier.
 * Falls back to T2 if classification fails.
 */
export async function classifyTierNode(
  state: HOTLState
): Promise<Partial<HOTLState>> {
  const model = new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: 0,
  })

  const prompt = CLASSIFICATION_PROMPT.replace('{{taskType}}', state.taskType)
    .replace('{{input}}', JSON.stringify(state.input, null, 2))

  try {
    const response = await model.invoke(prompt)
    const content = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content)

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const result: ClassificationResult = JSON.parse(jsonMatch[0])

    const tierConfig = DEFAULT_TIER_CONFIGS[result.tier]
    const shouldEscalate =
      result.confidence < tierConfig.thresholds.confidenceThreshold

    const checkpoint: GraphCheckpoint = {
      id: ulid(),
      nodeName: 'classify_tier',
      state: {
        determinedTier: result.tier,
        confidenceScore: result.confidence,
        riskFactors: result.riskFactors,
      },
      timestamp: new Date(),
    }

    return {
      currentNode: 'classify_tier',
      nodeHistory: ['classify_tier'],
      determinedTier: result.tier,
      tier: shouldEscalate ? upgradeTier(result.tier) : result.tier,
      confidenceScore: result.confidence,
      checkpoints: [checkpoint],
      contextData: {
        classificationReasoning: result.reasoning,
        riskFactors: result.riskFactors,
        suggestedApproach: result.suggestedApproach,
      },
      metadata: {
        classificationTimestamp: Date.now(),
        classificationModel: 'gpt-4o-mini',
      },
    }
  } catch (error) {
    const checkpoint: GraphCheckpoint = {
      id: ulid(),
      nodeName: 'classify_tier',
      state: {
        error: error instanceof Error ? error.message : 'Unknown error',
        fallbackTier: 'T2',
      },
      timestamp: new Date(),
    }

    return {
      currentNode: 'classify_tier',
      nodeHistory: ['classify_tier'],
      tier: 'T2',
      determinedTier: 'T2',
      confidenceScore: 0.5,
      checkpoints: [checkpoint],
      contextData: {
        classificationError: error instanceof Error ? error.message : 'Unknown',
        fallbackUsed: true,
      },
    }
  }
}

function upgradeTier(tier: TaskTier): TaskTier {
  const upgradeMap: Record<TaskTier, TaskTier> = {
    T0: 'T1',
    T1: 'T2',
    T2: 'T3',
    T3: 'T3',
  }
  return upgradeMap[tier]
}
