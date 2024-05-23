import {Interactor} from '../interactor';
import {CommandHandler} from "./command-handler";
import {CommandContext} from '../command-context';
import {existsSync, writeFileSync} from "node:fs";
import {readFileSync} from "fs";
import {CodayConfig} from "../coday-config";

export class ProjectHandler extends CommandHandler {
    private static readonly CONFIG_FILENAME = 'config.json';
    commandWord: string = 'config';
    description: string = 'handles config related commands';

    constructor(private interactor: Interactor, private codayPath: string, private username: string) {
        super();
    }

    async handle(command: string, context: CommandContext): Promise<CommandContext> {
        const cmd = this.getSubCommand(command)
        let result: CommandContext | null = context
        if (!cmd) {
            this.interactor.displayText(`${this.commandWord} can accept sub-commands: add-project, select-project.`)
        }
        if (cmd === "add-project") {
            result = this.addProject()
        }
        if (cmd === "select-project") {
            result = this.chooseProject()
        }

        if (!result) {
            throw new Error("Context lost in the process")
        }
        return result
    }

    initContext(): CommandContext | null {
        const config = this.loadProjects();
        if (!Object.entries(config.projectPaths).length) { // no projects at all, force user define one
            this.interactor.displayText("No existing project, please define one by its name");
            return this.addProject();
        }
        if (!config.lastProject) { // projects but no previous selection
            // no last project selected, force selection of one
            return this.chooseProject(config)
        }
        return this.selectProject(config.lastProject);
    }

    private chooseProject(cfg?: CodayConfig): CommandContext|null {
        let config = cfg ?? this.loadProjects()
        const names = Object.entries(config.projectPaths).map(entry => entry[0]);
        const selection = this.interactor.chooseOption(names, 'Selection: ', 'Choose an existing project by number, type "new" to create one');
        if (selection === 'new') {
            return this.addProject();
        }
        try {
            const index = parseInt(selection);
            return this.selectProject(names[index]);
        } catch (_) {
            this.interactor.error("Invalid project selection");
            return null;
        }
    }

    private loadProjects(): CodayConfig {
        const projectConfigPath: string = `${this.codayPath}/${ProjectHandler.CONFIG_FILENAME}`;
        let config: CodayConfig;
        if (!existsSync(projectConfigPath)) {
            config = {
                projectPaths: {}
            };
            this.writeConfigFile(config);
            this.interactor.displayText(`Project config created at : ${projectConfigPath}`);
        } else {
            config = JSON.parse(readFileSync(projectConfigPath, 'utf-8')) as CodayConfig;
        }
        return config;
    }

    private addProject(): CommandContext | null {
        let config = this.loadProjects();
        const projectName = this.interactor.promptText("Project name");
        const projectPath = this.interactor.promptText("Project path, no trailing slash");
        config.projectPaths[projectName] = projectPath;
        return this.selectProject(projectName, config);
    }

    resetProjectSelection(): void {
        let config = this.loadProjects();
        config.lastProject = undefined;
        this.writeConfigFile(config);
    }

    private writeConfigFile(config: CodayConfig): void {
        const json = JSON.stringify(config, null, 2);
        writeFileSync(`${this.codayPath}/${ProjectHandler.CONFIG_FILENAME}`, json);
    }

    private selectProject(name: string, cfg?: CodayConfig): CommandContext | null {
        let config = cfg ?? this.loadProjects()
        if (!name && !config.lastProject) {
            this.interactor.error("No project selected nor known.");
            return null;
        }

        const selectedPath = config.projectPaths[name];
        if (!selectedPath) {
            this.interactor.error("");
            return null;
        }
        config.lastProject = name;
        this.interactor.displayText(`Project ${name} selected`);
        this.writeConfigFile(config);

        return {
            projectRootPath: selectedPath,
            username: this.username,
            commandQueue: [],
            history: []
        }
    }
}
