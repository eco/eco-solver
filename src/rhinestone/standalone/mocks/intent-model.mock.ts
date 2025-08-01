import { Injectable } from '@nestjs/common'

@Injectable()
export class MockIntentModel {
  async findOne(query: any): Promise<any> {
    return null
  }

  async findById(id: string): Promise<any> {
    return null
  }

  async save(doc: any): Promise<any> {
    return doc
  }

  async updateOne(filter: any, update: any): Promise<any> {
    return { modifiedCount: 1 }
  }
}
