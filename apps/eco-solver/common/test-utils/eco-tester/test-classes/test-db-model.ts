import * as mongoose from 'mongoose'

export class TestDBModel {
  name: string
}

export const testMongooseSchema = new mongoose.Schema({
  name: String,
})
