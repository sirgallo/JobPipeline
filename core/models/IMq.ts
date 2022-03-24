export interface IMqOpts {
  domain: string
  port: string
  topic: string
}

export interface IInternalJobQueueMessage {
  jobId: string
  header: string
  body: ISockRequest
}

export interface ISockRequest {
  message: any
}

export interface IInternalLivelinessResponse {
  alive: boolean
  node: string
  job: string
  message: any
  lifeCycle?: LifeCycle
}

export interface IAvailableMachine {
  status: MachineStatus
  validated: Date
  heartbeat: (machineId: string, machineType: MachineTypes) => Promise<void>
  connAttempts: number
}

export type MachineTypes = 'Client' | 'Worker'

export type MachineStatus = 'Ready' | 'Busy'

export type LifeCycle = 'Not Started' | 'In Queue' | 'In Progress' | 'Finished' | 'Failed'