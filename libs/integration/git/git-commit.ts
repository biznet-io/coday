import { runBash } from '../../function/run-bash'
import { Interactor } from '../../model/interactor'

export const gitCommit = async ({
  message,
  root,
  interactor,
}: {
  message: string
  root: string
  interactor: Interactor
}): Promise<string> => {
  const command = `git commit -m "${message}"`
  return await runBash({
    command,
    root,
    interactor,
  })
}
