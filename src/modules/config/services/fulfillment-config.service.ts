import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { FulfillmentConfig, RouteFeeOverride } from '@/config/schemas';

@Injectable()
export class FulfillmentConfigService {
  constructor(private readonly configService: ConfigService) {}

  get defaultStrategy(): FulfillmentConfig['defaultStrategy'] {
    return this.configService.get<FulfillmentConfig['defaultStrategy']>(
      'fulfillment.defaultStrategy',
    )!;
  }

  get fulfillmentConfig(): FulfillmentConfig {
    return this.configService.get<FulfillmentConfig>('fulfillment')!;
  }

  get validations(): FulfillmentConfig['validations'] {
    return this.configService.get<FulfillmentConfig['validations']>('fulfillment.validations')!;
  }

  get deadlineDuration(): FulfillmentConfig['deadlineDuration'] | undefined {
    return this.configService.get<FulfillmentConfig['deadlineDuration']>(
      'fulfillment.deadlineDuration',
    );
  }

  get routeEnablementConfig(): FulfillmentConfig['validations']['routeEnablement'] | undefined {
    return this.configService.get<FulfillmentConfig['validations']['routeEnablement']>(
      'fulfillment.validations.routeEnablement',
    );
  }

  get routeFeeOverrides(): RouteFeeOverride[] | undefined {
    return this.configService.get<RouteFeeOverride[]>('fulfillment.routeFeeOverrides');
  }

  get defaultRouteLimit(): number | { min?: number; max?: number } | undefined {
    return this.configService.get<number | { min?: number; max?: number }>(
      'fulfillment.defaultRouteLimit',
    );
  }

  getStrategyRouteEnablementConfig(
    strategyName: string,
  ): FulfillmentConfig['validations']['routeEnablement'] | undefined {
    // Convert strategy name from constant format (e.g., 'standard') to config key format
    const strategyKey = strategyName.replace(/-/g, '');
    return this.configService.get<FulfillmentConfig['validations']['routeEnablement']>(
      `fulfillment.strategies.${strategyKey}.routeEnablement`,
    );
  }
}
