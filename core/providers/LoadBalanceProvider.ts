import { Router } from 'zeromq'
import { randomUUID } from 'crypto'

import { cryptoOptions } from '@core/crypto/CryptoOptions'
import { LogProvider } from '@core/providers/LogProvider'
import { SimpleQueueProvider } from '@core/providers/SimpleQueueProvider'
import {
  IInternalJobQueueMessage,
  ISockRequest,
} from '@core/models/IMq'
import { MQProvider } from '@core/providers/MQProvider'

const NAME = 'Load Balance Provider'
const strEncoding = 'utf-8'
const loadBalanceEventName = 'lbQueueUpdate'
const retEventName = 'retEventName'

/*
  Custom Load Balancer

  Design:

            clients ...
                |
                |
  add to known clients if not discovered yet
            add job to queue
      distribute to known workers

  Utilizing 2 separate sockets, with the frontend socket
  relaying to the backend socket

  Worker and Client unique identifiers are stored in memory

  Workers and Clients express if they are busy or not, and if 
  available, are selected at random to either begin a new job
  or return a response
*/

export class LoadBalanceProvider {
  clientsock: Router
  workersock: Router

  private jobQueue: SimpleQueueProvider
  private retQueue: SimpleQueueProvider

  private knownClientMachines: Set<string> = new Set()
  private knownWorkerMachines: Set<string> = new Set()

  private knownClientsMap: Record<string, boolean> = {}
  private knownWorkersMap: Record<string, boolean> = {}
  
  private lbLog = new LogProvider(NAME)
  constructor(
    private clientPort: string,
    private workerPort: string,
    private protocol = 'tcp'
  ) {}

  async start() {
    try {
      this.clientsock = new Router()
      this.workersock = new Router()

      this.jobQueue = new SimpleQueueProvider(loadBalanceEventName)
      this.retQueue = new SimpleQueueProvider(retEventName)

      this.jobQueueOn()
      this.retQueueOn()
     
      MQProvider.setIntervalQueue(this.jobQueue, 200)
      MQProvider.setIntervalQueue(this.retQueue, 200)

      this.startClientRouter()
      this.startWorkerRouter()
    } catch (err) {
      this.lbLog.error(err)
      throw err
    }
  }

  async startClientRouter() {
    this.clientsock.routingId = randomUUID(cryptoOptions)
    
    await this.clientsock.bind(`${this.protocol}://*:${this.clientPort}`)
   
    for await (const [ header, body ] of this.clientsock) {
      const strHeader = header.toString(strEncoding)
      const jsonBody: ISockRequest = JSON.parse(body.toString(strEncoding))
      const queueEntry: IInternalJobQueueMessage = {
        jobId: jsonBody.message,
        header: strHeader,
        body: jsonBody
      }

      this.knownClientMachines.add(strHeader)
      if (! this.knownClientsMap[strHeader]) this.knownClientsMap[strHeader] = true
      else this.knownClientsMap[strHeader] = true

      this.lbLog.info(`Client Machines: ${[...this.knownClientMachines]}`)

      await this.clientsock.send([ 
        strHeader, 
        body 
      ])

      this.jobQueue.push(queueEntry)
      this.jobQueue.emitEvent()
    }
  }

  async startWorkerRouter() {
    this.workersock.routingId = randomUUID(cryptoOptions)

    await this.workersock.bind(`${this.protocol}://*:${this.workerPort}`)

    for await (const [ header, body ] of this.workersock) {
      const strHeader = header.toString(strEncoding)
      const jsonBody = JSON.parse(body.toString(strEncoding))

      this.knownWorkerMachines.add(strHeader)
      if (! this.knownWorkersMap[strHeader]) this.knownWorkersMap[strHeader] = true
      else this.knownWorkersMap[strHeader] = true

      this.lbLog.info(`Worker Machines: ${[...this.knownWorkerMachines]}`)
      
      if (jsonBody.job) {
        const retEntry = { body: jsonBody }

        this.retQueue.push(retEntry)
        this.retQueue.emitEvent()
      }
    }
  }

  private jobQueueOn() {
    this.jobQueue.queueUpdate.on(this.jobQueue.eventName, async () => {
      if (this.jobQueue.getQueue().length > 0) {
        const job: IInternalJobQueueMessage = this.jobQueue.pop()
        const strBody = JSON.stringify(job.body)

        try {
          if (job.jobId) { 
            const index = await this.availableMachines(this.knownWorkersMap)
            await this.workersock.send([ 
              [...this.knownWorkerMachines][index],
              strBody 
            ])
          }
        } catch (err) { 
          this.lbLog.error(`Job failed with hash: ${job.jobId} to a Worker Machine.`)
        }
      }
    })
  }

  private retQueueOn() {
    this.retQueue.queueUpdate.on(this.retQueue.eventName, async () => {
      if (this.retQueue.getQueue().length > 0) {
        const returnObj = JSON.stringify(this.retQueue.pop())

        try {
          const index = await this.availableMachines(this.knownClientsMap)
          await this.clientsock.send([
            [...this.knownClientMachines][index],
            returnObj
          ])
        } catch (err) { 
          this.lbLog.error('Error Pushing Updates to Client')
        }
      }
    })
  }

  private async availableMachines(machines: Record<string, boolean>): Promise<number> {
    const totalAvailableMachines = Object.keys(machines).map(key => machines[key] === true ? key : null).filter(el => el).length
    const randomValue = Math.random() * totalAvailableMachines
    const roundedIndex = Math.floor(randomValue)
    
    return roundedIndex
  }
}