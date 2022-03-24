import { Dealer } from 'zeromq'
import { randomUUID } from 'crypto'

import { cryptoOptions } from '@core/crypto/CryptoOptions'
import { LogProvider } from '@core/providers/LogProvider'
import { SimpleQueueProvider } from '@core/providers/SimpleQueueProvider'
import {
  IHeartBeat,
  IInternalJobQueueMessage,
  IInternalLivelinessResponse,
  LifeCycle,
  MachineStatus
} from '@core/models/IMq'
import { IGenericJob } from '@core/models/IJob'

const NAME = 'MQ Provider'
const strEncoding = 'utf-8'

/*
  ZMQ implementation of an brokerless message queue

  Dealer --> Async REQ
  Router --> Async REP

  Dealer --> binds self and listens
    --> on http request to an http route, pass request to router
    --> relay to 1 of n routers
  
  Router --> binds single or many dealers/load balancer, m to n relationship
    --> on message from dealer, push element onto queue
      --> pop first element in queue and perform operation
        --> once complete, send message as response in return to Dealer

  General Layout:
 
      Dealer   Dealer ...
        \      /
         \    /
          \  /
          Router
         Heartbeat
          Queue
         Heartbeat
          Router
          /   \
         /     \
        /       \
      Dealer   Dealer ...
      Queue    Queue

  Completely non-blocking
*/

const workerQueueEventName = 'workerQueueUpdate'
const reqQueueEventName = 'reqQueueUpdate'

export class MQProvider {
  isQueue = false
  sock: Dealer

  private machineStatus: MachineStatus = 'Ready'
  private workerQueue: SimpleQueueProvider
  private reqQueue: SimpleQueueProvider

  private sockAvailable = true

  private log = new LogProvider(NAME)
  constructor(
    private address: string, 
    private port: string,
    private domain: string,
    private protocol = 'tcp'
  ) {}

  async startWorker(jobClassReq: IGenericJob) {
    try {
      this.sock = new Dealer()
      this.sock.routingId = randomUUID(cryptoOptions)
      //  connect to load balancer, each dealer will still have a unique id
      this.sock.connect(`${this.protocol}://${this.domain}:${this.port}`)

      this.workerQueue = new SimpleQueueProvider(workerQueueEventName)
      this.workerQueueOn(jobClassReq)
      this.isQueue = true

      this.reqQueue = new SimpleQueueProvider(reqQueueEventName)
      this.reqQueueOn()
      //  check for stale jobs in queue on interval, in case no new jobs come in on sock
      MQProvider.setIntervalQueue(this.workerQueue, 0)
      MQProvider.setIntervalQueue(this.reqQueue, 0)

      const healthCheck: IHeartBeat = { 
        routerId: this.sock.routingId, 
        healthy: 'Alive',
        status: this.machineStatus 
      }

      await this.sock.send(JSON.stringify(healthCheck))

      /*
        Need to know message format beforehand, we are the ones designing the messages passed between machines
      */
      for await (const [ message ] of this.sock) {
        const jsonBody = JSON.parse(message.toString(strEncoding))
        if (jsonBody.message) {
          const queueEntry: IInternalJobQueueMessage = {
            jobId: jsonBody.message,
            header: this.sock.routingId,
            body: jsonBody
          }

          this.workerQueue.push(queueEntry)
          //  on incoming message, emit event to queue --> event driven
          this.workerQueue.emitEvent()
        } else if (jsonBody.heartbeat) {
          // heartbeat
          await this.sock.send(JSON.stringify(healthCheck))
        }
      }
    } catch (err) { throw err }
  }

  async startClient(jobClassResp: IGenericJob) {
    try {
      this.sock = new Dealer()
      //  generate unique id on socket for identification
      this.sock.routingId = randomUUID(cryptoOptions)
      this.sock.connect(`${this.protocol}://${this.domain}:${this.port}`)

      this.reqQueue = new SimpleQueueProvider(reqQueueEventName)
      this.reqQueueOn()
      
      MQProvider.setIntervalQueue(this.reqQueue, 0)

      const healthCheck: IHeartBeat = { 
        routerId: this.sock.routingId, 
        healthy: 'Alive',
        status: this.machineStatus 
      }

      await this.sock.send(JSON.stringify(healthCheck))

      //  listen for response from worker
      for await (const [ message ] of this.sock) {
        const jsonMessage = JSON.parse(message.toString(strEncoding))
        if (jsonMessage.body) {
          // perform operation
          await jobClassResp.execute(jsonMessage.body)
        } else if (jsonMessage.heartbeat) {
          // heartbeat
          await this.sock.send(JSON.stringify(healthCheck))
        }
      }
    } catch (err) { throw err }
  }

  async pushClient(newMessage: any) {
    try {
      this.log.info('Pushing new message through dealer to worker...')
      //  this is how we can use http routes, pass request from http route on to the socket
      this.reqQueue.push(JSON.stringify({ message: newMessage }))
    } catch (err) { throw err }
  }

  //  jobFunction needs to be asynchronous
  private workerQueueOn(jobClassReq: IGenericJob) {
    this.workerQueue.queueUpdate.on(this.workerQueue.eventName, async () => {
      if (this.sockAvailable && this.workerQueue.getQueue().length > 0) {
        const job: IInternalJobQueueMessage = this.workerQueue.pop()
        
        try {
          this.reqQueue.push(MQProvider.formattedReturnObj(this.address, job.jobId, job.body, this.machineStatus, 'In Progress'))
          this.reqQueue.emitEvent()
          
          const results = await jobClassReq.execute(job.body.message)
          
          this.reqQueue.push(MQProvider.formattedReturnObj(this.address, job.jobId, results, this.machineStatus, 'Finished'))
          this.reqQueue.emitEvent()

          this.log.info(`Finished job with hash: ${job.body.message}`)
        } catch (err) { 
          this.log.error(`Job failed with hash: ${job.body.message}`)
          this.reqQueue.push(MQProvider.formattedReturnObj(this.address, job.jobId, { error: err.toString() }, this.machineStatus, 'Failed'))
          this.reqQueue.emitEvent()
        }
      }
    })
  }

  private reqQueueOn() {
    this.reqQueue.queueUpdate.on(this.reqQueue.eventName, async () => {
      if (this.sockAvailable && this.reqQueue.getQueue().length > 0) {
        this.sockAvailable = false
        const jobUpdate: string = this.reqQueue.pop()
        
        try {
          await this.sock.send(jobUpdate)
          this.sockAvailable = true
        } catch (err) { 
          this.log.error('Return Queue failure on worker')
          this.sockAvailable = true 
        }
      }
    })
  }

  static formattedReturnObj(node: string, job: string, jsonBody: any, status: MachineStatus, lifeCycle?: LifeCycle): string {
    const livenessResp: IInternalLivelinessResponse = {
      node: node,
      job: job,
      message: jsonBody,
      status: status,
      ...(lifeCycle ? { lifeCycle: lifeCycle } : {})
    }

    return JSON.stringify(livenessResp)
  }

  static setIntervalQueue(queue: SimpleQueueProvider, timeout: number) {
    setInterval(() => queue.emitEvent(), timeout)
  }

  close() {
    this.sock.close()
  }
}