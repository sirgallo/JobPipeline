import '../modAlias'

import { InitLoadBalancerServer } from '@loadbalancer/initLoadBalancerServer'

import { serverConfiguration } from '../ServerConfigurations'

const server = new InitLoadBalancerServer(
  serverConfiguration.lb.name,
  serverConfiguration.lb.port,
  serverConfiguration.lb.version,
  serverConfiguration.lb.numOfCpus
)

try {
  server.startServer()
} catch (err) { console.log(err) }