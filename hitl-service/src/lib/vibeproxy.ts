/**
 * VibeProxy Integration for HITL Service
 *
 * Provides LangChain-compatible models via local VibeProxy server.
 * VibeProxy offers OpenAI-compatible API for multiple providers:
 * - Antigravity (Claude Opus/Sonnet via Google)
 * - Gemini models
 * - And more
 *
 * @module lib/vibeproxy
 */

import { ChatOpenAI } from '@langchain/openai'

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_BASE_URL = 'http://localhost:8318/v1'
const DEFAULT_API_KEY = 'sk-vibeproxy-dummy'

/**
 * Model aliases for common use cases
 * Priority: thinking models for better reasoning
 */
export const VIBEPROXY_MODELS = {
  // Claude via Antigravity (free via Google account)
  OPUS: 'gemini-claude-opus-4-5-thinking',
  SONNET: 'gemini-claude-sonnet-4-5-thinking',
  SONNET_FAST: 'gemini-claude-sonnet-4-5',

  // Gemini models
  FLASH: 'gemini-2.0-flash-exp',
  PRO: 'gemini-2.0-pro-exp',
  GEMINI_3_PRO: 'gemini-3-pro-image-preview',
} as const

/**
 * Short aliases mapping
 */
const MODEL_ALIASES: Record<string, string> = {
  opus: VIBEPROXY_MODELS.OPUS,
  sonnet: VIBEPROXY_MODELS.SONNET,
  'sonnet-fast': VIBEPROXY_MODELS.SONNET_FAST,
  flash: VIBEPROXY_MODELS.FLASH,
  pro: VIBEPROXY_MODELS.PRO,
  'gemini-3-pro': VIBEPROXY_MODELS.GEMINI_3_PRO,
  // Claude aliases
  'claude-opus': VIBEPROXY_MODELS.OPUS,
  'claude-sonnet': VIBEPROXY_MODELS.SONNET,
  'vibe-opus': VIBEPROXY_MODELS.OPUS,
  'vibe-sonnet': VIBEPROXY_MODELS.SONNET,
}

// =============================================================================
// TYPES
// =============================================================================

export interface VibeProxyConfig {
  baseUrl?: string
  apiKey?: string
}

export interface CreateModelOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  config?: VibeProxyConfig
}

// =============================================================================
// FUNCTIONS
// =============================================================================

/**
 * Resolve model alias to full model ID
 */
export function resolveModel(modelOrAlias: string): string {
  return MODEL_ALIASES[modelOrAlias.toLowerCase()] ?? modelOrAlias
}

/**
 * Get VibeProxy configuration from environment or defaults
 */
export function getVibeProxyConfig(overrides?: VibeProxyConfig): {
  baseUrl: string
  apiKey: string
} {
  return {
    baseUrl:
      overrides?.baseUrl ??
      process.env['VIBEPROXY_BASE_URL'] ??
      DEFAULT_BASE_URL,
    apiKey:
      overrides?.apiKey ?? process.env['VIBEPROXY_API_KEY'] ?? DEFAULT_API_KEY,
  }
}

/**
 * Create a ChatOpenAI instance configured for VibeProxy
 *
 * @example
 * ```typescript
 * // Use default sonnet model
 * const model = createVibeProxyModel()
 *
 * // Use opus for complex tasks
 * const opusModel = createVibeProxyModel({ model: 'opus' })
 *
 * // Use flash for fast classification
 * const flashModel = createVibeProxyModel({ model: 'flash', temperature: 0 })
 * ```
 */
export function createVibeProxyModel(options?: CreateModelOptions): ChatOpenAI {
  const config = getVibeProxyConfig(options?.config)
  const resolvedModel = resolveModel(options?.model ?? 'sonnet')

  return new ChatOpenAI({
    modelName: resolvedModel,
    temperature: options?.temperature ?? 0.7,
    maxTokens: options?.maxTokens ?? 8192,
    configuration: {
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
    },
  })
}

/**
 * Create a model optimized for classification tasks
 * Uses flash model with zero temperature for deterministic output
 */
export function createClassificationModel(
  config?: VibeProxyConfig
): ChatOpenAI {
  return createVibeProxyModel({
    model: 'flash',
    temperature: 0,
    maxTokens: 1024,
    config,
  })
}

/**
 * Create a model optimized for execution tasks
 * Uses sonnet model with low temperature for reliable output
 */
export function createExecutionModel(config?: VibeProxyConfig): ChatOpenAI {
  return createVibeProxyModel({
    model: 'sonnet',
    temperature: 0.1,
    maxTokens: 8192,
    config,
  })
}

/**
 * Create a model optimized for complex reasoning
 * Uses opus model with moderate temperature
 */
export function createReasoningModel(config?: VibeProxyConfig): ChatOpenAI {
  return createVibeProxyModel({
    model: 'opus',
    temperature: 0.3,
    maxTokens: 16384,
    config,
  })
}

/**
 * Check if VibeProxy is available
 */
export async function isVibeProxyAvailable(
  config?: VibeProxyConfig
): Promise<boolean> {
  const { baseUrl, apiKey } = getVibeProxyConfig(config)

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)

    const response = await fetch(`${baseUrl}/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    return response.ok
  } catch {
    return false
  }
}

/**
 * List available models from VibeProxy
 */
export async function listVibeProxyModels(config?: VibeProxyConfig): Promise<
  Array<{
    id: string
    owned_by: string
  }>
> {
  const { baseUrl, apiKey } = getVibeProxyConfig(config)

  const response = await fetch(`${baseUrl}/models`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to list models: ${response.status}`)
  }

  const data = (await response.json()) as {
    data: Array<{ id: string; owned_by: string }>
  }
  return data.data
}
