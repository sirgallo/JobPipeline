import { BaseServer } from '@baseServer/core/BaseServer'

import { LogProvider } from '@core/providers/LogProvider'
import { MQProvider } from '@core/providers/MQProvider'

import { GatewayMongooseProvider } from '@gateway/providers/GatewayMongooseProvider'
import { mongoDbs, mongoTextConfig } from '@gateway/configs/MongoTestConfig'
import { gatewayPublisherConfig } from '@gateway/configs/GatewayPublisherConfig'
import { jobMqNetwork } from '@gateway/configs/JobMqNetwork'
import { QueryProvider } from '@worker/providers/QueryProvider'

export class InitWorkerServer extends BaseServer {
  private workerLog: LogProvider = new LogProvider(this.name)
  private jobMQ: MQProvider
  private mqIp: string
  
  async startServer() {
    try {
      const gatewayMongoDb: GatewayMongooseProvider = new GatewayMongooseProvider(mongoTextConfig, mongoDbs.devModels.name)
      await gatewayMongoDb.initDefault()
      gatewayMongoDb.initDefaultModels()
      this.workerLog.success('Initialized Db Models')

      this.mqIp = BaseServer.setIp(this.workerLog)
      this.jobMQ = new MQProvider(this.mqIp, gatewayPublisherConfig.port, jobMqNetwork)

      const determineDb = new QueryProvider(gatewayMongoDb)
      this.jobMQ.startRouter(determineDb)
      this.workerLog.success(`Started router on worker with ${this.mqIp}`)
      
      this.run()
    } catch (err) {
      this.workerLog.error(err)
      throw err
    }
    
  }
}