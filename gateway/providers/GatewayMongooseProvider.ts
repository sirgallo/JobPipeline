import { Connection, Model } from 'mongoose'

import { MongooseProvider } from '@core/providers/dataAccess/MongooseProvider'
import { 
  IUser, IQueryJob, IToken,
  UserSchema, QueryJobSchema, TokenSchema
} from '@db/models/Gateway'

import { mongoDbs } from '@gateway/configs/MongoTestConfig'

export class GatewayMongooseProvider extends MongooseProvider {
  MUser: Model<IUser, any, any, any>
  MQueryJob : Model<IQueryJob, any, any, any>
  MToken: Model<IToken, any, any, any>
  
  initDefaultModels() {
    this.MUser = this.addModel<IUser>(this.conn, mongoDbs.devModels.collections.User, UserSchema)
    this.MQueryJob = this.addModel<IQueryJob>(this.conn, mongoDbs.devModels.collections.QueryJob, QueryJobSchema)
    this.MToken = this.addModel<IToken>(this.conn, mongoDbs.devModels.collections.Token, TokenSchema)
  }

  asObject() {
    return {
      MUser: this.MUser,
      MQueryJob: this.MQueryJob,
      MToken: this.MToken
    }
  }

  singleConnection(conn: Connection) {
    return {
      MUser: this.addModel<IUser>(conn, mongoDbs.devModels.collections.User, UserSchema),
      MQueryJob: this.addModel<IQueryJob>(conn, mongoDbs.devModels.collections.QueryJob, QueryJobSchema),
      MToken: this.addModel<IToken>(conn, mongoDbs.devModels.collections.Token, TokenSchema)
    }
  }
}