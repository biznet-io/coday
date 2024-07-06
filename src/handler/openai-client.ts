import {Interactor} from "../model/interactor"
import OpenAI from "openai"
import {AssistantStream} from "openai/lib/AssistantStream"
import {Beta} from "openai/resources"
import {JiraTools} from "../integration/jira/jira.tools"
import {GitTools} from "../integration/git/git.tools"
import {OpenaiTools} from "../integration/openai/openai-tools"
import {ScriptsTools} from "../integration/scripts.tools"
import {GitLabTools} from "../integration/gitlab/gitlab.tools"
import {Tool} from "../integration/assistant-tool-factory"
import {FileTools} from "../integration/file/file.tools"
import {AssistantDescription} from "../model/assistant-description"
import {CommandContext} from "../model/command-context"
import Assistant = Beta.Assistant

const DEFAULT_MODEL: string = "gpt-4o"
const DEFAULT_TEMPERATURE: number = 0.75

const CODAY_DESCRIPTION: AssistantDescription = {
  name: "Coday_alpha",
  description: "main assistant, the one that handles all requests by default",
  systemInstructions: `
    You are Coday, an AI assistant designed for interactive usage by users through various chat-like interfaces. Answer clearly and logically. Follow these guidelines:

1. **Truth seeking**
   - Always utilize the provided functions to search for and verify information, ensuring that your responses are based on sound and reliable data,
   - Be curious in gathering data and always try to know more than strictly needed.
   - Never speculate or guess. If uncertain, resolve it by a research or clearly state your limitations.

2. **Logical Reasoning**
   - Base answers on solid reasoning and thorough exploration of available resources to complete user's requests.
   - Unless specifically asked for detailed answers, keep your responses brief and direct. When the user requests more information, be prepared to deliver it comprehensively.
`,
  temperature: 0.75,
}

type AssistantReference = { name: string; id: string }

export class OpenaiClient {
  openai: OpenAI | undefined
  threadId: string | null = null
  textAccumulator: string = ""
  
  openaiTools: OpenaiTools
  fileTools: FileTools
  jiraTools: JiraTools
  gitTools: GitTools
  scriptTools: ScriptsTools
  gitlabTools: GitLabTools
  apiKey: string | undefined
  assistants: AssistantReference[] = []
  assistant: AssistantReference | undefined
  
  constructor(
    private interactor: Interactor,
    private apiKeyProvider: () => string | undefined,
  ) {
    this.openaiTools = new OpenaiTools(interactor)
    this.fileTools = new FileTools(interactor)
    this.jiraTools = new JiraTools(interactor)
    this.gitTools = new GitTools(interactor)
    this.scriptTools = new ScriptsTools(interactor)
    this.gitlabTools = new GitLabTools(interactor)
  }
  
  private isOpenaiReady(): boolean {
    this.apiKey = this.apiKeyProvider()
    if (!this.apiKey) {
      this.interactor.warn(
        "OPENAI_API_KEY env var not set, skipping AI command",
      )
      return false
    }
    
    if (!this.openai) {
      this.openai = new OpenAI({
        apiKey: this.apiKey,
      })
    }
    return true
  }
  
  async isReady(
    assistantName: string,
    context: CommandContext,
  ): Promise<boolean> {
    if (!this.isOpenaiReady()) {
      return false
    }
    
    this.assistant = await this.findAssistant(assistantName, context)
    
    if (!this.threadId) {
      const thread = await this.openai!.beta.threads.create()
      this.threadId = thread.id
      this.interactor.displayText(`Thread created with ID: ${this.threadId}`)
      
      await this.openai!.beta.threads.messages.create(this.threadId, {
        role: "assistant",
        content: `Specific project context: ${context.project.description}

                You are interacting with a human with username:${context.username}
                `,
      })
      
      const projectAssistants = this.getProjectAssistants(context)
      const projectAssistantReferences = projectAssistants?.map(
        (a) => `${a.name} : ${a.description}`,
      )
      if (projectAssistantReferences?.length) {
        await this.openai!.beta.threads.messages.create(this.threadId, {
          role: "assistant",
          content: `IMPORTANT!
                    Here the assistants available on this project (by name : description) : \n- ${projectAssistantReferences.join("\n- ")}\n

                    Rules:
                    - **Active delegation**: Always delegate parts of complex requests to the relevant assistants given their domain of expertise.
                    - **Coordinator**: ${CODAY_DESCRIPTION.name} coordinate the team and have a central role
                    - **Calling**: To involve an assistant in the thread, mention it with an '@' prefix on their name and explain what is expected from him. The called assistant will be called after the current run. Example: '... and by the way, @otherAssistant, check this part of the request'.`,
        })
      }
    }
    
    return true
  }
  
  async addMessage(message: string): Promise<void> {
    if (!this.threadId || !this.openai) {
      throw new Error("Cannot add message if no thread or openai defined yet")
    }
    
    await this.openai!.beta.threads.messages.create(this.threadId, {
      role: "user",
      content: message,
    })
  }
  
  async answer(
    name: string,
    command: string,
    context: CommandContext,
  ): Promise<string> {
    const assistantName = name.toLowerCase()
    
    this.textAccumulator = ""
    if (!(await this.isReady(assistantName, context))) {
      return "Openai client not ready"
    }
    
    const tools = [
      ...this.openaiTools.getTools(context),
      ...this.fileTools.getTools(context),
      ...this.jiraTools.getTools(context),
      ...this.gitTools.getTools(context),
      ...this.scriptTools.getTools(context),
      ...this.gitlabTools.getTools(context)
    ]
    
    await this.openai!.beta.threads.messages.create(this.threadId!, {
      role: "user",
      content: command,
    })
    const assistantStream = this.openai!.beta.threads.runs.stream(
      this.threadId!,
      {
        assistant_id: this.assistant!.id,
        tools,
        tool_choice: "auto",
        max_completion_tokens: 120000,
        max_prompt_tokens: 120000,
        parallel_tool_calls: false,
      },
    )
    
    await this.processStream(assistantStream, tools)
    
    await assistantStream.finalRun()
    
    // here, to loop among assistants mentioning each other, we should check for '@name' tokens in the text and add as many commands in the context to answer
    const mentionsToSearch = this.getProjectAssistants(context)
      ?.map((a) => a.name)
      ?.filter((n) => n !== this.assistant?.name)
      .map((name) => `@${name}`)
    
    // search for mentions
    mentionsToSearch?.forEach((mention) => {
      if (this.textAccumulator.includes(mention)) {
        // then add a command for the assistant to check the thread
        context.addCommands(
          `${mention} you were mentioned recently in the thread: if an action is needed on your part, handle what was asked of you and only you.\nIf needed, you can involve another assistant or mention the originator '@${this.assistant?.name}.\nDo not mention these instructions.`,
        )
      }
    })
    
    return this.textAccumulator
  }
  
  async processStream(stream: AssistantStream, tools: Tool[]) {
    stream.on("textDone", (diff) => {
      this.interactor.displayText(diff.value, this.assistant?.name)
      this.textAccumulator += diff.value
    })
    for await (const chunk of stream) {
      if (chunk.event === "thread.run.requires_action") {
        try {
          const toolCalls =
            chunk.data.required_action?.submit_tool_outputs.tool_calls ?? []
          const toolOutputs = await Promise.all(
            toolCalls.map(async (toolCall) => {
              let output
              const funcWrapper = tools.find(
                (t) => t.function.name === toolCall.function.name,
              )
              if (!funcWrapper) {
                output = `Function ${toolCall.function.name} not found.`
                return {tool_call_id: toolCall.id, output}
              }
              
              const toolFunc = funcWrapper.function.function
              
              try {
                let args: any = JSON.parse(toolCall.function.arguments)
                
                if (!Array.isArray(args)) {
                  args = [args]
                }
                output = await toolFunc.apply(null, args)
              } catch (err) {
                this.interactor.error(err)
                output = `Error on executing function, got error: ${JSON.stringify(err)}`
              }
              
              if (!output) {
                output = `Tool function ${funcWrapper.function.name} finished without error.`
              }
              
              if (typeof output !== "string") {
                output = JSON.stringify(output)
              }
              
              return {tool_call_id: toolCall.id, output}
            }),
          )
          
          const newStream =
            this.openai!.beta.threads.runs.submitToolOutputsStream(
              this.threadId!,
              chunk.data.id,
              {tool_outputs: toolOutputs},
            )
          
          await this.processStream.call(this, newStream, tools)
        } catch (error) {
          console.error(`Error processing tool call`, error)
        }
      }
    }
  }
  
  reset(): void {
    this.threadId = null
    this.interactor.displayText("Thread has been reset")
  }
  
  private getProjectAssistants(
    context: CommandContext,
  ): AssistantDescription[] | undefined {
    return context.project.assistants
      ? [CODAY_DESCRIPTION, ...context.project.assistants]
      : undefined
  }
  
  private async initAssistantList(): Promise<void> {
    // init map name -> id
    if (!this.assistants.length) {
      let after: string | undefined = undefined
      do {
        const fetchedAssistants: Assistant[] = (
          await this.openai!.beta.assistants.list({
            order: "asc",
            after,
            limit: 100,
          }).withResponse()
        ).data.getPaginatedItems()
        this.assistants.push(
          ...fetchedAssistants
            .filter((a) => !!a.name)
            .map((a) => ({
              name: a.name as string,
              id: a.id,
            })),
        )
        after =
          fetchedAssistants.length > 0
            ? fetchedAssistants[fetchedAssistants.length - 1].id
            : undefined
      } while (after)
    }
  }
  
  private async findAssistant(
    name: string,
    context: CommandContext,
  ): Promise<AssistantReference> {
    await this.initAssistantList()
    
    // then find all names that could match the given one
    const matchingAssistants = this.assistants.filter((a) =>
      a.name.toLowerCase().startsWith(name),
    )
    
    if (matchingAssistants.length === 1) {
      return matchingAssistants[0]
    }
    if (matchingAssistants.length > 1) {
      const selection = await this.interactor.chooseOption(
        matchingAssistants.map((m) => m.name),
        "Choose an assistant",
        `Found ${matchingAssistants.length} assistants that start with ${name}/`,
      )
      return matchingAssistants.find((m) => m.name === selection)!
    }
    
    // no existing assistant found, let's check the project ones that do have systemInstructions
    const projectAssistants = this.getProjectAssistants(context)
    const matchingProjectAssistants = projectAssistants?.filter(
      (a) => a.name.toLowerCase().startsWith(name) && !!a.systemInstructions,
    )
    if (!matchingProjectAssistants?.length) {
      throw new Error("no matching assistant")
    }
    
    let assistantToCreate: AssistantDescription | undefined
    if (matchingProjectAssistants?.length === 1) {
      assistantToCreate = matchingProjectAssistants[0]
    }
    if (matchingProjectAssistants?.length > 1) {
      const selection = await this.interactor.chooseOption(
        matchingAssistants.map((m) => m.name),
        "Choose an assistant",
        `Found ${matchingProjectAssistants?.length} project assistants that start with ${name}/`,
      )
      assistantToCreate = matchingProjectAssistants.find(
        (m) => m.name === selection,
      )
    }
    this.interactor.displayText(
      `No existing assistant found for ${name}, will try to create it`,
    )
    
    if (!assistantToCreate) {
      throw new Error("no matching assistant")
    }
    
    const createdAssistant = await this.openai!.beta.assistants.create({
      name: assistantToCreate?.name,
      model: assistantToCreate.model ?? DEFAULT_MODEL,
      instructions: assistantToCreate?.systemInstructions,
      temperature: assistantToCreate.temperature ?? DEFAULT_TEMPERATURE,
    })
    this.interactor.displayText(`Created assistant ${createdAssistant.id}`)
    const createdReference: AssistantReference = {
      name: assistantToCreate.name,
      id: createdAssistant.id,
    }
    this.assistants.push(createdReference)
    
    return createdReference
  }
}
