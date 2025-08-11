/* eslint-disable prettier/prettier */
import mongoose from 'mongoose'
import crypto from 'crypto'

export class DBTestUtils {
  private connection: mongoose.Connection

  getRandomString(len: number): string {
    return crypto.randomBytes(len / 2).toString('hex')
  }

  async dbOpen(): Promise<mongoose.Connection> {
    const connectOptions = { autoCreate: false, autoIndex: false } as mongoose.ConnectOptions

    // Use a random database name to avoid conflicts
    const dbName = this.getRandomString(20)
    const dbUri = `${process.env.MONGO_URL}${dbName}`

    this.connection = mongoose.createConnection(dbUri, connectOptions)
    return this.connection
  }

  async dbClose(): Promise<any> {
    if (this.connection) {
      await this.connection.close()
    }
  }
}
