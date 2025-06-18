/**
 * @fileoverview Manages a conversation thread between users and AI agents, including tool interactions.
 * Provides a unified interface for message and tool execution handling while maintaining thread state
 * and ensuring proper message sequencing.
 */

import { buildCodayEvent, MessageEvent, ToolRequestEvent, ToolResponseEvent } from '@coday/coday-events'
// eslint-disable-next-line @nx/enforce-module-boundaries
import { ToolCall, ToolResponse } from '../integration/tool-call'
import { EmptyUsage, RunStatus, ThreadMessage, ThreadSerialized, Usage } from './ai-thread.types'

/**
 * Allowed message types for filtering when building thread history
 */
const THREAD_MESSAGE_TYPES = [MessageEvent.type, ToolRequestEvent.type, ToolResponseEvent.type]

/**
 * AiThread manages the state and interactions of a conversation thread between users and AI agents.
 * It handles message sequencing, tool execution requests/responses, and maintains thread history
 * while providing deduplication of similar tool calls.
 *
 * Temporary notes:
 * To narrate it, an aiThread start just after the user chose a project: the configuration being defined, we can then get the list of the existing threads, and select the last one being used (or create the first if none). At every point in time, the user can select another (or create a new) thread, name it (but later it would be better to generate the name), and delete it.
 *
 * The aiThread is then present for all the ai-related parts : ai.handler.ts, agents, aiClients to receive the events composing the history. When a thread is loaded, the said events are also re-played for the frontend to udpate the display.
 *
 * On some future occasions, the current aiThread can be forked or cloned to run a task without polluting the parent thread. Also, in the near future, the agents will be aware of the existence of these other threads and may request informations from them. This would happen through the name (and/or the summary) of aiThreads, and the request would produce an end text message that will be transfered to the parent thread (as a tool response most probably).
 *
 * When an aiThread is left by the user (disconnection, explicit save), it is saved and may trigger several actions like a new summarization, a memory extraction to benefit all threads and users.
 *
 * AiThreads are (for now) tied to a user by default, maybe later shareable or multi-user capable, so aiThread management is important, leading to some necessary work to do on the frontend and API, to select a thread without resorting to commands (although these should still work for terminal interfaces).
 */
export class AiThread {
  /** Unique identifier for the thread */
  id: string

  username: string

  /** Name or title or very short sentence about the content of the thread */
  name: string

  /** Summary of the whole thread, to be used for cross-thread research */
  summary: string

  createdDate: string
  modifiedDate: string
  runStatus: RunStatus = RunStatus.STOPPED

  /** Garbage object for passing data or keeping track of counters or stuff...*/
  data: any = {}

  usage: Usage = { ...EmptyUsage }

  price: number = 0

  /** Track depth of thread delegations (not serializable) */
  delegationDepth: number = 0

  /** Store forked threads for specific agents */
  private forkedThreads: Map<string | null, AiThread> = new Map()

  private parentThread: AiThread | undefined

  /** Internal storage of thread messages in chronological order */
  private messages: ThreadMessage[]

  /**
   * Creates a new AiThread instance.
   * @param thread - Configuration object containing thread ID and optional message history
   * @param thread.id - Unique identifier for the thread
   * @param thread.messages - Optional array of raw message objects to initialize the thread
   */
  constructor(thread: ThreadSerialized) {
    this.id = thread.id
    this.username = thread.username
    this.name = thread.name ?? 'untitled'
    this.summary = thread.summary ?? ''
    this.createdDate = thread.createdDate ?? new Date().toISOString()
    this.modifiedDate = thread.modifiedDate ?? this.createdDate
    this.price = thread.price ?? 0

    // Filter on type first, then build events
    this.messages = (thread.messages ?? [])
      .filter((msg) => THREAD_MESSAGE_TYPES.includes(msg.type))
      .map((msg) => buildCodayEvent(msg))
      .filter((event): event is ThreadMessage => event !== undefined)
  }

  /**
   * Returns a copy of all messages in the thread, truncated if they exceed maxChars.
   * Prioritizes keeping the first user message (which contains the initial task/context) 
   * and fills remaining space with the most recent messages.
   * @param maxChars Maximum character limit for the returned messages
   * @returns Array of thread messages that fit within the character limit
   */
  getMessages(maxChars?: number): ThreadMessage[] {
    if (!maxChars) return [...this.messages]

    const totalChars = this.messages.reduce((count, msg) => count + msg.length, 0)
    if (totalChars <= maxChars) return [...this.messages]

    console.warn(`Truncating context: ${totalChars} chars > ${maxChars} limit`)
    
    // Strategy: Prioritize first user message + most recent messages
    const firstUserMessageIndex = this.messages.findIndex((msg) => msg instanceof MessageEvent && msg.role === 'user')
    const firstUserMessage = firstUserMessageIndex >= 0 ? this.messages[firstUserMessageIndex] : null
    const firstUserMessageChars = firstUserMessage?.length || 0
    
    // Edge case: if first user message alone exceeds limit, return empty array
    if (firstUserMessage && firstUserMessageChars > maxChars) {
      console.warn(`Context truncated: first user message (${firstUserMessageChars} chars) exceeds limit (${maxChars} chars), excluding all messages`)
      return []
    }
    
    // If no first user message found, fall back to recent messages only
    if (!firstUserMessage) {
      let charCount = 0
      let startIndex = this.messages.length
      
      for (let i = this.messages.length - 1; i >= 0; i--) {
        const messageChars = this.messages[i].length
        if (charCount + messageChars > maxChars) break
        
        charCount += messageChars
        startIndex = i
      }
      
      const recentMessages = this.messages.slice(startIndex)
      const finalCharCount = recentMessages.reduce((count, msg) => count + msg.length, 0)
      console.warn(`Context truncated: no first user message found, kept ${recentMessages.length} recent messages (${finalCharCount}/${maxChars} chars)`)
      return recentMessages
    }
    
    // Reserve space for first user message and find recent messages that fit in remaining space
    const remainingBudget = maxChars - firstUserMessageChars
    let recentCharCount = 0
    let recentStartIndex = this.messages.length
    
    // Work backwards from the end, skipping the first user message if we encounter it
    for (let i = this.messages.length - 1; i >= 0; i--) {
      // Skip the first user message since we're including it separately
      if (i === firstUserMessageIndex) continue
      
      const messageChars = this.messages[i].length
      if (recentCharCount + messageChars > remainingBudget) break
      
      recentCharCount += messageChars
      recentStartIndex = i
    }
    
    // Get recent messages (excluding first user message)
    const recentMessages = this.messages.slice(recentStartIndex).filter((_, index) => {
      const actualIndex = recentStartIndex + index
      return actualIndex !== firstUserMessageIndex
    })
    
    // Combine first user message with recent messages
    const result = [firstUserMessage, ...recentMessages]
    const finalCharCount = result.reduce((count, msg) => count + msg.length, 0)
    
    console.warn(`Context truncated: kept first user message + ${recentMessages.length} recent messages (${finalCharCount}/${maxChars} chars)`)
    return result
  }

  /**
   * Resets the counters related to the run (all except price.thread)
   */
  resetUsageForRun(): void {
    this.usage = { ...EmptyUsage }
  }

  addUsage(usage: Partial<Usage>): void {
    this.price += usage.price ?? 0
    this.usage.price += usage.price ?? 0
    this.usage.iterations += 1

    const tokens = this.usage
    tokens.input += usage.input ?? 0
    tokens.output += usage.output ?? 0
    tokens.cache_read += usage.cache_read ?? 0
    tokens.cache_write += usage.cache_write ?? 0
  }

  /**
   * Adds a new message to the thread.
   * @param message - The message to add
   */
  private add(message: ThreadMessage): void {
    this.messages.push(message)
  }

  /**
   * Finds a tool request by its unique identifier.
   * @param id - The tool request ID to search for
   * @returns The matching ToolRequestEvent or undefined if not found
   */
  private findToolRequestById(id: string): ToolRequestEvent | undefined {
    return this.messages.find((msg) => msg instanceof ToolRequestEvent && msg.toolRequestId === id) as
      | ToolRequestEvent
      | undefined
  }

  /**
   * Finds all tool requests that are similar to the reference request
   * (same name and arguments, but different ID).
   * Used for deduplication of repeated tool calls.
   * @param reference - The tool request to compare against
   * @returns Array of similar tool requests (excluding the reference)
   */
  private findSimilarToolRequests(reference: ToolRequestEvent): ToolRequestEvent[] {
    return this.messages.filter(
      (msg) =>
        msg !== reference && // Exclude the reference request
        msg instanceof ToolRequestEvent &&
        msg.name === reference.name &&
        msg.args === reference.args
    ) as ToolRequestEvent[]
  }

  /**
   * Finds all tool responses associated with the given tool requests.
   * Used when cleaning up duplicated tool calls and their responses.
   * @param requests - Array of tool requests to find responses for
   * @returns Array of tool responses matching the given requests
   */
  private findToolResponsesToRequests(requests: ToolRequestEvent[]): ToolResponseEvent[] {
    return this.messages.filter(
      (msg) => msg instanceof ToolResponseEvent && requests.some((r) => r.toolRequestId === msg.toolRequestId)
    ) as ToolResponseEvent[]
  }

  /**
   * Removes specific messages from the thread.
   * Used primarily for cleaning up duplicated tool calls and responses.
   * @param messages - Array of messages to remove
   */
  private removeMessages(messages: ThreadMessage[]): void {
    this.messages = this.messages.filter((msg) => !messages.includes(msg))
  }

  /**
   * Adds a user message to the thread.
   * @param username - The name of the user sending the message
   * @param content - The content of the message
   */
  addUserMessage(username: string, content: string): void {
    const lastMessage = this.messages[this.messages.length - 1]
    const shouldMergeIntoLastMessage =
      lastMessage && lastMessage instanceof MessageEvent && lastMessage.role === 'user' && lastMessage.name === username

    if (shouldMergeIntoLastMessage) {
      lastMessage.content += `\n\n${content}`
    } else {
      this.add(
        new MessageEvent({
          role: 'user',
          content,
          name: username,
        })
      )
    }
  }

  /**
   * Adds an AI agent message to the thread.
   * @param agentName - The name of the AI agent sending the message
   * @param content - The content of the message
   */
  addAgentMessage(agentName: string, content: string): void {
    const lastMessage = this.messages[this.messages.length - 1]
    const shouldMergeIntoLastMessage =
      lastMessage &&
      lastMessage instanceof MessageEvent &&
      lastMessage.role === 'assistant' &&
      lastMessage.name === agentName

    if (shouldMergeIntoLastMessage) {
      lastMessage.content += `\n\n${content}`
    } else {
      this.add(
        new MessageEvent({
          role: 'assistant',
          content,
          name: agentName,
        })
      )
    }
  }

  /**
   * Fork a thread for a specific agent delegation
   * @param agentName Name of the agent to delegate to
   * @returns Forked AiThread instance
   */
  /**
   * Fork a thread, optionally for a specific agent
   * @param agentName Optional name of the agent to delegate to
   * @returns Forked AiThread instance
   */
  fork(agentName?: string | null): AiThread {
    // Check if a forked thread for this agent already exists
    const existingForkedThread = this.forkedThreads.get(agentName ?? null)
    if (existingForkedThread) {
      existingForkedThread.runStatus = RunStatus.RUNNING
      return existingForkedThread
    }

    // Create a new forked thread with destructured properties
    const forkedThread = new AiThread({
      id: this.id, // Reuse parent thread ID as we don't save this
      username: this.username,
      name: agentName ? `${this.name} - Delegated to ${agentName}` : `${this.name} - Forked`,
      summary: this.summary,
      createdDate: this.createdDate,
      modifiedDate: new Date().toISOString(),
      price: 0,
      messages: [...this.messages], // Create a new array reference
    })

    // Increment delegation depth (non-serializable)
    forkedThread.delegationDepth = this.delegationDepth + 1
    forkedThread.parentThread = this
    forkedThread.runStatus = RunStatus.RUNNING

    // Store the forked thread
    this.forkedThreads.set(agentName ?? null, forkedThread)

    return forkedThread
  }

  /**
   * Merge a specific forked thread back into this thread
   * @param forkedThread The thread to merge back
   */
  merge(forkedThread: AiThread): void {
    // Add the forked thread's price to this thread's price
    this.price += forkedThread.price

    // Reset the price of the forked as moved into the parent
    forkedThread.price = 0
  }

  get totalPrice(): number {
    return this.price + (this.parentThread?.totalPrice ?? 0)
  }

  /**
   * Returns the name of the last agent (assistant) that responded in this thread, or undefined if none.
   */
  getLastAgentName(): string | undefined {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const msg = this.messages[i]
      if (msg instanceof MessageEvent && msg.role === 'assistant' && msg.name) {
        return msg.name
      }
    }
    return undefined
  }

  /**
   * Returns the count of user messages in this thread.
   */
  getUserMessageCount(): number {
    return this.messages.filter((msg) => msg instanceof MessageEvent && msg.role === 'user').length
  }

  /**
   * Gets an event by its timestamp ID
   * @param eventId The timestamp ID of the event to retrieve
   * @returns The event if found, undefined otherwise
   */
  getEventById(eventId: string): ThreadMessage | undefined {
    return this.messages.find((msg) => msg.timestamp === eventId)
  }

  addToolRequests(agentName: string, toolRequests: ToolRequestEvent[]): void {
    toolRequests.forEach((toolRequest) => {
      if (!toolRequest.toolRequestId || !toolRequest.name || !toolRequest.args) return
      this.add(toolRequest)
    })
  }

  addToolResponseEvents(toolResponseEvents: ToolResponseEvent[]): void {
    toolResponseEvents.forEach((response) => {
      if (!response.toolRequestId || !response.output) return
      const request = this.findToolRequestById(response.toolRequestId)
      if (!request) return

      // Find similar requests using the current request as reference
      const similarRequests = this.findSimilarToolRequests(request)
      const responsesToRemove = this.findToolResponsesToRequests(similarRequests)

      // Remove old requests and responses
      this.removeMessages([...similarRequests, ...responsesToRemove])

      // Add the new response
      this.add(response)
    })
  }

  /**
   * Adds tool execution requests to the thread.
   * Validates each tool call for required fields before adding.
   * @param agentName - The name of the AI agent making the tool calls
   * @param toolCalls - Array of tool calls to process
   */
  addToolCalls(agentName: string, toolCalls: ToolCall[]): void {
    toolCalls.forEach((call) => {
      if (!call.id || !call.name || !call.args) return
      this.add(
        new ToolRequestEvent({
          name: call.name,
          args: call.args,
          toolRequestId: call.id,
        })
      )
    })
  }

  /**
   * Adds tool execution responses to the thread.
   * Implements deduplication by removing similar previous tool calls and their responses
   * when a new response is added. This ensures that only the latest execution of a tool
   * with specific arguments is kept in the thread.
   *
   * @param username - The name of the user/system processing the tool responses
   * @param responses - Array of tool responses to process
   */
  addToolResponses(username: string, responses: ToolResponse[]): void {
    responses.forEach((response) => {
      if (!response.id || !response.response) return
      const request = this.findToolRequestById(response.id)
      if (!request) return

      // Find similar requests using the current request as reference
      const similarRequests = this.findSimilarToolRequests(request)
      const responsesToRemove = this.findToolResponsesToRequests(similarRequests)

      // Remove old requests and responses
      this.removeMessages([...similarRequests, ...responsesToRemove])

      // Add the new response
      this.add(
        new ToolResponseEvent({
          toolRequestId: response.id,
          output: response.response,
        })
      )
    })
  }
}
