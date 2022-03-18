import '../modAlias'

import { InitWorkerServer } from '@worker/initWorkerServer'

import { serverConfiguration } from '../ServerConfigurations'

const server = new InitWorkerServer(
  serverConfiguration.worker.name,
  serverConfiguration.worker.port,
  serverConfiguration.worker.version,
  serverConfiguration.worker.numOfCpus
)

try {
  server.startServer()
} catch (err) { console.log(err) }