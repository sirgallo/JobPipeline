import { IQueryJob } from '@db/models/Gateway'
import { GatewayMongooseProvider } from '@gateway/providers/GatewayMongooseProvider'
import { MariaDBProvider } from '@core/providers/dataAccess/MariaDbProvider'
import { IGenericJob } from '@core/models/IJob'

export class QueryProvider implements IGenericJob {
  constructor(private gatewayMongoDb: GatewayMongooseProvider) {}

  async execute(argument: any): Promise<any> {
    try {
      return await this.determineDb(argument as string)
    } catch (err) { throw err }
  }

  async determineDb(job: string): Promise<any> {
    try {
      //only need query model
      const connModels = this.gatewayMongoDb.asObject().MQueryJob

      const queryJob: IQueryJob = await connModels.findOne({ jobId: job })

      //  working
      if (queryJob.dbType === 'MariaDb') {
        const mariaDbClient = new MariaDBProvider(
          queryJob.payload.auth.host,
          queryJob.payload.auth.port,
          queryJob.payload.auth.user,
          queryJob.payload.auth.database,
          queryJob.payload.auth.password
        )
        await mariaDbClient.getConn()
        const result = mariaDbClient.execute(queryJob.payload.query.query, 'query')
        console.log(JSON.stringify(result, null, 2))
        
        await mariaDbClient.execute(null, 'close')

        return true
      } else if (queryJob.dbType === 'Athena') {
        // stub

        return true
      }
    } catch (err) { throw err }
  }
}