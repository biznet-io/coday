import { McpServerConfig, McpServerConfigArgs } from '../../../model/mcp-server-config'

export function formatMcpConfig(config: McpServerConfig): string {
  const json = JSON.stringify(config, undefined, 2)
  return `${getMcpConfigNameAndId(config)}
  ${json}`
}

export function getMcpConfigNameAndId(config: McpServerConfig): string {
  return `${config.name || 'Unnamed'} - ${config.id || 'no id'}`
}

export function sanitizeMcpServerConfig(config: McpServerConfig): McpServerConfig {
  const copy = { ...config }
  if (copy.authToken) {
    copy.authToken = '*****'
  }
  return copy
}

export function mcpServerConfigToArgs(config: McpServerConfig): string {
  return McpServerConfigArgs.map((key) => {
    if (!config[key]) return ''
    let value = config[key]
    // only string arrays expected
    if (Array.isArray(config[key])) {
      value = config[key].join(',')
    }
    // only one Record<string, string> expected
    if (typeof config[key] === 'object') {
      value = Object.keys(config[key])
        .map((k) => `${k}=${config[key][k]}`)
        .join(' ')
    }
    return `--${key} ${value}`
  })
    .filter((s) => !s)
    .join(' ')
}

/**
 * Helper method to clean the server config by converting empty arrays and strings to undefined
 * @param config The server configuration to clean
 */
export function cleanServerConfig(config: McpServerConfig): void {
  // Clean empty arrays
  if (config.args && config.args.length === 0) {
    config.args = undefined
  } else if (config.args) {
    // Filter out empty strings from args
    config.args = config.args.filter(arg => arg.trim() !== '')
    if (config.args.length === 0) {
      config.args = undefined
    }
  }
  
  if (config.allowedTools && config.allowedTools.length === 0) {
    config.allowedTools = undefined
  }
  
  // Clean empty strings
  if (config.url === '') config.url = undefined
  if (config.command === '') config.command = undefined
  if (config.cwd === '') config.cwd = undefined
  // Note: authToken is typically handled separately in the edit flow
  
  // Clean empty env object
  if (config.env && Object.keys(config.env).length === 0) {
    config.env = undefined
  }
}
