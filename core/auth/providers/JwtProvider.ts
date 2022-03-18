import { randomUUID } from 'crypto'
import { sign, verify } from 'jsonwebtoken'

import { LogProvider } from '@core/providers/LogProvider'
import { cryptoOptions } from '@core/crypto/CryptoOptions'
import { minToMs } from '@core/utils/Utils'

const NAME = 'JWT Provider'
const SECRET = randomUUID(cryptoOptions)
export const TIMESPAN = minToMs(15)

/*
  JWT provider, wrapping jsonwebtoken

  Performs basic signing and checking within range

  Will only work on systems where the key was generated
*/

export class JwtProvider {
  private log = new LogProvider(NAME)
  constructor(private secret = SECRET) {
    this.log.initFileLogger()
  }

  async sign(userId: string, timeSpan = TIMESPAN): Promise<string> {
    return await new Promise( (resolve, reject) => {
      try {
        this.log.getFileSystem().info('Signing JWT')
        const signedJwt = sign({ id: userId }, this.secret, { expiresIn: timeSpan })
        return resolve(signedJwt)
      } catch (err) {
        this.log.getFileSystem().error('Error signing JWT')
        return reject(err)
      }
    })
  }

  async verified(token: string): Promise<{ token: string, verified: boolean}> {
    return await new Promise( (resolve, reject) => {
      try {
        const decodedJwt = verify(token, this.secret, { complete: true })
        if (decodedJwt) {
          return resolve({ token, verified: true })
        }
      } catch (err) { return reject(err) }
    })
  }
}