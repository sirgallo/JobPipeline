import { 
  AccessControlLevel, 
  DBTypes, 
  LifeCycle 
} from '@db/models/Gateway'

export interface IGatewayLoginRequest {
  firstName: string
  lastName: string
  email: string
  password: string
  organization: string
  accessControlLevel: AccessControlLevel
}

export interface IGatewayRegisterRequest {
  email: string
  password: string
}

export interface IGatewayAddJobRequest {
  user: {
    email: string
    accessControlLevel: AccessControlLevel
  }
  query: {
    query: string
    organization: string
    dbType: DBTypes
    lifecycle: LifeCycle
  },
  origToken: string
}