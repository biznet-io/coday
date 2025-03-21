import { input, select } from '@inquirer/prompts'
import chalk from 'chalk'
import { Interactor } from '@coday/model/interactor'
import {
  AnswerEvent,
  ChoiceEvent,
  ErrorEvent,
  InviteEvent,
  TextEvent,
  ThinkingEvent,
  WarnEvent,
} from '@coday/shared/coday-events'

export class TerminalInteractor extends Interactor {
  private interactionInProgress = false

  constructor() {
    super()
    this.events.subscribe((event) => {
      if (event instanceof TextEvent) {
        this.displayFormattedText(event.text, event.speaker)
      }
      if (event instanceof WarnEvent) {
        console.warn(`${event.warning}\n`)
      }
      if (event instanceof AnswerEvent && !this.interactionInProgress) {
        this.displayFormattedText(event.answer, event.invite)
      }
      if (event instanceof ErrorEvent) {
        const errorMessage = event.error instanceof Error ? event.error.message : String(event.error);
        console.error(chalk.red(`\n❌ Error: ${errorMessage}\n`));
      }
      if (event instanceof InviteEvent) {
        this.handleInviteEvent(event)
      }
      if (event instanceof ChoiceEvent) {
        this.handleChoiceEvent(event)
      }
      if (event instanceof ThinkingEvent) {
        console.log('.')
      }
    })
  }

  private displayFormattedText(text: string, speaker?: string): void {
    const formattedText = speaker ? `\n${chalk.black.bgWhite(speaker)} : ${text}\n` : text
    console.log(formattedText)
  }

  handleInviteEvent(event: InviteEvent): void {
    this.interactionInProgress = true
    input({
      message: `\n${chalk.black.bgWhite(event.invite)} : `,
      default: event.defaultValue
    })
      .then((answer: string) => {
        this.sendEvent(event.buildAnswer(answer))
      })
      .finally(() => (this.interactionInProgress = false))
  }

  handleChoiceEvent(event: ChoiceEvent): void {
    const { options, invite, optionalQuestion } = event
    this.interactionInProgress = true
    select({
      message: optionalQuestion ? `${optionalQuestion} :\n${invite}` : invite,
      choices: options.map((option) => ({
        name: option,
        value: option,
      })),
    })
      .then((answer: string) => {
        this.sendEvent(event.buildAnswer(answer))
      })
      .finally(() => (this.interactionInProgress = false))
  }
}
