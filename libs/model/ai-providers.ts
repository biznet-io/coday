/**
 * Base configuration for an AI provider's authentication.
 * Stored in user configuration, not in project config
 * to avoid multiple configurations of the same provider.
 */
export interface AiProviderConfig {
  apiKey?: string
}

/**
 * Configuration for OpenAI-compatible local LLM providers
 * like LMStudio, llama.cpp server, etc.
 */
export interface LocalLlmConfig extends AiProviderConfig {
  /** Base URL for the local LLM server */
  url: string
  /** Model identifier (optional, depends on implementation) */
  model?: string
  /** Maximum context window size in tokens */
  contextWindow?: number
  /** Temperature for response generation */
  temperature?: number
}

/**
 * AI provider configurations.
 * Each provider is optional but must be configured here
 * to be available (environment variables can only override
 * existing configurations, not enable new providers).
 */
export interface AiProviderLocalConfig {
  /** Anthropic's Claude (recommended) */
  anthropic?: AiProviderConfig
  /** OpenAI's GPT models */
  openai?: AiProviderConfig
  /** Google's Gemini */
  google?: AiProviderConfig
  /** Local LLM with OpenAI-compatible API */
  localLlm?: LocalLlmConfig
}
