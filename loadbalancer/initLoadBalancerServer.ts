import { BaseServer } from '@baseServer/core/BaseServer'
import { LogProvider } from '@core/providers/LogProvider'

import { 
  gatewayMQConfig, 
  workerMQConfig 
} from '@loadbalancer/configs/LoadBalancerConfig'
import { LoadBalanceProvider } from '@core/providers/LoadBalanceProvider'

export class InitLoadBalancerServer extends BaseServer {
  private workerLog: LogProvider = new LogProvider(this.name)
  private jobMQ: LoadBalanceProvider
  private mqIp: string
  
  async startServer() {
    try {
      this.mqIp = BaseServer.setIp(this.workerLog)
      this.jobMQ = new LoadBalanceProvider(gatewayMQConfig.port, workerMQConfig.port)

      this.jobMQ.start()
      this.workerLog.success(`Started Load Balancer on ${this.mqIp}`)
      
      this.run()
    } catch (err) {
      this.workerLog.error(err)
      throw err
    }
  }
}