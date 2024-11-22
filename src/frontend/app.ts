import {ChatTextareaComponent} from "./chat-textarea/chat-textarea.component"
import {ChoiceSelectComponent} from "./choice-select/choice-select.component"
import {ChatHistoryComponent} from "./chat-history/chat-history.component"
import {buildCodayEvent, CodayEvent, ErrorEvent} from "shared/coday-events"
import {CodayEventHandler} from "./utils/coday-event-handler"
import {HeaderComponent} from "./header/header.component"

function generateClientId() {
  // Generate or retrieve a unique client ID
  return Math.random().toString(36).substring(2, 15)
}

const clientId = generateClientId()
console.log(`Session started with clientId: ${clientId}`)

function postEvent(event: CodayEvent): Promise<Response> {
  return fetch(`/api/message?clientId=${clientId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  })
}

// Define stop callback
const handleStop = () => {
  fetch("/api/stop", {method: "POST"})
    .catch(error => console.error("Error stopping execution:", error))
}

const chatHistory = new ChatHistoryComponent(handleStop)
const chatInputComponent = new ChatTextareaComponent(postEvent)
const choiceInputComponent = new ChoiceSelectComponent(postEvent)

const components: CodayEventHandler[] = [chatInputComponent, choiceInputComponent, chatHistory, new HeaderComponent()]
const eventSource = new EventSource(`/events?clientId=${clientId}`)

eventSource.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data)
    const codayEvent = buildCodayEvent(data)
    if (codayEvent) {
      components.forEach(c => c.handle(codayEvent))
    }
  } catch (error: any) {
    console.error("Could not parse event", event)
  }
}

eventSource.onerror = () => {
  if (new ErrorEvent({error: "Connection lost"})) {
    components.forEach(c => c.handle(new ErrorEvent({error: "Connection lost"})))
  }
}
