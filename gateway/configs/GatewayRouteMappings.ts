import { ROUTE, STATUSOK, INFO } from '@core/models/ILog'
import { IBaseRoute } from '@core/baseServer/core/models/IRouteMappings'

export const gatewayRouteMappings: Record<string, IBaseRoute>= {
  gateway: {
    name: '/gateway',
    subRouteMapping: {
      register: {
        name: '/register',
        customConsoleMessages: [
          {
            1: { 
              text: '/register', 
              color: ROUTE 
            },
            2: { 
              text: '200', 
              color: STATUSOK 
            },
            3: { 
              text: 'register user succcess...', 
              color: INFO 
            }
          }
        ]
      },
      login: {
        name: '/login',
        customConsoleMessages: [
          {
            1: { 
              text: '/login', 
              color: ROUTE 
            },
            2: { 
              text: '200', 
              color: STATUSOK 
            },
            3: { 
              text: 'login succcess...', 
              color: INFO 
            }
          }
        ]
      },
      addJob: {
        name: '/addjob',
        customConsoleMessages: [
          {
            1: { 
              text: '/addjob', 
              color: ROUTE 
            },
            2: { 
              text: '200', 
              color: STATUSOK 
            },
            3: { 
              text: 'job added succcessfully...', 
              color: INFO 
            }
          }
        ]
      }
    }
  }
}