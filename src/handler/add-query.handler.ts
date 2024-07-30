import {keywords} from "../keywords"
import {CommandContext, CommandHandler, Interactor} from "../model"

export class AddQueryHandler extends CommandHandler {
  
  constructor(
    private interactor: Interactor,
  ) {
    super({
      commandWord: "add-query",
      description: "[internal] used to allow user feedback between flow commands.",
      isInternal: true,
    })
  }
  
  async handle(
    command: string,
    context: CommandContext,
  ): Promise<CommandContext> {
    const query = this.getSubCommand(command)
    const invite = query || "What message would you want to add ?"
    const userAnswer = await this.interactor.promptText(
      `${invite}\n(type nothing to proceed) `,
    )
    
    const wrappedMsg: string = query ? `To the following query: "${query}"\nI answer: ` : ""
    const wrappedAnswer: string = userAnswer ? `"${userAnswer}"` : query ? `nothing."` : ""
    
    if (userAnswer || query) {
      context.addCommands(`${keywords.assistantPrefix} ${wrappedMsg}${wrappedAnswer}`)
    }
    
    return context
  }
}

