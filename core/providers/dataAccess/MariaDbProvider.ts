import { 
  createConnection, 
  Connection, 
  FieldPacket,
  RowDataPacket, 
  OkPacket, 
  ResultSetHeader 
} from 'mysql2/promise'

import { LogProvider } from '@core/providers/LogProvider'

type MariaDbOperationTypes = 'query' | 'insert' | 'delete' | 'close'
type rowPacketOpts = RowDataPacket[] | RowDataPacket[][] | OkPacket | OkPacket[] | ResultSetHeader
interface IQueryReturnObj {
  rows: rowPacketOpts
  fields: FieldPacket[]
}

export class MariaDBProvider {
  private conn: Connection
  private log = new LogProvider('MariaDb Provider')
  constructor(private host: string, private port: number, private user: string, private database, private password?: string) {
    this.log.initFileLogger()
  }

  async getConn() {
    this.conn = await createConnection({
      host: this.host,
      port: this.port,
      user: this.user,
      database: this.database,
      ...(this.password ? { password: this.password } : {})
    })
  }
    
  async execute(sql: string, type: MariaDbOperationTypes, args?: (string | number)[]): Promise<IQueryReturnObj> {
    try {
      if (type === 'close') await this.conn.end()
      else if (type === 'query') { 
        const [ rows, fields ] = await this.conn.execute(sql, args) 
        this.log.getFileSystem().success('Query Success')
        this.log.getFileSystem().logTable(rows, fields.map(field => field.name))
        return { rows, fields }
      } else {
        await this.conn.execute(sql)
        this.log.getFileSystem().success(`Query of type ${type} success`)
      }
    } catch (err) {
      this.log.getFileSystem().error({ err })
      throw err
    }
  }
}