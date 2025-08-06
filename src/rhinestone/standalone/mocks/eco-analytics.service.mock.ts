import { Injectable } from '@nestjs/common'

@Injectable()
export class MockEcoAnalyticsService {
  trackIntentValidationStarted(_intentHash: string) {}

  trackIntentValidationFailed(_intentHash: string, _reason: string, _stage: string, _metadata?: any) {}

  trackIntentValidatedAndQueued(_intentHash: string, _jobId: string, _model: any) {}

  trackIntentFeasibilityCheckStarted(_intentHash: string) {}

  trackIntentFeasibleAndQueued(_intentHash: string, _jobId: string, _model: any) {}

  trackIntentInfeasible(_intentHash: string, _model: any, _error: any) {}

  trackSuccess(_event: string, _metadata?: any) {}

  trackError(_event: string, _error: Error, _metadata?: any) {}

  trackEvent(_event: string, _metadata?: any) {}
}
