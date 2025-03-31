import { IntegrationLocalConfig } from './project-local-config'
import { AiProviderLocalConfig } from './ai-providers'
import { McpConfig } from './mcp-server-config'

export type AiProviderConfig = {
  apiKey?: string
}

/**
 * Configuration scoped to the user, for a given project name
 *
 * Integrations defined here override the project ones
 */
export type UserProjectConfig = {
  integration: IntegrationLocalConfig
  /**
   * The preferred agent to use by default for this project
   */
  defaultAgent?: string
}

/**
 * User-level configuration, stored in ~/.coday/user.yml
 * Contains settings that are specific to the user and
 * should not be shared across users or stored in project
 * configuration files.
 *
 * Currently handles:
 * - AI provider configurations with API keys
 * - MCP server configurations
 * - (future) User preferences
 * - (future) Default settings
 */
export interface UserConfig {
  aiProviders: AiProviderLocalConfig
  /**
   * Table of user-scoped project configuration
   */
  projects?: {
    [key: string]: UserProjectConfig
  }
  /**
   * MCP (Model Context Protocol) server configurations
   */
  mcp?: McpConfig
}

// McpServerConfig has been moved to libs/model/mcp-server-config.ts

/**
 * Initial configuration structure.
 * Used when creating a new user config file
 * or when handling null configurations.
 */
export const DEFAULT_USER_CONFIG: UserConfig = {
  aiProviders: {},
}
