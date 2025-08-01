import { Injectable } from '@nestjs/common'

@Injectable()
export class MockEcoAnalyticsService {
  trackIntentValidationStarted(intentHash: string) {}

  trackIntentValidationFailed(intentHash: string, reason: string, stage: string, metadata?: any) {}

  trackIntentValidatedAndQueued(intentHash: string, jobId: string, model: any) {}

  trackSuccess(event: string, metadata?: any) {}

  trackError(event: string, error: Error, metadata?: any) {}

  trackEvent(event: string, metadata?: any) {}
}
