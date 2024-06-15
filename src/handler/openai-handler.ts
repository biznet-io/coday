import {CommandHandler} from "./command-handler"
import {Interactor} from "../interactor"
import {OpenaiClient} from "./openai-client"
import {configService} from "../service/config-service";
import {CommandContext} from "../command-context";

export class OpenaiHandler extends CommandHandler {
    commandWord: string = '@'
    description: string = "calls the AI with the given command and current context. 'reset' for using a new thread. You can call whatever assistant in your openai account by its name, ex: joke_generator called by @jok (choice prompt if multiple matches)."
    openaiClient: OpenaiClient

    constructor(private interactor: Interactor) {
        super()
        const apiKeyProvider = () => configService.getApiKey("OPENAI")
        this.openaiClient = new OpenaiClient(interactor, apiKeyProvider)
    }

    async handle(command: string, context: CommandContext): Promise<CommandContext> {
        const cmd = command.slice(this.commandWord.length)
        // Reset threadId when command is "reset"
        if (cmd.trim() === "reset") {
            this.openaiClient.reset()
            return context
        }

        const assistantName = this.getAssistantNameIfValid(cmd)
        if (!assistantName) {
            // no valid command
            this.interactor.warn("command not understood, skipped.")
            return context
        }

        let fullTextAnswer: string
        try {
            fullTextAnswer = await this.openaiClient.answer(assistantName, cmd, context)
        } catch (error: any) {
            console.error(error)
            fullTextAnswer = error.toString()
        }
        return context
    }

    private getAssistantNameIfValid(cmd: string): string | undefined {
        const firstSpaceIndex = cmd.indexOf(" ")
        if (firstSpaceIndex < 0) {
            return undefined
        }
        return firstSpaceIndex === 0 ? "Coday_alpha" : cmd.slice(0, firstSpaceIndex)

    }
}
