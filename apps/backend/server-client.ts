import { Response } from 'express'
import { ServerInteractor } from '@coday/model/server-interactor'
import { Coday } from '@coday/core'
import { HeartBeatEvent } from '@coday/shared/coday-events'
import { Subscription } from 'rxjs'
import { CodayOptions } from '@coday/options'
import { UserService } from '@coday/service/user.service'
import { ProjectService } from '@coday/service/project.service'
import { IntegrationService } from '@coday/service/integration.service'
import { MemoryService } from '@coday/service/memory.service'
import { debugLog } from './log'

export class ServerClient {
  private readonly heartbeatInterval: NodeJS.Timeout
  private terminationTimeout?: NodeJS.Timeout
  private lastConnected: number
  private coday?: Coday

  static readonly SESSION_TIMEOUT = 60 * 60 * 1000 // 1 hour in milliseconds
  static readonly HEARTBEAT_INTERVAL = 10_000 // 10 seconds

  constructor(
    private readonly clientId: string,
    private response: Response,
    private readonly interactor: ServerInteractor,
    private readonly options: CodayOptions,
    private readonly username: string
  ) {
    // Subscribe to interactor events
    this.subscription = this.interactor.events.subscribe((event) => {
      const data = `data: ${JSON.stringify(event)}\n\n`
      this.response.write(data)
    })
    this.lastConnected = Date.now()
    this.heartbeatInterval = setInterval(() => this.sendHeartbeat(), ServerClient.HEARTBEAT_INTERVAL)
  }

  /**
   * Update client connection with new response object.
   * Called when client reconnects with same clientId.
   */
  private subscription?: Subscription

  reconnect(response: Response): void {
    debugLog('CLIENT', `Client ${this.clientId} reconnecting`)
    this.response = response
    this.lastConnected = Date.now()

    if (this.terminationTimeout) {
      debugLog('CLIENT', `Clearing termination timeout for client ${this.clientId}`)
      clearTimeout(this.terminationTimeout)
      delete this.terminationTimeout
    }

    // Replay thread messages if we have an active Coday instance
    if (this.coday) {
      debugLog('CLIENT', `Replaying messages for client ${this.clientId}`)
      this.coday.replay()
    } else {
      debugLog('CLIENT', `No Coday instance to replay for client ${this.clientId}`)
    }
  }

  /**
   * Start or resume Coday instance.
   * Returns true if new instance was created, false if existing instance was used.
   */
  startCoday(): boolean {
    debugLog('CODAY', `Attempting to start Coday for client ${this.clientId}`)
    if (this.coday) {
      debugLog('CODAY', `Coday already running for client ${this.clientId}`)
      return false
    }
    const user = new UserService(this.options.configDir, this.username)
    const project = new ProjectService(this.interactor, this.options.configDir)
    const integration = new IntegrationService(project, user)
    const memory = new MemoryService(project, user)

    debugLog('CODAY', `Creating new Coday instance for client ${this.clientId}`)
    this.coday = new Coday(this.interactor, this.options, {
      user,
      project,
      integration,
      memory,
    })
    this.coday.run().finally(() => {
      debugLog('CODAY', `Coday run finished for client ${this.clientId}`)
      this.terminate(true)
    })
    return true
  }

  /**
   * Terminate the client connection.
   * If immediate is true, cleanup everything now.
   * Otherwise schedule cleanup after SESSION_TIMEOUT.
   */
  terminate(immediate: boolean = false): void {
    debugLog('CLIENT', `Terminating client ${this.clientId} (immediate: ${immediate})`)

    // Clear heartbeat interval
    clearInterval(this.heartbeatInterval)
    this.response.end()

    if (immediate) {
      debugLog('CLIENT', `Immediate cleanup for client ${this.clientId}`)
      this.cleanup()
      return
    }

    // Stop Coday but keep it alive
    if (this.coday) {
      debugLog('CODAY', `Stopping Coday for client ${this.clientId}`)
      this.coday.stop()
    }

    // Clear any existing termination timeout
    if (this.terminationTimeout) {
      debugLog('CLIENT', `Clearing existing termination timeout for client ${this.clientId}`)
      clearTimeout(this.terminationTimeout)
    }

    // Set new termination timeout
    debugLog('CLIENT', `Setting termination timeout for client ${this.clientId}`)
    this.terminationTimeout = setTimeout(() => {
      const idleTime = Date.now() - this.lastConnected
      if (idleTime >= ServerClient.SESSION_TIMEOUT) {
        debugLog(
          'CLIENT',
          `Session expired for client ${this.clientId} after ${Math.round(idleTime / 1000)}s of inactivity`
        )
        this.cleanup()
      } else {
        debugLog('CLIENT', `Client ${this.clientId} still active, skipping cleanup`)
      }
    }, ServerClient.SESSION_TIMEOUT)
  }

  /**
   * Stop the current Coday run if any
   */
  stop(): void {
    this.coday?.stop()
  }

  /**
   * Check if client has been inactive longer than SESSION_TIMEOUT
   */
  isExpired(): boolean {
    return Date.now() - this.lastConnected >= ServerClient.SESSION_TIMEOUT
  }

  private sendHeartbeat(): void {
    try {
      debugLog('HEARTBEAT', `Sending heartbeat to client ${this.clientId}`)
      const heartBeatEvent = new HeartBeatEvent({})
      this.interactor.sendEvent(heartBeatEvent)
    } catch (error) {
      debugLog('HEARTBEAT', `Error sending heartbeat to client ${this.clientId}:`, error)
      this.terminate()
    }
  }

  /**
   * Get the interactor instance for this client
   */
  getInteractor(): ServerInteractor {
    return this.interactor
  }

  private cleanup(): void {
    debugLog('CLIENT', `Starting cleanup for client ${this.clientId}`)
    this.subscription?.unsubscribe()
    if (this.coday) {
      debugLog('CODAY', `Killing Coday instance for client ${this.clientId}`)
      this.coday.kill()
      delete this.coday
    }
    if (this.terminationTimeout) {
      debugLog('CLIENT', `Clearing termination timeout during cleanup for client ${this.clientId}`)
      clearTimeout(this.terminationTimeout)
      delete this.terminationTimeout
    }
    debugLog('CLIENT', `Cleanup completed for client ${this.clientId}`)
  }
}

/*2*
 * Manages all active server clients
 */
export class ServerClientManager {
  private readonly clients: Map<string, ServerClient> = new Map()

  /**
   * Get or create a client for the given clientId
   */
  getOrCreate(clientId: string, response: Response, options: CodayOptions, username: string): ServerClient {
    const existingClient = this.clients.get(clientId)
    if (existingClient) {
      existingClient.reconnect(response)
      return existingClient
    }

    const interactor = new ServerInteractor(clientId)
    const client = new ServerClient(clientId, response, interactor, options, username)
    this.clients.set(clientId, client)
    return client
  }

  /**
   * Get a client by id if it exists
   */
  get(clientId: string): ServerClient | undefined {
    return this.clients.get(clientId)
  }

  /**
   * Remove a client from the manager
   */
  remove(clientId: string): void {
    this.clients.delete(clientId)
  }

  /**
   * Clean up expired clients
   */
  cleanupExpired(): void {
    for (const [clientId, client] of this.clients.entries()) {
      if (client.isExpired()) {
        client.terminate(true)
        this.clients.delete(clientId)
      }
    }
  }
}
