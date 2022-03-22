import { IMqOpts } from '@core/models/IMq'

export const gatewayMQConfig: Partial<IMqOpts> = {
  port: '8765'
}

export const workerMQConfig: Partial<IMqOpts> = {
  port: '8766'
}