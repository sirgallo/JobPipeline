import { Dealer } from 'zeromq'
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

const NAME = 'MQ Provider'
const strEncoding = 'utf-8'

/*
  ZMQ implementation of an brokerless message queue

  Dealer --> Async REQ
  Router --> Async REP

  Dealer --> binds self and listens
    --> on http request to an http route, pass request to router
    --> relay to 1 of n routers
  
  Router --> binds single dealer or a load balancer for many dealers, m to n relationship
    --> on message from dealer, push element onto queue
      --> pop first element in queue and perform operation
        --> once complete, send message as response in return to Dealer

  General Layout:
 
      Dealer   Dealer ...
        \      /
         \    /
          \  /
        LB-Proxy
          /   \
         /     \
        /       \
      Router   Router ...

  Completely non-blocking
*/

const routerQueueEventName = 'routerQueueUpdate'

export class MQProvider {
  isQueue = false
  sock: Dealer
  
  private routerQueue: SimpleQueueProvider

  private log = new LogProvider(NAME)
  constructor(
    private address: string, 
    private port: string,
    private domain: string,
    private protocol = 'tcp'
  ) {}

  async startRouter(jobClassReq: IGenericJob) {
    try {
      this.sock = new Dealer()
      this.sock.routingId = randomUUID(cryptoOptions)
      //  connect to load balancer, each dealer will still have a unique id
      this.sock.connect(`${this.protocol}://${this.domain}:${this.port}`)

      this.routerQueue = new SimpleQueueProvider(routerQueueEventName)
      this.routerQueueOn(jobClassReq)
      this.isQueue = true
      
      //  check for stale jobs in queue on interval, in case no new jobs come in on sock
      MQProvider.setIntervalQueue(this.routerQueue, 200)

      await this.sock.send(
        JSON.stringify({ routerId: this.sock.routingId, status: 'alive'})
      )
      //  message comes in as buffer with two frames
      //  frame 1 -> server id
      //  frame 2 -> message
      for await (const [ message ] of this.sock) {
        const jsonBody = JSON.parse(message.toString(strEncoding))
        if (jsonBody.message) {
          const queueEntry: IInternalJobQueueMessage = {
            jobId: jsonBody.message,
            header: this.sock.routingId,
            body: jsonBody
          }

          this.routerQueue.push(queueEntry)
          //  on incoming message, emit event to queue --> event driven
          this.routerQueue.emitEvent()

          await this.sock.send(MQProvider.formattedReturnObj(this.sock.routingId, true, this.address, jsonBody.message, this.sock.routingId, jsonBody, 'In Queue'))
        } else if (jsonBody.heartbeat) {
          // heartbeat
          await this.sock.send(
            JSON.stringify({ routerId: this.sock.routingId, status: 'alive'})
          )
        }
      }
    } catch (err) { throw err }
  }

  async startDealer(jobClassResp: IGenericJob) {
    try {
      this.sock = new Dealer()
      //  generate unique id on socket for identification
      this.sock.routingId = randomUUID(cryptoOptions)
      this.sock.connect(`${this.protocol}://${this.domain}:${this.port}`)

      await this.sock.send(
        JSON.stringify({ routerId: this.sock.routingId, status: 'alive'})
      )
      //  listen for response from router
      for await (const [ message ] of this.sock) {
        const jsonMessage = JSON.parse(message.toString())
        if (jsonMessage.body) {
          // perform operation
          await jobClassResp.execute(jsonMessage.body)
        } else if (jsonMessage.heartbeat) {
          // heartbeat
          await this.sock.send(
            JSON.stringify({ routerId: this.sock.routingId, status: 'alive'})
          )
        }
      }
    } catch (err) { throw err }
  }

  async pushDealer(newMessage: any) {
    try {
      this.log.info('Pushing new message through dealer to worker...')
      //  this is how we can use http routes, pass request from http route on to the socket
      await this.sock.send(JSON.stringify({ message: newMessage }))
    } catch (err) { throw err }
  }

  //  jobFunction needs to be asynchronous
  private routerQueueOn(jobClassReq: IGenericJob) {
    this.routerQueue.queueUpdate.on(this.routerQueue.eventName, async () => {
      if (this.routerQueue.getQueue().length > 0) {
        const job: IInternalJobQueueMessage = this.routerQueue.pop()
        
        try {
          await this.sock.send(MQProvider.formattedReturnObj(this.sock.routingId, true, this.address, job.jobId, job.header, job.body, 'In Progress'))
          const results = await jobClassReq.execute(job.body.message)

          await this.sock.send(MQProvider.formattedReturnObj(this.sock.routingId, true, this.address, job.jobId, job.header, results, 'Finished'))
          this.log.info(`Finished job with hash: ${job.body.message}`)
        } catch (err) { 
          this.log.error(`Job failed with hash: ${job.body.message}`)
          await this.sock.send(MQProvider.formattedReturnObj(this.sock.routingId, true, this.address, job.jobId, job.header, { error: err.toString() }, 'Failed')) 
        }
      }
    })
  }

  static formattedReturnObj(routingId: string, alive: boolean, node: string, job: string, strHeader: string, jsonBody: any, lifeCycle?: LifeCycle): string {
    const livenessResp: IInternalLivelinessResponse = {
      routingId: routingId,
      alive: alive,
      node: node,
      job: job,
      message: jsonBody,
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