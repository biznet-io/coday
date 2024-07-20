import {CommandContext} from "../../model/command-context"
import {configService} from "../../service/config.service"
import {integrationService} from "../../service/integration.service"
import {IntegrationName} from "../../model/integration-name"
import {IntegrationConfig} from "../../model/integration-config"
import {Interactor} from "../../model/interactor"
import {keywords} from "../../keywords"
import {CommandHandler} from "../../model/command.handler"

export class EditIntegrationHandler extends CommandHandler {
  constructor(
    private interactor: Interactor,
  ) {
    super({
      commandWord: "edit-integration",
      description: "Edit integration settings"
    })
  }
  
  async handle(
    command: string,
    context: CommandContext,
  ): Promise<CommandContext> {
    if (!configService.lastProject) {
      this.interactor.displayText("No current project, select one first.")
      return context
    }
    // Mention all available integrations
    const apiNames = Object.keys(IntegrationName)
    
    // List all set integrations and prompt to choose one to edit (or type name of wanted one)
    const currentIntegrations = integrationService.integrations
    const existingIntegrationNames: IntegrationName[] = currentIntegrations
      ? (Object.keys(currentIntegrations) as IntegrationName[])
      : []
    const answer = (
      await this.interactor.chooseOption(
        [...apiNames, keywords.exit],
        "Select an integration to edit",
        `Integrations are tools behind some commands and/or functions for AI.\nHere are the configured ones: (${existingIntegrationNames.join(", ")})`,
      )
    ).toUpperCase()
    if (!answer || answer === keywords.exit.toUpperCase()) {
      return context
    }
    let apiIntegration: IntegrationConfig =
      currentIntegrations[answer as IntegrationName] || {}
    let selectedName = answer as IntegrationName
    
    // take all fields with existing values if available
    const apiUrl = await this.interactor.promptText(
      "Api url (if applicable)",
      apiIntegration.apiUrl,
    )
    const username = await this.interactor.promptText(
      "username (if applicable)",
      apiIntegration.username,
    )
    const apiKey = await this.interactor.promptText(
      "Api key (if applicable)",
      apiIntegration.apiKey,
    ) // TODO see another way to update an api key ?
    
    integrationService.setIntegration(selectedName, {apiUrl, username, apiKey})
    
    return context
  }
}
