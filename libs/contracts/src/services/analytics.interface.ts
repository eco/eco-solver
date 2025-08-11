// Analytics service interface
export interface IAnalyticsService {
  track(event: string, properties?: Record<string, any>): Promise<void>;
  identify(userId: string, traits?: Record<string, any>): Promise<void>;
}