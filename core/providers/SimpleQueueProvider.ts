import { EventEmitter } from 'events'

/*
  Simple Queue

  First in --> First out
  no priority

  Includes an event listener, so that new elements are pushed to the queue, 
  the runtime is aware of this and takes the next step
*/

export class SimpleQueueProvider {
  eventName: string
  private queue = []
  queueUpdate = new EventEmitter()

  constructor(eventName: string = 'queueUpdate') {
    this.eventName = eventName
  }

  getQueue() {
    return this.queue
  }

  push(items) {
    this.queue.push(items)
  }

  pop() {
    return this.queue.shift()
  }

  emitEvent(...args) {
    this.queueUpdate.emit(this.eventName, ...args)
  }
}