import {CommandContext, Interactor} from "../../model"
import {configService} from "../../service/config.service"
import {loadOrInitProjectDescription} from "../../service/load-or-init-project-description"

export async function selectProject(
  name: string,
  interactor: Interactor,
  username: string,
): Promise<CommandContext | null> {
  if (!name && !configService.project) {
    interactor.error("No project selected nor known.")
    return null
  }
  let projectPath: string
  try {
    projectPath = configService.selectProject(name)
  } catch (err: any) {
    interactor.error(err.message)
    return null
  }
  if (!projectPath) {
    interactor.error(`No path found to project ${name}`)
    return null
  }
  
  const projectConfig = await loadOrInitProjectDescription(
    projectPath,
    interactor,
    username,
  )
  
  return new CommandContext(
    {
      ...projectConfig,
      root: projectPath,
      name: name
    },
    username,
  )
}
