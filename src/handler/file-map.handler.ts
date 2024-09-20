import {AiClient, CommandContext, CommandHandler, Interactor} from "../model"
import {generateFileTree} from "../function/generate-file-tree"
import path from "path"

export class FileMapHandler extends CommandHandler {
  constructor(private interactor: Interactor, private aiClient: AiClient) {
    super({
      commandWord: "file-map",
      description: "Generates a file map starting from the given relative path.",
      requiredIntegrations: ["AI"]
    })
  }
  
  async handle(command: string, context: CommandContext): Promise<CommandContext> {
    const relativePath = this.getSubCommand(command)
    
    if (!relativePath) {
      this.interactor.error("No relative path provided. Usage: file-map <relativePath>")
      return context
    }
    
    const rootPath = path.join(context.project.root, relativePath)
    
    const fileTreeChunks = generateFileTree(rootPath, this.interactor)
    
    const chunkCount = fileTreeChunks.length
    for (let i = 0; i < chunkCount; i++) {
      await this.aiClient.addMessage(fileTreeChunks[i], context)
      this.interactor.displayText(`Sent chunk ${i + 1} of ${chunkCount}`)
    }
    
    return context
  }
}
