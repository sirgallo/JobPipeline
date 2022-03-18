import { Router, Dealer } from 'zeromq'
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

const dealerQueueEventName = 'dealerQueueUpdate'
const routerQueueEventName = 'routerQueueUpdate'

export class MQProvider {
  isQueue = false
  sock: Dealer | Router

  private routerQueue: SimpleQueueProvider
  private dealerQueue: SimpleQueueProvider
  private inProgressJobCounter = 0
  private knownMachines: Set<string> = new Set()

  private log = new LogProvider(NAME)
  constructor(
    private address: string, 
    private port: string,
    private domain: string,
    private protocol = 'tcp'
  ) {}

  async startRouter(jobClassReq: IGenericJob) {
    try {
      this.sock = new Router()
      this.sock.routingId = randomUUID(cryptoOptions)
      //  connect to load balancer, each dealer will still have a unique id
      this.sock.connect(`${this.protocol}://${this.domain}:${this.port}`)

      this.routerQueue = new SimpleQueueProvider(routerQueueEventName)
      this.routerQueueOn(jobClassReq)
      this.isQueue = true
      
      //  check for stale jobs in queue on interval, in case no new jobs come in on sock
      this.setIntervalQueue(200)

      //  message comes in as buffer with two frames
      //  frame 1 -> server id
      //  frame 2 -> message
      for await (const [ header, body ] of this.sock) {
        const strHeader = header.toString(strEncoding)
        const jsonBody: ISockRequest = JSON.parse(body.toString(strEncoding))
        const queueEntry: IInternalJobQueueMessage = {
          jobId: jsonBody.message,
          header: strHeader,
          body: jsonBody
        }

        //  need to pass identity in first frame
        //  router stores id of dealer in hash table
        await this.sock.send(this.formattedReturnObj(this.sock.routingId, true, jsonBody.message, strHeader, jsonBody, 'In Queue'))
        this.routerQueue.push(queueEntry)
        //  on incoming message, emit event to queue --> event driven
        this.routerQueue.emitEvent()
      }
    } catch (err) { throw err }
  }

  async startDealer(jobClassResp: IGenericJob) {
    try {
      this.sock = new Dealer()
      //  generate unique id on socket for identification
      this.sock.routingId = randomUUID(cryptoOptions)
      await this.sock.bind(`${this.protocol}://*:${this.port}`)

      this.routerQueue = new SimpleQueueProvider(dealerQueueEventName)
      this.routerQueueOn(jobClassResp)
      this.isQueue = true

      //  listen for response from router
      for await (const [ message ] of this.sock) {
        const formattedMessage: IInternalLivelinessResponse = JSON.parse(message.toString(strEncoding))
        this.knownMachines.add(formattedMessage.routingId)
        this.log.info(JSON.stringify(formattedMessage, null, 2))

        await jobClassResp.execute(formattedMessage)
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
          await this.sock.send(this.formattedReturnObj(this.sock.routingId, true, job.jobId, job.header, job.body, 'In Progress'))
          const results = await jobClassReq.execute(job.body.message)

          await this.sock.send(this.formattedReturnObj(this.sock.routingId, true, job.jobId, job.header, results, 'Finished'))
          this.log.info(`Finished job with hash: ${job.body.message}`)
        } catch (err) { 
          this.log.error(`Job failed with hash: ${job.body.message}`)
          await this.sock.send(this.formattedReturnObj(this.sock.routingId, true, job.jobId, job.header, { error: err.toString() }, 'Failed')) 
        }
      }
    })
  }

  private dealerQueueOn(jobClassRep: IGenericJob) {
    this.dealerQueue.queueUpdate.on(this.dealerQueue.eventName, async () => {

    })
  }

  private formattedReturnObj(routingId: string, alive: boolean, job: string, strHeader: string, jsonBody: any, lifeCycle?: LifeCycle): Array<string> {
    const livenessResp: IInternalLivelinessResponse = {
      routingId: routingId,
      alive: alive,
      node: this.address,
      job: job,
      message: jsonBody,
      ...(lifeCycle ? { lifeCycle: lifeCycle } : {})
    }

    return [
      strHeader,
      JSON.stringify(livenessResp)
    ]
  }

  private setIntervalQueue(timeout: number) {
    setInterval(() => this.routerQueue.emitEvent(), timeout)
  }

  close() {
    this.sock.close()
  }
}