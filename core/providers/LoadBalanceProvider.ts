import { Router } from 'zeromq'
import { randomUUID } from 'crypto'

import { cryptoOptions } from '@core/crypto/CryptoOptions'
import { LogProvider } from '@core/providers/LogProvider'
import { SimpleQueueProvider } from '@core/providers/SimpleQueueProvider'
import {
  IAvailableMachine,
  IInternalJobQueueMessage,
  ISockRequest,
} from '@core/models/IMq'
import { MQProvider } from '@core/providers/MQProvider'
import { sleep, toMs } from '@core/utils/Utils'

const NAME = 'Load Balance Provider'
const strEncoding = 'utf-8'
const loadBalanceEventName = 'lbQueueUpdate'
const retEventName = 'retEventName'

const ONSTARTUP = 45
const INTERVAL = 30

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

  private knownClientsMap: Record<string, IAvailableMachine> = {}
  private knownWorkersMap: Record<string, IAvailableMachine> = {}
  
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

      this.heartbeat()
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
      if (! this.knownClientsMap[strHeader]) { 
        this.knownClientsMap[strHeader] = {
          status: 'Ready',
          validated: new Date()
        }
      } else {
        this.knownClientsMap[strHeader] = {
          status: 'Ready',
          validated: new Date()
        }
      }

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
      
      this.lbLog.info(body.toString(strEncoding))

      this.knownWorkerMachines.add(strHeader)
      if (! this.knownWorkersMap[strHeader]) {
        this.knownWorkersMap[strHeader] = {
          status: 'Ready',
          validated: new Date()
        }
      } else {
        this.knownWorkersMap[strHeader] = {
          status: 'Ready',
          validated: new Date()
        }
      }
      
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
            const index = this.availableMachines(this.knownWorkersMap)
            //  need to pass identity in first frame
            //  router stores id of dealer in hash table
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
          const index = this.availableMachines(this.knownClientsMap)
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

  private async heartbeat() {
    this.lbLog.info(`Sleep on Startup for: ${ONSTARTUP}s`)
    await sleep(toMs.sec(ONSTARTUP))
    this.lbLog.info('Begin Heartbeating...')
    while (true) {
      for (const machine of this.getMachines(this.knownWorkersMap)) {
        this.lbLog.debug(`Validating machine with ID: ${machine}`)
        await this.workersock.send([
          machine,
          JSON.stringify({ heartbeat: true })
        ])
      }
      for (const machine of this.getMachines(this.knownClientsMap)) {
        this.lbLog.debug(`Validating machine with ID: ${machine}`)
        await this.clientsock.send([
          machine,
          JSON.stringify({ heartbeat: true })
        ])
      }
      await sleep(toMs.sec(ONSTARTUP))
    }
  }

  private availableMachines(machines: Record<string, IAvailableMachine>): number {
    const totalAvailableMachines = Object.keys(machines)
      .map(key => machines[key].status === 'Ready' ? key : null)
      .filter(el => el).length
    const randomValue = Math.random() * totalAvailableMachines
    const roundedIndex = Math.floor(randomValue)
    
    return roundedIndex
  }

  private getMachines(machines: Record<string, IAvailableMachine>): Array<string> {
    const machinesToCheck = Object.keys(machines)
      .map( key => this.outsideTimeout(machines[key].validated, INTERVAL) ? key : null)
      .filter(el => el)
    
    return machinesToCheck
  }

  private outsideTimeout(dateToTest: Date, timeout: number): boolean {
    const now = new Date()
    const pastTimeout = dateToTest.getTime() + timeout
    
    if (now.getTime() > pastTimeout) return true
    else return false
  }
}