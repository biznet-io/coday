import {readFileSync} from "fs";
import {existsSync} from "node:fs";
import {Interactor} from "../interactor";

type ReadFileByPathInput = {
    path: string
    root: string
    interactor?: Interactor
}

export const readFileByPath = ({path, root, interactor}: ReadFileByPathInput) => {
    // need to prevent double slashes
    const tweakedPath = path.startsWith('/')
        ? path.substring(1)
        : path

    const fullPath = `${root}/${tweakedPath}`
    try {
        interactor?.displayText(`reading file ${fullPath}`)
        if (existsSync(fullPath)) {
            return readFileSync(fullPath).toString()
        } else {
            return "File does not exist or path incorrect"
        }

    } catch (err) {
        interactor?.error(`Error reading file ${fullPath}`)
        console.error(err)
        return "Error reading file"
    }
}