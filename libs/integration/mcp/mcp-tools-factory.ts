import { AssistantToolFactory, CodayTool } from '../assistant-tool-factory'
import { CommandContext, Interactor, McpServerConfig } from '../../model'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { ResourceTemplate, ToolInfo } from './types'

export class McpToolsFactory extends AssistantToolFactory {
  private client: Client | undefined
  name: string = 'Not defined yet'

  constructor(
    interactor: Interactor,
    private serverConfig: McpServerConfig
  ) {
    super(interactor)
    this.name = serverConfig.name
  }
  
  /**
   * Helper method to log tool calls in a standardized, readable format
   * 
   * @param integration Name of the integration/server
   * @param toolName Name of the tool being called
   * @param args Arguments passed to the tool
   */
  private logToolCall(integration: string, toolName: string, args: Record<string, any>): void {
    // Format the arguments for display
    const formattedArgs = this.formatToolArgs(args);
    
    this.interactor.displayText(`MCP Tool Call: [${integration}] ${toolName} | Args: ${formattedArgs}`);
  }
  
  /**
   * Format tool arguments for logging in a concise way
   * 
   * @param args Arguments object to format
   * @returns Formatted string representation of arguments
   */
  private formatToolArgs(args: Record<string, any>): string {
    if (!args || Object.keys(args).length === 0) {
      return 'none';
    }
    
    // Convert args to string representation
    return Object.entries(args).map(([key, value]) => {
      // Format the value based on its type and length
      let formattedValue: string;
      
      if (typeof value === 'string') {
        // For strings, truncate if too long
        const MAX_STRING_LENGTH = 100;
        if (value.length > MAX_STRING_LENGTH) {
          formattedValue = `"${value.substring(0, MAX_STRING_LENGTH)}..." (${value.length} chars)`;
        } else {
          formattedValue = `"${value}"`;
        }
      } else if (Array.isArray(value)) {
        // For arrays, show length and first few items
        const MAX_ARRAY_ITEMS = 3;
        formattedValue = value.length > MAX_ARRAY_ITEMS 
          ? `[${value.slice(0, MAX_ARRAY_ITEMS).join(', ')}...] (${value.length} items)` 
          : `[${value.join(', ')}]`;
      } else if (value === null) {
        formattedValue = 'null';
      } else if (typeof value === 'object') {
        // For objects, show a summary
        const keys = Object.keys(value);
        formattedValue = `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}} (${keys.length} props)`;
      } else {
        // For other types (number, boolean, etc.)
        formattedValue = String(value);
      }
      
      return `${key}: ${formattedValue}`;
    }).join(', ');
  }

  async kill(): Promise<void> {
    this.tools = []
    console.log(`Closing mcp client ${this.serverConfig.name}`)
    await this.client?.close()
    console.log(`Closed mcp client ${this.serverConfig.name}`)
  }

  protected async buildTools(context: CommandContext, agentName: string): Promise<CodayTool[]> {
    if (this.tools.length) return this.tools
    if (!this.serverConfig.enabled) return []

    // now time to create the client
    this.client = new Client(
      {
        name: 'Coday MCP Client',
        version: '1.0.0',
      },
      {
        capabilities: {
          // Add supported capabilities
          // Note: These may need to be adjusted based on actual needs
          toolInvocation: {},
          resources: {},
        },
      }
    )

    // Create the appropriate transport based on the server configuration
    let transport: Transport

    // For now, only support command-based stdio transport
    if (this.serverConfig.url) {
      throw new Error(`Remote HTTP/HTTPS MCP servers are not supported yet. Use local command-based servers instead.`)
    } else if (this.serverConfig.command) {
      // Stdio transport - launch the command as a child process
      const transportOptions: any = {
        command: this.serverConfig.command,
        args: this.serverConfig.args || [],
      }

      // Add environment variables if specified
      if (this.serverConfig.env && Object.keys(this.serverConfig.env).length > 0) {
        transportOptions.env = this.serverConfig.env
        this.interactor.displayText(`Using custom environment variables for MCP server ${this.serverConfig.name}`)
      }

      // Add working directory if specified
      if (this.serverConfig.cwd) {
        transportOptions.cwd = this.serverConfig.cwd
        this.interactor.displayText(`Using working directory: ${this.serverConfig.cwd}`)
      }

      transport = new StdioClientTransport(transportOptions)
      this.interactor.displayText(
        `Starting MCP server ${this.serverConfig.name} with command: ${this.serverConfig.command}`
      )
    } else {
      throw new Error(
        `MCP server ${this.serverConfig.name} has no command configured. Only local command-based servers are supported.`
      )
    }

    // Connect to the server
    await this.client.connect(transport)

    // Get all resource templates from the server
    try {
      const result = await this.client.listResourceTemplates()
      if (result && result.templates && Array.isArray(result.templates)) {
        for (const template of result.templates) {
          this.tools.push(this.createResourceTool(this.serverConfig, this.client, template))
        }
      }
    } catch (err) {
      // Method not found errors (-32601) are expected for MCP servers that don't implement resource templates
      // Only warn if it's not a method not found error
      if (err instanceof Error && !err.message.includes('-32601: Method not found')) {
        this.interactor.warn(`Error listing resource templates from MCP server ${this.serverConfig.name}: ${err}`)
      } else {
        // Use displayText instead of debug (which doesn't exist on Interactor)
        this.interactor.displayText(`MCP server ${this.serverConfig.name} doesn't support resource templates, continuing with tools only.`)
      }
    }

    // Get all tools from the server
    try {
      const result = await this.client.listTools()
      if (result && result.tools && Array.isArray(result.tools)) {
        for (const tool of result.tools) {
          this.tools.push(this.createFunctionTool(this.serverConfig, this.client, tool as ToolInfo))
        }
      }
    } catch (err) {
      this.interactor.warn(`Error listing tools from MCP server ${this.serverConfig.name}: ${err}`)
    }
    return this.tools
  }

  /**
   * Create a Coday tool for an MCP resource
   *
   * @param serverConfig The MCP server configuration
   * @param client The MCP client instance
   * @param resource The MCP resource definition
   */
  private createResourceTool(serverConfig: McpServerConfig, client: Client, resource: ResourceTemplate): CodayTool {
    const resourceName = `mcp__${serverConfig.id}__${resource.name}`

    const getResource = async (args: Record<string, any>) => {
      // Log the resource call with smart formatting
      this.logToolCall(serverConfig.name, resource.name, args);
      
      try {
        // Build the resource URI with parameters
        const uri = resource.uriTemplate.replace(/\{([^}]+)\}/g, (match: string, param: string) => {
          return encodeURIComponent(args[param] || '')
        })

        // Fetch the resource
        const result = await client.readResource({ uri })

        if (!result || !result.contents) {
          throw new Error(`No content returned from resource ${resource.name}`)
        }

        // Return the content as a string or JSON
        return result.contents.map((content: any) => {
          // For text resources
          if ('text' in content) {
            return {
              uri: content.uri,
              text: content.text,
              mimeType: content.mimeType || 'text/plain',
            }
          }
          // For blob resources (will be base64 encoded)
          else if ('blob' in content) {
            return {
              uri: content.uri,
              blob: content.blob,
              mimeType: content.mimeType || 'application/octet-stream',
            }
          }
          return content
        })
      } catch (error) {
        this.interactor.error(`Error retrieving resource ${resource.name}: ${error}`)
        throw new Error(`Failed to retrieve resource: ${error}`)
      }
    }

    // Extract parameters from URI template
    const params: Record<string, any> = {}
    const paramMatches = resource.uriTemplate.match(/\{([^}]+)\}/g) || []
    for (const match of paramMatches) {
      const paramName = match.slice(1, -1) // Remove { and }
      params[paramName] = { type: 'string', description: `Parameter ${paramName} for resource ${resource.name}` }
    }

    return {
      type: 'function',
      function: {
        name: resourceName,
        description: resource.description || `Resource from MCP server ${serverConfig.name}`,
        parameters: {
          type: 'object',
          properties: params,
        },
        parse: JSON.parse,
        function: getResource,
      },
    }
  }

  /**
   * Create a Coday tool for an MCP function tool
   *
   * @param serverConfig The MCP server configuration
   * @param client The MCP client instance
   * @param tool The MCP tool definition
   */
  private createFunctionTool(serverConfig: McpServerConfig, client: Client, tool: ToolInfo): CodayTool {
    const toolName = `mcp__${serverConfig.id}__${tool.name}`

    const callFunction = async (args: Record<string, any>) => {
      // Log the function call with smart formatting
      this.logToolCall(serverConfig.name, tool.name, args);
      
      try {
        // Call the tool function
        const result = await client.callTool({
          name: tool.name,
          arguments: args,
        })

        // MCP can return either a content array or a toolResult
        if (result && 'content' in result && Array.isArray(result.content)) {
          // Process content array
          return result.content.map((item: any) => {
            if (item.type === 'text') {
              return item.text
            } else if (item.type === 'resource') {
              return item.resource
            }
            return item
          })
        } else if (result && 'toolResult' in result) {
          // Return direct tool result
          return result.toolResult
        }

        return result
      } catch (error) {
        this.interactor.error(`Error calling function ${tool.name}: ${error}`)
        throw new Error(`Failed to call function: ${error}`)
      }
    }

    return {
      type: 'function',
      function: {
        name: toolName,
        description: tool.description || `Function from MCP server ${serverConfig.name}`,
        parameters: {
          type: 'object',
          properties: tool.inputSchema?.properties || {},
        },
        parse: JSON.parse,
        function: callFunction,
      },
    }
  }
}
