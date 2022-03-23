import { BaseServer } from '@baseServer/core/BaseServer'

import { LogProvider } from '@core/providers/LogProvider'
import { MQProvider } from '@core/providers/MQProvider'

import { GatewayMongooseProvider } from '@gateway/providers/GatewayMongooseProvider'
import { mongoDbs, mongoTextConfig } from '@gateway/configs/MongoTestConfig'
import { workerMQConfig } from '@worker/configs/WorkerMQConfig'
import { QueryProvider } from '@worker/providers/QueryProvider'

export class InitWorkerServer extends BaseServer {
  private workerLog: LogProvider = new LogProvider(this.name)
  private workerMQ: MQProvider
  private mqIp: string
  
  async startServer() {
    try {
      const gatewayMongoDb: GatewayMongooseProvider = new GatewayMongooseProvider(mongoTextConfig, mongoDbs.devModels.name)
      await gatewayMongoDb.initDefault()
      gatewayMongoDb.initDefaultModels()
      this.workerLog.success('Initialized Db Models')

      this.mqIp = BaseServer.setIp(this.workerLog)
      this.workerMQ = new MQProvider(this.mqIp, workerMQConfig.port, workerMQConfig.domain)

      const determineDb = new QueryProvider(gatewayMongoDb)
      this.workerMQ.startWorker(determineDb)
      this.workerLog.success(`Started router on worker with ${this.mqIp}`)
      
      this.run()
    } catch (err) {
      this.workerLog.error(err)
      throw err
    }
    
  }
}