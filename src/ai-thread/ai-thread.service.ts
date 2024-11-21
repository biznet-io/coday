/**
 * Service managing AI thread lifecycle and operations.
 * Provides a simple interface for thread selection and management
 * while handling complex internal state and transitions.
 */

import {BehaviorSubject, firstValueFrom, Observable} from "rxjs"
import {AiThread} from "./ai-thread"
import {AiThreadRepository} from "./ai-thread.repository"
import {AiThreadRepositoryFactory} from "./repository/ai-thread.repository.factory"
import {filter} from "rxjs/operators"
import {ThreadSummary} from "./ai-thread.types"


export class AiThreadService {
  private readonly activeThread$ = new BehaviorSubject<AiThread | null>(null)
  
  /**
   * Observable of the currently active thread.
   * Emits whenever the active thread changes.
   */
  readonly activeThread: Observable<AiThread | null> = this.activeThread$.asObservable()
  
  constructor(private readonly repositoryFactory: AiThreadRepositoryFactory) {
    // Reset active thread when repository changes
    this.repositoryFactory.repository.pipe(filter(repository => !!repository)).subscribe(() => {
      this.activeThread$.next(null)
      setTimeout(() => this.select(), 0) // auto select last thread after a project change
    })
  }
  
  /**
   * Get current repository instance asynchronously.
   * Waits for a valid repository to be available.
   * Used internally to ensure we always work with the latest valid repository.
   */
  private async getRepository(): Promise<AiThreadRepository> {
    // Use firstValueFrom to get the first valid repository
    return await firstValueFrom(
      this.repositoryFactory.repository.pipe(
        filter((repo): repo is AiThreadRepository => repo !== null)
      )
    )
  }
  
  create(name?: string): AiThread {
    const newThread = new AiThread({
      id: "", // TODO falsy, will be overriden by repository, shitty pattern FTW...
      name: name ? name : "Temporary thread",
    })
    this.activeThread$.next(newThread)
    return newThread
  }
  
  /**
   * Select a thread for use, or create a default one if none exists.
   * This is the main entry point for thread management.
   *
   * @param threadId Optional ID of thread to select
   * @returns Selected or created thread
   */
  async select(threadId?: string): Promise<AiThread> {
    const repository = await this.getRepository()
    
    if (threadId) {
      const thread = await repository.getById(threadId)
      if (!thread) {
        throw new Error(`Thread ${threadId} not found`)
      }
      this.activeThread$.next(thread)
      return thread
    }
    
    // No ID provided, get last used or create new
    const threads = await repository.listThreads()
    if (threads.length === 0) {
      return this.create()
    }
    
    // Select most recent thread
    const mostRecent = threads.reduce((latest, current) => {
      if (!latest || current.modifiedDate > latest.modifiedDate) {
        return current
      }
      return latest
    })
    
    const thread = await repository.getById(mostRecent.id)
    if (!thread) {
      throw new Error("Failed to load most recent thread")
    }
    
    this.activeThread$.next(thread)
    return thread
  }
  
  /**
   * Save current thread state and trigger post-processing
   * like summarization and memory extraction.
   *
   * @param newName Optional new name for the thread
   */
  async save(newName?: string): Promise<void> {
    const thread = this.activeThread$.value
    if (!thread) {
      return
    }
    
    const repository = await this.getRepository()
    
    // If renaming, update the name and modified date
    if (newName) {
      // assign new id
      thread.id = crypto.randomUUID()
      thread.name = newName
    }
    await repository.save(thread)
    this.activeThread$.next(thread)
    
    // TODO: Post-processing
    // - Summarization
    // - Memory extraction
    // - Knowledge sharing
  }
  
  /**
   * Delete a thread permanently
   */
  async delete(threadId: string): Promise<void> {
    const repository = await this.getRepository()
    const success = await repository.delete(threadId)
    if (!success) {
      throw new Error(`Failed to delete thread ${threadId}`)
    }
    
    // If active thread was deleted, redo
    if (this.activeThread$.value?.id === threadId) {
      await this.select()
    }
  }
  
  /**
   * Get currently active thread synchronously.
   * @returns The current thread or null if none is active
   */
  getCurrentThread(): AiThread | null {
    return this.activeThread$.value
  }
  
  /**
   * List all available threads.
   * Returns an Observable that will emit once with the list of threads
   * or error if repository is not available.
   */
  list(): Observable<ThreadSummary[]> {
    // Convert Promise to Observable for consistency
    return new Observable<ThreadSummary[]>(subscriber => {
      this.getRepository()
        .then(repository => repository.listThreads())
        .then(threads => {
          subscriber.next(threads)
          subscriber.complete()
        })
        .catch(error => subscriber.error(error))
    })
  }
}