import { randomUUID, randomBytes } from 'crypto'
import { promisify } from 'util'

import { EncryptProvider } from '@core/auth/providers/EncryptProvider'
import { JwtProvider, TIMESPAN } from '@core/auth/providers/JwtProvider'
import { cryptoOptions } from '@core/crypto/CryptoOptions'
import { GatewayMongooseProvider } from '@gateway/providers/GatewayMongooseProvider'
import { IToken, IUser } from '@db/models/Gateway'
import { LogProvider } from '@core/providers/LogProvider'
import { secret } from '@core/auth/configs/Secret'

const NAME = 'Auth Provider'
const asyncRandomBytes = promisify(randomBytes)
const randomBytesEncoding = 'hex'
const refreshTokenLength = 64

export class AuthProvider {
  name = NAME
  private log: LogProvider = new LogProvider(NAME)
  private crypt: EncryptProvider = new EncryptProvider()
  private jwt: JwtProvider = new JwtProvider(secret)
  constructor(private mongoDb: GatewayMongooseProvider) {}

  async authenticate(user: Partial<IUser>) {
    try {
      const connModels = this.mongoDb.asObject()

      const currUserEntry = await connModels.MUser.findOne({ email: user.email })
      this.log.info(`Got User with Id: ${currUserEntry.id}`)

      if (await this.crypt.compare(user.password, currUserEntry.password)) {
        const jwToken = await this.jwt.sign(currUserEntry.id)
        const refreshToken = await this.generateRefreshToken()

        console.log(refreshToken)
        const tokenEntry: IToken = await connModels.MToken.findOne({ userId: currUserEntry.id})
        
        if (! tokenEntry) {
          const newAccessToken = new connModels.MToken({
            userId: currUserEntry.id,
            token: jwToken,
            refreshToken: refreshToken,
            issueDate: new Date().toISOString(),
            expiresIn: TIMESPAN
          })

          const resp = await connModels.MToken.create(newAccessToken)
          this.log.success(`New Token added with User Id: ${resp.userId}`)
        } else if (tokenEntry) {
          const { token, verified } = await this.jwt.verified(tokenEntry.token)
          
          const isWithinExpiration = this.outsideExpiration(tokenEntry)
          this.log.info(`JWT within expiration: ${isWithinExpiration}`)

          if (verified && isWithinExpiration) {
            this.log.info('JWT already exists that is valid')
            
            await connModels.MToken.findOneAndUpdate({
                userId: currUserEntry.id 
              }, {
                $set: { refreshToken: refreshToken }
              })

            this.log.info('Refresh Token Successfully updated')

            return { status: 'User Login Success', token: token }
          } else {
            await connModels.MToken.findOneAndUpdate({
                userId: currUserEntry.id 
              }, { 
                $set: {
                  token: jwToken,
                  refreshToken: refreshToken,
                  issueDate: new Date().toISOString()
                }
              })
          }

          this.log.success(`Token updated with User Id: ${currUserEntry.id}`)
        } else { return new Error('Unknown error trying to find MToken entry.') }
        
        return { status: 'User Login Success', token: jwToken }
      } else { return new Error('Passwords do not match.') }
    } catch (err) {
      this.log.getFileSystem().error(err)
      throw err
    }
  }

  async register(newUser: Partial<IUser>): Promise<string> {
    try {
      const connModels = this.mongoDb.asObject()

      const hashPassword = await this.crypt.encrypt(newUser.password)
      this.log.info('Encrypted Password')
      
      newUser.password = hashPassword
      newUser.id = randomUUID(cryptoOptions)

      const newUserEntry = new connModels.MUser({ ...newUser })
      const newUserResp = await connModels.MUser.create(newUserEntry)
      this.log.success(`New User added with User Id: ${newUserResp.id}`)

      const jwToken = await this.jwt.sign(newUserEntry.id)
      const refreshToken = await this.generateRefreshToken()

      const newAccessToken = new connModels.MToken({
        userId: newUserResp.id,
        token: jwToken,
        refreshToken: refreshToken,
        issueDate: new Date().toISOString(),
        expiresIn: TIMESPAN
      })

      const resp = await connModels.MToken.create(newAccessToken)
      this.log.success(`New Token added with User Id: ${resp.userId}`)

      return jwToken
    } catch (err) {
      this.log.error(err)
      throw err
    }
  }

  async generateRefreshToken(): Promise<string> {
    const refreshTokenBuffer: Buffer = await asyncRandomBytes(refreshTokenLength)
    return refreshTokenBuffer.toString(randomBytesEncoding)
  }

  outsideExpiration(tokenEntry: IToken): boolean {
    const now = new Date()
    const tokenExpiration = tokenEntry.issueDate.getMilliseconds() + parseInt(tokenEntry.expiresIn)
    if (now.getMilliseconds() > tokenExpiration) return false
    else return true
  }
}