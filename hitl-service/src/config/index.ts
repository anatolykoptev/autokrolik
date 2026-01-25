import { z } from 'zod'

const ConfigSchema = z.object({
  // Database
  database: z.object({
    url: z.string().default('postgresql://localhost:5432/hitl'),
    poolSize: z.number().int().min(1).default(10),
  }),

  // Redis
  redis: z.object({
    url: z.string().default('redis://localhost:6379'),
  }),

  // VibeProxy (OpenAI-compatible API for Claude, Gemini, etc.)
  vibeproxy: z.object({
    baseUrl: z.string().default('http://localhost:8318/v1'),
    apiKey: z.string().default('sk-vibeproxy-dummy'),
    executionModel: z.string().default('gemini-claude-sonnet-4-5-thinking'),
    classificationModel: z.string().default('gemini-2.0-flash-exp'),
    reasoningModel: z.string().default('gemini-claude-opus-4-5-thinking'),
  }),

  // Tier Thresholds
  tiers: z.object({
    t0ConfidenceThreshold: z.number().min(0).max(1).default(0.99),
    t1ConfidenceThreshold: z.number().min(0).max(1).default(0.85),
    t2ConfidenceThreshold: z.number().min(0).max(1).default(0.7),
    defaultRiskThreshold: z.number().min(0).max(1).default(0.5),
  }),

  // Escalation
  escalation: z.object({
    defaultSlaMinutes: z.number().int().min(1).default(60),
    maxEscalationTimeMinutes: z.number().int().min(1).default(240),
    reminderIntervalsMinutes: z.array(z.number()).default([15, 30, 60, 120]),
    autoExpireEnabled: z.boolean().default(true),
  }),

  // Observability
  observability: z.object({
    otlpEndpoint: z.string().optional(),
    prometheusEnabled: z.boolean().default(true),
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  }),

  // Server
  server: z.object({
    port: z.number().int().min(1).max(65535).default(3000),
    host: z.string().default('0.0.0.0'),
  }),
})

export type Config = z.infer<typeof ConfigSchema>

function loadConfig(): Config {
  const rawConfig = {
    database: {
      url: process.env['DATABASE_URL'],
      poolSize: parseInt(process.env['DATABASE_POOL_SIZE'] ?? '10', 10),
    },
    redis: {
      url: process.env['REDIS_URL'],
    },
    vibeproxy: {
      baseUrl: process.env['VIBEPROXY_BASE_URL'],
      apiKey: process.env['VIBEPROXY_API_KEY'],
      executionModel: process.env['VIBEPROXY_EXECUTION_MODEL'],
      classificationModel: process.env['VIBEPROXY_CLASSIFICATION_MODEL'],
      reasoningModel: process.env['VIBEPROXY_REASONING_MODEL'],
    },
    tiers: {
      t0ConfidenceThreshold: parseFloat(
        process.env['T0_CONFIDENCE_THRESHOLD'] ?? '0.99'
      ),
      t1ConfidenceThreshold: parseFloat(
        process.env['T1_CONFIDENCE_THRESHOLD'] ?? '0.85'
      ),
      t2ConfidenceThreshold: parseFloat(
        process.env['T2_CONFIDENCE_THRESHOLD'] ?? '0.7'
      ),
      defaultRiskThreshold: parseFloat(
        process.env['DEFAULT_RISK_THRESHOLD'] ?? '0.5'
      ),
    },
    escalation: {
      defaultSlaMinutes: parseInt(
        process.env['ESCALATION_DEFAULT_SLA_MINUTES'] ?? '60',
        10
      ),
      maxEscalationTimeMinutes: parseInt(
        process.env['ESCALATION_MAX_TIME_MINUTES'] ?? '240',
        10
      ),
      reminderIntervalsMinutes: process.env['ESCALATION_REMINDER_INTERVALS']
        ?.split(',')
        .map((n) => parseInt(n, 10)),
      autoExpireEnabled:
        process.env['ESCALATION_AUTO_EXPIRE'] !== 'false',
    },
    observability: {
      otlpEndpoint: process.env['OTLP_ENDPOINT'],
      prometheusEnabled: process.env['PROMETHEUS_ENABLED'] !== 'false',
      logLevel: process.env['LOG_LEVEL'] as 'debug' | 'info' | 'warn' | 'error',
    },
    server: {
      port: parseInt(process.env['PORT'] ?? '3000', 10),
      host: process.env['HOST'],
    },
  }

  return ConfigSchema.parse(rawConfig)
}

export const config = loadConfig()
