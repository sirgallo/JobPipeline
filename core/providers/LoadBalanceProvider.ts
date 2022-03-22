import zmq, { Router, Dealer } from 'zeromq'
import { randomUUID } from 'crypto'

import { cryptoOptions } from '@core/crypto/CryptoOptions'
import { LogProvider } from '@core/providers/LogProvider'
import { SimpleQueueProvider } from '@core/providers/SimpleQueueProvider'
import {
  IInternalJobQueueMessage,
  IInternalLivelinessResponse,
  ISockRequest,
  LifeCycle
} from '@core/models/IMq'
import { IGenericJob } from '@core/models/IJob'
import { MQProvider } from '@core/providers/MQProvider'
import { createImportSpecifier } from 'typescript'

const NAME = 'Load Balance Provider'
const strEncoding = 'utf-8'
const loadBalanceEventName = 'lbQueueUpdate'
const localhost = '127.0.0.1'

export class LoadBalanceProvider {
  clientsock: Router
  workersock: Router

  private jobQueue: SimpleQueueProvider
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
      this.jobQueue = new SimpleQueueProvider(loadBalanceEventName)

      this.startClientRouter()
      this.startWorkerRouter()
    } catch (err) {
      this.lbLog.error(err)
      throw err
    }
  }

  async startClientRouter() {
    this.clientsock = new Router()
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
    this.workersock = new Router()
    this.workersock.routingId = randomUUID(cryptoOptions)

    await this.workersock.bind(`${this.protocol}://*:${this.workerPort}`)

    this.jobQueueOn()
    MQProvider.setIntervalQueue(this.jobQueue, 200)

    for await (const [ header, body ] of this.workersock) {
      const strHeader = header.toString(strEncoding)

      this.knownWorkerMachines.add(strHeader)
      if (! this.knownWorkersMap[strHeader]) this.knownWorkersMap[strHeader] = true
      else this.knownWorkersMap[strHeader] = true

      this.lbLog.info(`Worker Machines: ${[...this.knownWorkerMachines]}`)
      
      if (body) {
        const index = await this.availableMachines(this.knownClientsMap)
        await this.clientsock.send([
          [...this.knownClientMachines][index],
          body
        ])
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
          this.lbLog.error(`Job failed with hash: ${job.body.message}`)
        }
      }
    })
  }

  private async availableMachines(machines: Record<string, boolean>): Promise<number> {
    const totalAvailableMachines = Object.keys(machines).map(key => machines[key] === true ? key : null).filter(el => el).length
    const randomValue = Math.random() * totalAvailableMachines
    const roundedIndex = Math.round(randomValue)
    
    return roundedIndex
  }
}