import * as fs from 'fs'
import { promisify } from 'util'
import { Interactor } from '../../model'

const unlink = promisify(fs.unlink)

export async function unlinkFile(filePath: string, _interactor: Interactor): Promise<void> {
  await unlink(filePath)
}
