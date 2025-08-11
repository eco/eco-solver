import { Global, Module, DynamicModule, Provider, FactoryProvider } from '@nestjs/common'
import { AnalyticsService, AnalyticsConfig } from './analytics.interface'
import { PosthogService } from './posthog.service'
import { EcoAnalyticsService } from './eco-analytics.service'

