import { JwtProvider } from '@core/auth/providers/JwtProvider'
import { GatewayMongooseProvider } from '@gateway/providers/GatewayMongooseProvider'
import { IQueryJob } from '@db/models/Gateway'
import { LogProvider } from '@core/providers/LogProvider'
import { MQProvider } from '@core/providers/MQProvider'

import { secret } from '@core/auth/configs/Secret'

const NAME = 'Pull Job Provider'

export class PullJobProvider {
  private log: LogProvider = new LogProvider(NAME)
  private jwt: JwtProvider = new JwtProvider(secret)
  constructor(private mongoDb: GatewayMongooseProvider, private jobmq: MQProvider) {}

  async validateJwt(unVerifiedJob: IQueryJob) {
    try {
      const { token, verified } = await this.jwt.verified(unVerifiedJob.authJwt)
      if (! verified ) throw new Error('Token not verified')
      else return { token, verified }
    } catch (err) { throw err }
  }

  async execute(job: IQueryJob, verified?: boolean) {
    try {
      if (verified) {
        const connModels = this.mongoDb.asObject()
        
        const currQuery = await connModels.MQueryJob.findOneAndUpdate({ 
            jobId: job.jobId 
          }, { 
            $set: { lifeCycle: job.lifeCycle }
          })
        this.log.success(`Updated current query to ${currQuery.upsertedId }`)
        
        return { jobId: job.jobId, lifeCycle: job.lifeCycle }
      } else { throw new Error(`[${NAME}]: Could Not Verify Json Web Token.`) }
    } catch (err) { throw err }
  }
}