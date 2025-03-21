import { keywords } from '../../keywords'
import { Agent, CommandContext, CommandHandler, Interactor } from '../../model'
import { lastValueFrom, Observable } from 'rxjs'
import { CodayEvent, MessageEvent } from '../../shared/coday-events'
import { AgentService } from '../../agent'

export class AiHandler extends CommandHandler {
  private lastAgentName: string | undefined

  constructor(
    private interactor: Interactor,
    private agentService: AgentService
  ) {
    super({
      commandWord: keywords.assistantPrefix,
      description:
        "calls the AI with the given command and current context. 'reset' for using a new thread. You can call whatever assistant in your openai account by its name, ex: joke_generator called by @jok (choice prompt if multiple matches).",
    })
  }

  async handle(command: string, context: CommandContext): Promise<CommandContext> {
    /* The command can contain a space after the commandWord that is important to detect if it is an agent name or not.
     * The getSubCommand of CommandHandler does trim it, misplacing first word as agent name.
     * ex:
     *   - "@ foo bar" => no agent name, user prompt is "foo bar"
     *   - "@foo bar" => agent name is "foo", user prompt is "bar"
     */
    const cmd = command.slice(this.commandWord.length)

    // Check for agent name at start of command
    const firstSpaceIndex = cmd.indexOf(' ')
    const potentialAgentName = firstSpaceIndex < 0 ? cmd : cmd.slice(0, firstSpaceIndex)
    const restOfCommand = firstSpaceIndex < 0 ? '' : cmd.slice(firstSpaceIndex + 1)

    // Empty command, use default agent, corner case
    if (!cmd.trim()) {
      const agent = await this.agentService.findByName('coday', context)
      if (!agent) {
        this.interactor.error('Failed to initialize default agent')
        return context
      }
      return this.runAgent(agent, '', context)
    }

    // Try to select an agent
    const selectedAgent = await this.selectAgent(potentialAgentName, context)
    if (!selectedAgent) {
      console.log('No selected agent for command, skipping.')
      return context
    }

    // If no further command, just confirm selection
    if (!restOfCommand) {
      this.interactor.displayText(`Agent ${selectedAgent.name} selected.`)
      return context
    }

    return this.runAgent(selectedAgent, restOfCommand, context)
  }

  /**
   * Try to select an agent by name, handling various cases:
   * - Empty/no match: returns default agent
   * - Single match: returns that agent
   * - Multiple matches: handles interactive/non-interactive cases
   * Returns undefined if selection fails or is cancelled
   */
  private async selectAgent(nameStart: string, context: CommandContext): Promise<Agent | undefined> {
    // If a specific agent name start is provided, use that
    if (nameStart?.trim()) {
      const agent = await this.agentService.findAgentByNameStart(nameStart, context)
      if (agent) {
        this.lastAgentName = agent.name
        return agent
      }
      return undefined
    }
    
    // No specific agent requested, follow preference chain:
    // 1. Last used agent in this session (lastAgentName)
    // 2. User's default agent for this project (from user config)
    // 3. Fall back to 'coday'
    
    // Check for last used agent in this session
    if (this.lastAgentName) {
      const agent = await this.agentService.findByName(this.lastAgentName, context)
      if (agent) {
        return agent
      }
      // If last agent no longer available, clear it
      this.lastAgentName = undefined
    }

    // No last agent or not found, check for user's preferred agent
    const preferredAgent = this.agentService.getPreferredAgent()
    if (preferredAgent) {
      const agent = await this.agentService.findByName(preferredAgent, context)
      if (agent) {
        this.lastAgentName = agent.name
        return agent
      }
      // Preferred agent not found
      this.interactor.warn(`Preferred agent '${preferredAgent}' not found, using default.`)
    }

    // Fall back to default 'coday' agent
    this.interactor.displayText('Selecting Coday')
    const agent = await this.agentService.findByName('coday', context)
    if (agent) {
      this.lastAgentName = agent.name
    }
    return agent
  }

  /**
   * Execute agent with given command in context
   */
  private async runAgent(agent: Agent, cmd: string, context: CommandContext): Promise<CommandContext> {
    const events: Observable<CodayEvent> = await agent.run(cmd, context.aiThread!)
    events.subscribe({
      next: (event) => {
        this.interactor.sendEvent(event)
        if (event instanceof MessageEvent) {
          this.interactor.displayText(event.content, event.name)
        }
      },
      error: (error) => {
        if (error.message === 'Processing interrupted by user request') {
          this.interactor.displayText('Processing stopped gracefully', agent.name)
        } else {
          this.interactor.error(`Error in AI processing: ${error.message}`)
        }
      },
    })
    await lastValueFrom(events)
    return context
  }

  kill(): void {
    this.agentService.kill()
  }
}
