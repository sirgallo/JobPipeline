import { IGenericJob } from '@core/models/IJob'
import { IInternalLivelinessResponse } from '@core/models/IMq'
import { LogProvider } from '@core/providers/LogProvider'
import { IQueryJob } from '@db/models/Gateway'
import { GatewayMongooseProvider } from '@gateway/providers/GatewayMongooseProvider'

const NAME = 'Update Job Provider'

export class UpdateJobProvider implements IGenericJob {
  private log = new LogProvider(NAME)
  constructor(private gatewayMongoDb: GatewayMongooseProvider) {}

  async execute(argument: any): Promise<any> {
    try {
      return await this.updateJobOnResp(argument as IInternalLivelinessResponse)
    } catch (err) { throw err }
  }

  async updateJobOnResp(job: IInternalLivelinessResponse): Promise<any> {
    try {
      const connModels = this.gatewayMongoDb.asObject()
      const updatedQueryJob: IQueryJob = await connModels.MQueryJob.findOneAndUpdate({
          jobId: job.job
        }, {
          $set: { lifeCycle: job.lifeCycle }
        })
      
      this.log.info(`Updated Job ${updatedQueryJob.jobId} to lifecycle --> ${job.lifeCycle}`)

      return true
    } catch (err) { throw err }
  }
}