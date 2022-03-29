import { randomUUID } from 'crypto'

import { 
  IUser,
  IToken
} from '@db/models/Gateway'
import { JwtProvider } from '@core/auth/providers/JwtProvider'
import { GatewayMongooseProvider } from '@gateway/providers/GatewayMongooseProvider'
import { IGatewayAddJobRequest } from '@gateway/models/IGatewayRequest'
import { LogProvider } from '@core/providers/LogProvider'
import { cryptoOptions } from '@core/crypto/CryptoOptions'
import { MQProvider } from '@core/providers/MQProvider'
import { AuthProvider } from '@gateway/providers/AuthProvider'

import { jwtSecret, refreshSecret } from '@core/auth/configs/Secret'

const NAME = 'Job Creation Provider'

export class JobCreationProvider {
  private log: LogProvider = new LogProvider(NAME)
  private jwt: JwtProvider = new JwtProvider(jwtSecret)
  constructor(private mongoDb: GatewayMongooseProvider, private jobmq: MQProvider) {}

  async add(request: IGatewayAddJobRequest): Promise<{ jobId: string }> {
    try {
      const connModels = this.mongoDb.asObject()
      
      const currUser: IUser = await connModels.MUser.findOne({ email: request.user.email })
      const currUserToken: IToken = await connModels.MToken.findOne({ userId: currUser.id })
      this.log.info(`Found User Token for ${currUserToken.userId}.`)

      if (currUserToken.token !== request.origToken) throw new Error('Supplied token is invalid.')
      if (! AuthProvider.withinExpiration(currUserToken.issueDate, currUserToken.expiresIn)) {
        const refreshToken = await this.jwt.verified(currUserToken.refreshToken, refreshSecret)
        if (refreshToken.verified && AuthProvider.withinExpiration(currUserToken.refreshIssueDate, currUserToken.refreshExpiresIn)) {
          this.log.info('Refresh Token verified and within expiration, updating web token.')
          const newJwt = await this.jwt.sign(currUserToken.userId)
          await connModels.MToken.findOneAndUpdate({
              userId: currUserToken.userId
            }, { 
              $set: { 
                token: newJwt,
                issueDate: new Date().toISOString()
              }
            })
          
          return await this.createNewJob(request, newJwt, connModels)
        } else throw new Error('Supplied token and refresh token not valid or within Expiration.')
      } else {
        const { token, verified } = await this.jwt.verified(request.origToken)
      
        if (verified) {
          this.log.info('Token Verified and Within Expiration, Creating Job.')
          
          return await this.createNewJob(request, token, connModels)
        } else throw new Error(`[${NAME}]: Could Not Verify Json Web Token.`)
      }
    } catch (err) {
      this.log.error(err)
      throw err
    }
  }

  private async createNewJob(request: IGatewayAddJobRequest, token: string, connModels): Promise<{ jobId: string }> {
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
    this.jobmq.pushClient(newJobId)

    return { jobId: newJob.jobId }
  }
}