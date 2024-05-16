import * as readlineSync from 'readline-sync';
import { MainHandler} from "./src/main-handler";
import {CommandContext} from "./src/command-context";
import os from 'os';
import {existsSync, mkdirSync} from "node:fs";
import {LoadHandler} from "./src/load-handler";
import {SaveHandler} from "./src/save-handler";

const PROJECT_ROOT: string = '/Users/vincent.audibert/Workspace/coday'
const DATA_PATH: string = "/.coday/"
const MAX_ITERATIONS: number = 10

class Coday {

    codayPath: string
    userInfo: os.UserInfo<string>
    loadHandler: LoadHandler
    context: CommandContext | null = null
    mainHandler: MainHandler

    constructor() {
        this.userInfo = os.userInfo()
        this.codayPath = this.initCodayPath(this.userInfo)
        this.loadHandler = new LoadHandler(this.codayPath, PROJECT_ROOT, this.userInfo.username)
        this.mainHandler = new MainHandler(
            MAX_ITERATIONS,
            [
                new SaveHandler(this.codayPath),
                    this.loadHandler
            ]
        )
    }

    async run(): Promise<void> {
        // Main loop to keep waiting for user input
        do {
            // initiate context in loop for when context is cleared
            if (!this.context) {
                this.context = await this.loadHandler.handle("load", this.loadHandler.defaultContext)
            }
            // allow user input
            console.log("")
            const userCommand = readlineSync.question(`${this.context.username} : `)

            // quit loop if user wants to exit
            if (userCommand === this.mainHandler.exitWord) {
                break;
            }

            // add the user command to the queue and let handlers decompose it in many and resolve them ultimately
            this.context.commandQueue.push(userCommand)

            this.context = await this.mainHandler.handle(userCommand, this.context)

        } while (true)
    }

    private initCodayPath(userInfo: os.UserInfo<string>): string {
        // define data path to store settings and other
        const codayPath = `${userInfo.homedir}${DATA_PATH}`

        try {
            if (!existsSync(codayPath)) {
                mkdirSync(codayPath, {recursive: true});
                console.log(`Coday data folder created at: ${codayPath}`);
            } else {
                console.log(`Coday data folder used: ${codayPath}`);
            }
        } catch (error) {
            console.error(`Error creating directory:`, error);
        }
        return codayPath
    }
}

new Coday().run()