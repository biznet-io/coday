import { CommandHandler } from '../../model/command.handler'
import { Interactor } from '../../model/interactor'
import { CommandContext } from '../../model/command-context'
import { runBash } from '../../function/run-bash'

export class GitDefaultHandler extends CommandHandler {
  constructor(private readonly interactor: Interactor) {
    super({
      commandWord: '[anything else]',
      description: 'Executes git commands',
    })
  }

  accept(command: string, context: CommandContext): boolean {
    // as a default, all checks have been already made
    return true
  }

  async handle(command: string, context: CommandContext): Promise<CommandContext> {
    if (!command) {
      this.interactor.error('No git command provided.')
      return context
    }

    try {
      const result = await runBash({
        command: `git ${command}`,
        root: context.project.root,
        interactor: this.interactor,
        requireConfirmation: true, // Always require confirmation
      })
      this.interactor.displayText(result)
    } catch (error) {
      this.interactor.error(`Error executing git command: ${error}`)
    }

    return context
  }
}
