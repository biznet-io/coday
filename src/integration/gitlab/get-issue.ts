import axios from 'axios'
import {Interactor} from "../../model/interactor"

export async function getIssue(issueId: string, gitlabBaseUrl: string, gitlabApiToken: string, gitlabUsername: string, interactor: Interactor): Promise<any> {

  if (!gitlabBaseUrl || !gitlabApiToken || !gitlabUsername) {
    throw new Error('GitLab integration incorrectly set')
  }

  try {
    interactor.displayText(`Fetching GitLab issue ${issueId}...`)
    const response = await axios.get(
      `${gitlabBaseUrl}/issues/${issueId}`,
      {
        headers: {
          'PRIVATE-TOKEN': gitlabApiToken
        }
      }
    )
    interactor.displayText("...GitLab response received.")

    return response.data
  } catch (error: any) {
    interactor.warn(`Failed to retrieve GitLab issue`)
    return `Failed to retrieve GitLab issue with ID ${issueId}: ${error}`
  }
}
