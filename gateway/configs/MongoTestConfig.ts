import { IMongoCredentials } from '@core/models/dataAccess/IMongoose'

//  passwords in plain text, testing
export const mongoTextConfig: IMongoCredentials= {
  host: 'devdbprimary',
  port: 27017,
  user: 'devModelsUser',
  password: 'devModelsTestPass'
}

export const mongoDbs = {
  devModels: {
    name: 'devModels',
    collections: {
      User: 'user',
      QueryJob: 'queryJob',
      Token: 'token'
    }
  }
}