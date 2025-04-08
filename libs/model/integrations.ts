/**
 * Aggregation of simple integrations and those that are grouped
 * Example: AI integration depends on having at least one of the AI provider integration defined.
 */
export const Integrations: Record<string, string[]> = {
  CONFLUENCE: [],
  GIT: [],
  GITLAB: [],
  JIRA: [],
  MCP: [],
  // Note: MCP_* server-specific integrations are generated dynamically at runtime
}

export const ConcreteIntegrations: string[] = Object.keys(Integrations).filter((k) => Integrations[k]?.length === 0)

// Dynamic integrations like MCP server-specific ones (MCP_*) should be added at runtime
