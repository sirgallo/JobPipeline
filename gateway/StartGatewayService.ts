import '../modAlias'

import { serverConfiguration } from '../ServerConfigurations'
import { InitGatewayServer } from '@gateway/InitGatewayServer'

const server = new InitGatewayServer(
  serverConfiguration.gateway.name,
  serverConfiguration.gateway.port,
  serverConfiguration.gateway.version,
  serverConfiguration.gateway.numOfCpus
)

try {
  server.startServer()
} catch (err) { console.log(err) }