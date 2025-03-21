import axios from 'axios'
import { Interactor } from '../../model'

export async function retrieveJiraIssue(
  ticketId: string,
  jiraBaseUrl: string,
  jiraApiToken: string,
  jiraUsername: string,
  interactor: Interactor
): Promise<any> {
  if (!jiraBaseUrl || !jiraApiToken || !jiraUsername) {
    throw new Error('Jira integration incorrectly set')
  }

  try {
    interactor.displayText(`Fetching JIRA ticket ${ticketId}...`)
    const response = await axios.get(`${jiraBaseUrl}/rest/api/2/issue/${ticketId}`, {
      auth: {
        username: jiraUsername,
        password: jiraApiToken,
      },
    })
    interactor.displayText(`... got JIRA response.`)

    return response.data
  } catch (error: any) {
    interactor.warn(`Failed to retrieve Jira ticket `)
    return `Failed to retrieve Jira ticket with ID ${ticketId}: ${error.message}`
  }
}
