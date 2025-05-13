import { existsSync, readFileSync, writeFileSync } from 'fs'
import * as yaml from 'yaml'
import { Interactor, ProjectDescription } from '../model'
import * as path from 'node:path'
import { findFilesByName } from '../function/find-files-by-name'
import { getFormattedDocs } from '../function/get-formatted-docs'
import { DEFAULT_CODAY_YAML } from './default-coday-yaml'

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
    projectDescription = DEFAULT_CODAY_YAML
    const projectConfigPath = path.join(projectPath, CONFIG_FILENAME_YAML)
    writeFileSync(projectConfigPath, yaml.stringify(projectDescription))
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

  return projectDescription
}
