import { BaseServer } from '@baseServer/core/BaseServer'

import { MQProvider } from '@core/providers/MQProvider'
import { GatewayRoute } from '@gateway/routes/GatewayRoute'
import { LogProvider } from '@core/providers/LogProvider'

import { GatewayMongooseProvider } from '@gateway/providers/GatewayMongooseProvider'

import { gatewayPublisherConfig } from '@gateway/configs/GatewayPublisherConfig'
import { gatewayRouteMappings } from '@gateway/configs/GatewayRouteMappings'
import { mongoDbs, mongoTextConfig } from '@gateway/configs/MongoTestConfig'
import { UpdateJobProvider } from './providers/UpdateJobProvider'

export class InitGatewayServer extends BaseServer {
  private mqIp: string
  private jobMQ: MQProvider
  private gatewayLog: LogProvider = new LogProvider(this.name)
  
  async startServer() {
    try {
      this.mqIp = BaseServer.setIp(this.gatewayLog)
      this.jobMQ = new MQProvider(this.mqIp, gatewayPublisherConfig.port, gatewayPublisherConfig.domain)

      const gatewayMongoDb: GatewayMongooseProvider = new GatewayMongooseProvider(mongoTextConfig, mongoDbs.devModels.name)
      await gatewayMongoDb.initDefault()
      gatewayMongoDb.initDefaultModels()
      this.gatewayLog.success('Initialized Db Models')

      const updateJobProvider = new UpdateJobProvider(gatewayMongoDb)
      this.jobMQ.startClient(updateJobProvider)
      this.gatewayLog.success(`Started Dealer on Gateway ${this.mqIp}`)

      const gatewayRoute = new GatewayRoute(gatewayRouteMappings.gateway.name, gatewayMongoDb, this.jobMQ)
      this.setRoutes([ gatewayRoute ])

      this.run()
    } catch (err) {
      this.gatewayLog.error(err)
      throw err
    }
  }
}