import { EventEmitter } from 'events'

export class TLinkedNode {
  private next: TLinkedNode
  timestamp: Date = new Date()
  
  constructor(private value: any) {}

  setNext(node: TLinkedNode) {
    this.next = node
  }

  getNext(): TLinkedNode {
    return this.next
  }

  getValue() {
    return this.value
  }

  compareNodeTimestamps(node: TLinkedNode): boolean {
    return node.timestamp.getMilliseconds() < this.timestamp.getMilliseconds()
  }
}

export class SimpleQueueProvider {
  eventName: string
  queueUpdate = new EventEmitter()

  length: number = 0

  private seedNode: TLinkedNode
  constructor(eventName) { this.eventName = eventName }

  enqueue(unLinkedNode: TLinkedNode) {
    if (! this.seedNode) this.seedNode = unLinkedNode
    else if (this.seedNode.compareNodeTimestamps(unLinkedNode)) {
      const newNext = this.seedNode
      this.seedNode = unLinkedNode
      this.seedNode.setNext(newNext)
    } else this.seedNode.setNext(unLinkedNode)
    
    ++this.length

    this.emitEvent()
  }

  async dequeue(): Promise<any> {
    try {
      return await new Promise<any>((resolve, reject) => {
        try {  
          if (! this.seedNode) return resolve(null)

          const retVal = this.seedNode.getValue()
          this.seedNode = this.seedNode.getNext()

          --this.length

          return resolve(retVal)
        } catch (err) { return reject(err) }
      }) 
    } catch (err) { throw err }
  }

  emitEvent(...args) {
    this.queueUpdate.emit(this.eventName, ...args)
  }
}