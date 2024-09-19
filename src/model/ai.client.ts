import {CommandContext} from "../model"

export interface AiClient {
  addMessage(
    message: string,
    context: CommandContext,
  ): Promise<void>;
  
  answer(
    name: string,
    command: string,
    context: CommandContext,
  ): Promise<string>;
  
  kill(): void;
}
