import { Request, Response, NextFunction } from 'express'

import { BaseRoute } from '@core/baseServer/core/BaseRoute'

import { AuthProvider } from '@gateway/providers/AuthProvider'
import { GatewayMongooseProvider } from '@gateway/providers/GatewayMongooseProvider'
import { JobCreationProvider } from '@gateway/providers/JobCreationProvider'
import { LogProvider } from '@core/providers/LogProvider'
import { MQProvider } from '@core/providers/MQProvider'

import { gatewayRouteMappings } from '@gateway/configs/GatewayRouteMappings'

import { 
  IGatewayAddJobRequest,
  IGatewayLoginRequest,
  IGatewayRegisterRequest 
} from '@gateway/models/IGatewayRequest'

const NAME = 'Gateway Route'

export class GatewayRoute extends BaseRoute {
  name = NAME
  private log: LogProvider = new LogProvider(NAME)
  private auth: AuthProvider
  private jobCreate: JobCreationProvider
  constructor(rootpath: string, private mongoDb: GatewayMongooseProvider, private jobMq: MQProvider) {
    super(rootpath)
    this.auth = new AuthProvider(mongoDb)
    this.jobCreate = new JobCreationProvider(this.mongoDb, this.jobMq)
    this.log.initFileLogger()
    this.router.post(gatewayRouteMappings.gateway.subRouteMapping.login.name, this.login.bind(this))
    this.router.post(gatewayRouteMappings.gateway.subRouteMapping.register.name, this.register.bind(this))
    this.router.post(gatewayRouteMappings.gateway.subRouteMapping.addJob.name, this.addJob.bind(this))
  }

  async login(req: Request, res: Response, next: NextFunction) {
    const user: IGatewayLoginRequest = req.body
    try {
      const resp = await this.auth.authenticate(user)

      this.log.getFileSystem().custom(gatewayRouteMappings.gateway.subRouteMapping.login.customConsoleMessages[0], true)
      res
        .status(200)
        .send( { status: resp })
    } catch (err) {
      res
        .status(404)
        .send( { err, message: 'Error in Login Route' })
    }
  }

  async register(req: Request, res: Response, next: NextFunction) {
    const newUser: IGatewayRegisterRequest = req.body
    try {
      const jwToken = await this.auth.register(newUser)
      this.log.getFileSystem().custom(gatewayRouteMappings.gateway.subRouteMapping.register.customConsoleMessages[0], true)
      res
        .status(200)
        .send({ status: 'User Registration Success', token: jwToken })
    } catch (err) {
      this.log.getFileSystem().error(err)
      res
        .status(404)
        .send( { err, message: 'Error in Registration Route' })
    }
  }

  async addJob(req: Request, res: Response, next: NextFunction) {
    const newJob: IGatewayAddJobRequest = req.body
    try {
      const resp = await this.jobCreate.add(newJob)
      this.log.getFileSystem().custom(gatewayRouteMappings.gateway.subRouteMapping.addJob.customConsoleMessages[0], true)
      res
        .status(200)
        .send({ status: 'Job Successfully Added', jobId: resp.jobId })
    } catch (err) {
      res
        .status(404)
        .send({ err, message: 'Error in Job Creation Route' })
    }
  }
}