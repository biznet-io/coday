import {retrieveJiraTicket} from "./retrieve-jira-ticket"
import {integrationService} from "../../service/integration.service"
import {CommandContext, IntegrationName, Interactor} from "../../model"
import {AssistantToolFactory, Tool} from "../assistant-tool-factory"
import {FunctionTool} from "../types"

export class JiraTools extends AssistantToolFactory {
  
  constructor(interactor: Interactor) {
    super(interactor)
  }
  
  protected hasChanged(context: CommandContext): boolean {
    return this.lastToolInitContext?.project.root !== context.project.root
  }
  
  protected buildTools(context: CommandContext): Tool[] {
    const result: Tool[] = []
    if (!integrationService.hasIntegration(IntegrationName.JIRA)) {
      return result
    }
    
    const jiraBaseUrl = integrationService.getApiUrl(IntegrationName.JIRA)
    const jiraUsername = integrationService.getUsername(IntegrationName.JIRA)
    const jiraApiToken = integrationService.getApiKey(IntegrationName.JIRA)
    if (!(jiraBaseUrl && jiraUsername && jiraApiToken)) {
      return result
    }
    const retrieveTicket = ({ticketId}: { ticketId: string }) => {
      return retrieveJiraTicket(ticketId, jiraBaseUrl, jiraApiToken, jiraUsername, this.interactor)
    }
    const retrieveJiraTicketFunction: FunctionTool<{
      ticketId: string,
      jiraBaseUrl: string,
      jiraApiToken: string,
      jiraUsername: string
    }> = {
      type: "function",
      function: {
        name: "retrieveJiraTicket",
        description: "Retrieve Jira ticket details by ticket ID.",
        parameters: {
          type: "object",
          properties: {
            ticketId: {type: "string", description: "Jira ticket ID"},
          }
        },
        parse: JSON.parse,
        function: retrieveTicket
      }
    }
    
    result.push(retrieveJiraTicketFunction)
    
    return result
  }
}
