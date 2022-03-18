import { randomUUID } from 'crypto'

import { JwtProvider } from '@core/auth/providers/JwtProvider'
import { GatewayMongooseProvider } from '@gateway/providers/GatewayMongooseProvider'
import { IGatewayAddJobRequest } from '@gateway/models/IGatewayRequest'
import { LogProvider } from '@core/providers/LogProvider'
import { cryptoOptions } from '@core/crypto/CryptoOptions'
import { MQProvider } from '@core/providers/MQProvider'

import { secret } from '@core/auth/configs/Secret'

const NAME = 'Job Creation Provider'

export class JobCreationProvider {
  private log: LogProvider = new LogProvider(NAME)
  private jwt: JwtProvider = new JwtProvider(secret)
  constructor(private mongoDb: GatewayMongooseProvider, private jobmq: MQProvider) {}

  async add(request: IGatewayAddJobRequest): Promise<{ jobId: string }> {
    try {
      const connModels = this.mongoDb.asObject()
      
      const currUser = await connModels.MUser.findOne({ email: request.user.email })
      const currUserToken = await connModels.MToken.findOne({ userId: currUser.id })
      this.log.info(`Found User Token for ${currUserToken.userId}.`)

      if (currUserToken.token !== request.origToken) throw new Error('Supplied token is invalid')

      const { token, verified } = await this.jwt.verified(request.origToken)
      
      if (verified) {
        this.log.info('Token Verified, Creating Job.')
        const newJobId = randomUUID(cryptoOptions)

        const newJobModel = new connModels.MQueryJob({
          jobId: newJobId,
          payload: request,
          authJwt: token,
          organization: request.query.organization,
          dbType: request.query.dbType,
          lifeCycle: 'Not Started'
        })
        
        const newJob = await connModels.MQueryJob.create(newJobModel)
        this.log.success('Successfully Added New Job.')

        this.log.info('Pushing Job to Worker Machine.')
        await this.jobmq.pushDealer(newJobId)

        return { jobId: newJob.jobId }
      } else { throw new Error(`[${NAME}]: Could Not Verify Json Web Token.`) }
    } catch (err) {
      this.log.error(err)
      throw err
    }
  }
}