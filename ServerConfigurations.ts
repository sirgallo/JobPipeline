import { 
  ServerConfiguration,
  IServerConfiguration
} from '@core/baseServer/core/models/ServerConfiguration'

export const serverConfiguration: ServerConfiguration<Record<string, IServerConfiguration>> = {
  gateway: {
    port: 5680,
    name: 'Gateway API',
    numOfCpus: 1,
    version: '0.1'
  },
  worker: {
    port: 5679,
    name: 'Worker API',
    numOfCpus: 3,
    version: '0.1'
  },
  lb: {
    port: 5678,
    name: 'Load Balancer',
    numOfCpus: 1,
    version: '0.1'
  },
}