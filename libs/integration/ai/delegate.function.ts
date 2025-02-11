import { Agent, CommandContext, Interactor } from '../../model'
import { AgentService } from '../../agent'
import { AiThread } from '../../ai-thread/ai-thread'
import { filter, lastValueFrom, Observable, tap } from 'rxjs'
import { CodayEvent, MessageEvent } from '../../shared'

type DelegateInput = {
  context: CommandContext
  interactor: Interactor
  agentService: AgentService
}

export function delegateFunction(input: DelegateInput) {
  const { context, interactor, agentService } = input
  const delegate = async ({ task, agentName }: { task: string; agentName: string | undefined }) => {
    if (context.stackDepth <= 0) return 'Delegation not allowed, either permanently, or existing capacity already used.'

    interactor.displayText(`DELEGATING to agent ${agentName} the task:\n${task}`)
    let agent: Agent | undefined
    if (agentName) {
      const matchingAgents = await agentService.findAgentByNameStart(agentName, context)
      if (matchingAgents.length === 0) {
        const output = `Agent ${agentName} not found.`
        interactor.displayText(output)
        return output
      }

      if (matchingAgents.length > 1) {
        const output = `Multiple agents found for: '${agentName}', possible matches: ${matchingAgents.map((a) => a.name).join(', ')}.`
        interactor.displayText(output)
        return output
      }

      agent = matchingAgents[0]
    } else {
      agent = await agentService.findByName('coday', context)
      if (!agent) {
        const output = `No default agent 'coday' found`
        interactor.displayText(output)
        return output + ', select one or avoid delegation.'
      }
    }
    console.log(`Agent identified: ${agent?.name}`)

    const forkedThread: AiThread = context.aiThread!.fork(agentName ? agent.name : undefined)
    const formattedTask: string = `You are given a task to try to complete.
This task is part of a broader conversation given for context, but your current focus should be on this precise task:

<task>
  ${task}
</task>`

    context.stackDepth--
    const delegatedEvents: Observable<CodayEvent> = (await agent.run(formattedTask, forkedThread)).pipe(
      tap((e) => {
        console.log(`delegated event ${e.type}`)
        let event: CodayEvent = e
        if (e instanceof MessageEvent) {
          event = new MessageEvent({ ...e, name: `-> ${e.name}` })
          // if (!e.name.startsWith("->")) {
          interactor.displayText(e.content, (event as MessageEvent).name)
          // }
        }
        interactor.sendEvent(event)
      })
    )
    const lastEvent = await lastValueFrom(delegatedEvents.pipe(filter((e) => e instanceof MessageEvent)))
    context.stackDepth++
    context.aiThread!.merge(forkedThread)
    return lastEvent.content
  }
  return delegate
}
