import { existsSync, readFileSync, writeFileSync } from 'fs'
import * as yaml from 'yaml'
import { Interactor, ProjectDescription } from '../model'
import * as path from 'node:path'
import { findFilesByName } from '../function/find-files-by-name'
import { getFormattedDocs } from '../function/get-formatted-docs'

const CONFIG_FILENAME_YAML = 'coday.yaml'

export const loadOrInitProjectDescription = async (
  projectPath: string,
  interactor: Interactor,
  username: string
): Promise<ProjectDescription> => {
  let absoluteProjectDescriptionPath: string | null = null
  let projectDescription: ProjectDescription

  const foundFiles = await findFilesByName({ text: CONFIG_FILENAME_YAML, root: projectPath })

  if (foundFiles.length > 1) {
    throw new Error(
      `Multiple files found for ${CONFIG_FILENAME_YAML}. Please ensure there is only one file with this name.`
    )
  }
  if (foundFiles.length === 1) {
    absoluteProjectDescriptionPath = path.join(projectPath, foundFiles[0])
  }

  if (!absoluteProjectDescriptionPath || !existsSync(absoluteProjectDescriptionPath)) {
    // Then create a default file at project's root
    projectDescription = {
      description: `Dummy description of the project, refer to docs for proper use.`,
      mandatoryDocs: [],
      optionalDocs: [],
      scripts: {
        example: {
          description:
            'Dummy description of the example script so that the LLM can get a grasp of what it does (so to understand when to use it), refer to docs for proper use.',
          command: 'echo "example script run with great success"',
          parametersDescription: 'Dummy description of parameters, refer to docs for proper use.',
        },
      },
    }
    const yamlConfig = yaml.stringify(projectDescription)
    const projectConfigPath = path.join(projectPath, CONFIG_FILENAME_YAML)
    writeFileSync(projectConfigPath, yamlConfig)
    interactor.displayText(`Project configuration created at: ${projectConfigPath}`)
  } else {
    // Else load the found file
    const fileContent = readFileSync(absoluteProjectDescriptionPath, 'utf-8')
    projectDescription = yaml.parse(fileContent) as ProjectDescription
    interactor.displayText(`Project configuration used: ${absoluteProjectDescriptionPath}`)
  }

  projectDescription.description += getFormattedDocs(projectDescription, interactor, projectPath)

  projectDescription.description += `\n\n## User
    
    You are interacting with a human with username: ${username}`

  // TODO: re-enable multi-agents once ... multi-agents ^^
  // if (integrationService.hasIntegration("OPENAI")) {
  //
  //   const projectAssistants = projectDescription.assistants ? [DEFAULT_DESCRIPTION, ...projectDescription.assistants] : undefined
  //   const projectAssistantReferences = projectAssistants?.map((a) => `${a.name} : ${a.description}`)
  //
  //   const assistantText = projectAssistantReferences && projectAssistantReferences.length ? `\n\n## Assistants teamwork
  //                   Here the assistants available on this project (by name : description) : \n- ${projectAssistantReferences.join("\n- ")}\n
  //
  //                   Rules:
  //                   - **Active delegation**: Always delegate parts of complex requests to the relevant assistants given their domain of expertise.
  //                   - **Coordinator**: ${DEFAULT_DESCRIPTION.name} coordinate the team and have a central role
  //                   - **Calling**: To involve an assistant in the thread, mention it with an '@' prefix on their name and explain what is expected from him. The called assistant will be called after the current run. Example: '... and by the way, @otherAssistant, check this part of the request'.`
  //     : ""
  //
  //   projectDescription.description += assistantText
  // }

  return projectDescription
}
