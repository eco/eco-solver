import { Injectable } from '@nestjs/common'
import { SharedService } from '@nest-migration-test/shared-lib'

@Injectable()
export class AppService {
  constructor(private readonly sharedService: SharedService) {}

  getData(): { message: string; sharedMessage: string; processedData: any } {
    const sharedMessage = this.sharedService.getMessage()
    const processedData = this.sharedService.processData({ source: 'API' })
    
    return { 
      message: 'Hello API',
      sharedMessage,
      processedData
    }
  }
}
