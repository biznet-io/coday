import { promises as fs } from 'fs'
import * as path from 'path'
import * as os from 'os'

/**
 * Simple usage logger for AI agent interactions
 * Logs to daily JSONL files when logging is enabled
 * Uses buffering to avoid concurrent file access issues
 */
export class CodayLogger {
  private enabled: boolean
  private logFolder: string
  private buffer: any[] = []
  private flushInterval: NodeJS.Timeout | null = null

  constructor(enabled: boolean = false, customLogFolder?: string, flushIntervalMs = 5000) {
    this.enabled = enabled
    this.logFolder = customLogFolder || path.join(os.homedir(), '.coday', 'logs')

    // Only start flushing if logging is enabled
    if (enabled) {
      this.flushInterval = setInterval(() => this.flush(), flushIntervalMs)
    }
  }

  /**
   * Log an agent interaction
   */
  logAgentUsage(username: string, agent: string, model: string, cost: number): void {
    const entry = {
      type: 'AGENT_USAGE',
      timestamp: new Date().toISOString(),
      username,
      agent,
      model,
      cost,
    }
    this.pushEntry(entry)
  }

  logWebhook(data: Record<string, any>): void {
    const entry = {
      ...data,
      type: 'WEBHOOK',
      timestamp: new Date().toISOString(),
    }
    this.pushEntry(entry)
  }

  logWebhookError(data: { error: string; username: string | null; project: string | null; clientId?: string | null; duration?: number }): void {
    const entry = {
      ...data,
      type: 'WEBHOOK_ERROR',
      timestamp: new Date().toISOString(),
    }
    this.pushEntry(entry)
  }

  logThreadCleanup(project: string, threadFileName: string): void {
    const entry = {
      type: 'THREAD_CLEANUP',
      timestamp: new Date().toISOString(),
      project,
      threadFileName,
    }
    this.pushEntry(entry)
  }

  private async pushEntry(entry: any): Promise<void> {
    if (!this.enabled) return
    this.buffer.push(entry)

    if (this.buffer.length >= 100) {
      await this.flush()
    }
  }

  /**
   * Read logs for a date range
   */
  async readLogs(from: Date, to: Date): Promise<any[]> {
    const entries: any[] = []

    // Generate all dates in the range
    const currentDate = new Date(from)
    while (currentDate <= to) {
      const year = currentDate.getFullYear()
      const month = String(currentDate.getMonth() + 1).padStart(2, '0')
      const day = String(currentDate.getDate()).padStart(2, '0')
      const filename = `${year}-${month}-${day}.jsonl`
      const filePath = path.join(this.logFolder, filename)

      try {
        const content = await fs.readFile(filePath, 'utf8')
        const lines = content
          .trim()
          .split('\n')
          .filter((line) => line.length > 0)

        for (const line of lines) {
          try {
            const entry = JSON.parse(line)
            if (!entry.timestamp) continue
            // Filter by exact date range
            const entryDate = new Date(entry.timestamp)
            if (entryDate >= from && entryDate <= to) {
              entries.push(entry)
            }
          } catch (parseError) {
            // Skip malformed lines
            console.warn(`Failed to parse log line: ${line}`)
          }
        }
      } catch (fileError) {
        // File doesn't exist for this date, continue
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1)
    }

    return entries
  }

  /**
   * Get the current day's log file path
   */
  private getLogFilePath(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const filename = `${year}-${month}-${day}.jsonl`
    return path.join(this.logFolder, filename)
  }

  /**
   * Flush buffered entries to disk
   */
  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return

    try {
      const entries = this.buffer.splice(0) // Take all entries and clear buffer
      const filePath = this.getLogFilePath()
      await this.ensureLogDir(filePath)

      const lines = entries.map((entry) => JSON.stringify(entry)).join('\n') + '\n'
      await fs.appendFile(filePath, lines, 'utf8')
    } catch (error) {
      // Silent failure - logging errors should never disrupt service
      console.warn('Logger: Failed to flush log entries:', error)
    }
  }

  /**
   * Ensure the log directory exists
   */
  private async ensureLogDir(filePath: string): Promise<void> {
    const dir = path.dirname(filePath)
    try {
      await fs.mkdir(dir, { recursive: true })
    } catch (error) {
      // Directory might already exist
      if ((error as any).code !== 'EEXIST') {
        throw error
      }
    }
  }

  /**
   * Shutdown the logger gracefully - flush remaining entries
   */
  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
      this.flushInterval = null
    }

    // Final flush
    await this.flush()
  }
}
