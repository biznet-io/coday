import { Interactor } from '../../model'
import { retrieveAutocompleteData } from './retrieve-autocomplete-data'
import { searchJiraIssues } from './search-jira-issues'
import { createFieldMapping } from './jira.helpers'
import { AutocompleteDataResponse, FieldMappingDescription } from './jira'

export interface ActiveFieldMapping {
  name: string
  jqlQueryKey: string | undefined
  ticketCreationKey: string | undefined
  custom: boolean
  searchable?: string | null
  cfid?: string | null
  autocompleteValue?: string[]
  operators?: string[]
}

export class JiraFieldMapper {
  private readonly baseUrl: string
  private readonly apiToken: string
  private readonly username: string
  private readonly interactor: Interactor

  constructor(jiraBaseUrl: string, jiraApiToken: string, jiraUsername: string, interactor: Interactor) {
    this.baseUrl = jiraBaseUrl
    this.apiToken = jiraApiToken
    this.username = jiraUsername
    this.interactor = interactor
  }

  // Main method to generate comprehensive field mapping
  async generateFieldMapping(maxResults: number = 100): Promise<{
    mappings: ActiveFieldMapping[]
    autocompleteData: AutocompleteDataResponse
    description: FieldMappingDescription
  }> {
    try {
      // Fetch all required data with diverse ticket types
      const [autocompleteData, searchResponse] = await Promise.all([
        retrieveAutocompleteData(this.baseUrl, this.apiToken, this.username, this.interactor),
        searchJiraIssues({
          request: {
            jql: "project = 'WZ' AND labels = coday_template",
            maxResults,
            fields: ['*all'],
          },
          jiraBaseUrl: this.baseUrl,
          jiraApiToken: this.apiToken,
          jiraUsername: this.username,
          interactor: this.interactor,
        }),
      ])

      // Create field mapping
      const mappings = createFieldMapping(autocompleteData.visibleFieldNames, searchResponse.issues)

      const description = this.generateMappingDescription(mappings)
      return {
        mappings,
        autocompleteData,
        description,
      }
    } catch (error) {
      this.interactor.warn(`Error creating field mapping: ${error}`)
      return {
        mappings: [],
        autocompleteData: { visibleFieldNames: [] },
        description: {
          customFields: 'Failed to generate the jira ticket creation description',
          jqlResearchDescription: 'Failed to generate the jira jql research description',
        },
      }
    }
  }

  private generateMappingDescription(mappings: ActiveFieldMapping[]): FieldMappingDescription {
    const customFields = mappings
      .map(
        (field) => `    ${field.name} - ${field.custom ? 'Custom' : 'Standard'}
    Name: ${field.name}    
    Key: ${field.ticketCreationKey}`
      )
      .join('\n\n')

    const jqlFields = mappings
      .map((field) => {
        const jqlIdentifier = field?.cfid ?? field?.jqlQueryKey
        const operators = field.operators?.length ? ` [${field.operators.join(', ')}]` : ''

        return `    ${field.name} - ${field.custom ? 'Custom' : 'Standard'}
    Name: ${field.name}    
    Query Key: ${jqlIdentifier}
    Operator: ${operators}`
      })
      .join('\n\n')

    return {
      customFields: `# Jira Ticket Creation Fields (${mappings.length} fields)

${customFields}

Notes:
- Only use these keys when creating issues via API
- Custom fields might require specific values`,

      jqlResearchDescription: `# Jira JQL Search Fields (${mappings.length} fields)

${jqlFields}

Notes:
- Only use these keys to translate a user request into jql request
- Include operators where specified
- Custom fields may have restricted values`,
    }
  }
}

// Note: The standalone createJiraFieldMapping function has been replaced by the jiraFieldMappingCache service
