import { runBash } from '../function/run-bash';
import { Context } from '../context';
import { Interactor } from '../interactor';
import { CommandHandler } from './command-handler';

export class GitCommitHandler extends CommandHandler {
    commandWord = 'commit';
    description = 'commits staged changes with a provided message';

    constructor(private interactor: Interactor) {
        super();
    }

    async handle(command: string, context: Context): Promise<Context> {
        if (!command) {
            this.interactor.error('Commit message is required.');
            return context;
        }

        const result = await runBash({
            command: `git ${command}"`,
            root: context.project.root,
            interactor: this.interactor,
        });
        this.interactor.displayText(result);
        return context;
    }
}
