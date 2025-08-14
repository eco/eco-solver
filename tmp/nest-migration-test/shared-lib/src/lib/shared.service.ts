import { Injectable } from '@nestjs/common';

@Injectable()
export class SharedService {
  getMessage(): string {
    return 'Hello from Shared Library!';
  }

  processData(data: any): any {
    return {
      processed: true,
      timestamp: new Date().toISOString(),
      originalData: data,
    };
  }
}