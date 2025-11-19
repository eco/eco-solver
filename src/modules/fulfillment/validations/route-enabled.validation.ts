import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';

import { Intent } from '@/common/interfaces/intent.interface';
import { ChainType, ChainTypeDetector } from '@/common/utils/chain-type-detector';
import { FulfillmentConfigService } from '@/modules/config/services/fulfillment-config.service';
import { ValidationErrorType } from '@/modules/fulfillment/enums/validation-error-type.enum';
import { ValidationError } from '@/modules/fulfillment/errors/validation.error';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { Validation } from './validation.interface';

/**
 * RouteEnabledValidation - Validates if a route between source and destination chains is enabled
 *
 * This validation checks if a specific route (source chain -> destination chain) is allowed based on
 * configuration. The configuration supports two modes:
 *
 * 1. **Whitelist Mode**: Only routes explicitly listed in the configuration are allowed.
 *    All other routes are blocked.
 *
 * 2. **Blacklist Mode**: All routes are allowed except those explicitly listed in the configuration.
 *    Only the routes in the list are blocked.
 *
 * ## Route Format
 * Routes can be specified in multiple formats:
 * - **Chain type to chain type**: 'evm:evm', 'evm:svm', 'svm:tvm'
 * - **Specific chain ID to chain type**: '10:svm', '1:evm'
 * - **Chain type to specific chain ID**: 'evm:10', 'svm:1399811149'
 * - **Specific chain IDs**: '10:8453' (Optimism to Base), '1:10' (Ethereum to Optimism)
 *
 * ## Bi-directional Requirement
 * Routes are unidirectional and must be explicitly defined for both directions if needed.
 * For example, 'evm:svm' allows EVM to SVM transfers but does NOT allow SVM to EVM.
 * To allow both directions, both 'evm:svm' and 'svm:evm' must be configured.
 *
 * ## Configuration Hierarchy
 * 1. Strategy-specific configuration (if exists) takes precedence
 * 2. Falls back to global validation configuration
 * 3. If no configuration exists, all routes are enabled by default
 *
 * ## Examples
 * - Whitelist ['evm:evm', '10:8453']: Only allows EVM to EVM transfers and Optimism to Base
 * - Blacklist ['svm:evm']: Allows all routes except Solana to EVM chains
 */
@Injectable()
export class RouteEnabledValidation implements Validation {
  constructor(
    private readonly configService: FulfillmentConfigService,
    private readonly otelService: OpenTelemetryService,
  ) {}

  async validate(intent: Intent, context: ValidationContext): Promise<boolean> {
    return this.otelService.tracer.startActiveSpan(
      'validation.RouteEnabledValidation',
      {
        attributes: {
          'validation.name': 'RouteEnabledValidation',
          'intent.hash': intent.intentHash,
          'intent.source_chain': intent.sourceChainId?.toString(),
          'intent.destination_chain': intent.destination?.toString(),
        },
      },
      (span: api.Span) => {
        try {
          // Get configuration - strategy-specific takes precedence
          const strategyName = context.getStrategyName();
          const config =
            this.configService.getStrategyRouteEnablementConfig(strategyName) ||
            this.configService.routeEnablementConfig;

          // If no configuration, all routes are enabled
          if (!config) {
            span.setAttribute('route.config.exists', false);
            span.setAttribute('route.enabled', true);
            span.setStatus({ code: api.SpanStatusCode.OK });
            return true;
          }

          span.setAttribute('route.config.mode', config.mode);
          span.setAttribute('route.config.strategy', strategyName);

          // Validate source and destination chains exist
          if (!intent.sourceChainId) {
            throw new ValidationError(
              'Intent must have source chain ID',
              ValidationErrorType.PERMANENT,
              'RouteEnabledValidation',
            );
          }

          if (!intent.destination) {
            throw new ValidationError(
              'Intent must have destination chain ID',
              ValidationErrorType.PERMANENT,
              'RouteEnabledValidation',
            );
          }

          // Get chain types
          const sourceChainType = ChainTypeDetector.detect(intent.sourceChainId);
          const destChainType = ChainTypeDetector.detect(intent.destination);

          span.setAttribute('route.source.type', sourceChainType);
          span.setAttribute('route.destination.type', destChainType);

          // Check if route matches any configured route
          const routeMatches = this.isRouteMatch(
            intent.sourceChainId,
            intent.destination,
            sourceChainType,
            destChainType,
            config.routes,
          );

          span.setAttribute('route.matches', routeMatches);

          // Determine if route is enabled based on policy mode
          const isWhitelistMode = config.mode === 'whitelist';

          // Apply whitelist/blacklist logic
          const isEnabled = isWhitelistMode
            ? routeMatches // only allow if explicitly listed
            : !routeMatches; // only allow if not explicitly blocked

          span.setAttribute('route.enabled', isEnabled);

          if (!isEnabled) {
            const reason = isWhitelistMode ? 'is not in whitelist' : 'is blacklisted';
            const errorMessage = `Route ${intent.sourceChainId}:${intent.destination} ${reason}`;

            throw new ValidationError(
              errorMessage,
              ValidationErrorType.PERMANENT,
              'RouteEnabledValidation',
            );
          }

          span.setStatus({ code: api.SpanStatusCode.OK });
          return true;
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  /**
   * Check if the route matches any of the configured route patterns
   */
  private isRouteMatch(
    sourceChainId: bigint,
    destChainId: bigint,
    sourceChainType: ChainType,
    destChainType: ChainType,
    routes: string[],
  ): boolean {
    const sourceIdStr = sourceChainId.toString();
    const destIdStr = destChainId.toString();

    for (const route of routes) {
      const [source, dest] = route.split(':');

      if (!source || !dest) {
        // Invalid route format, skip
        continue;
      }

      // Check if source matches
      const sourceMatches =
        source === sourceIdStr || // Exact chain ID match
        source === sourceChainType; // Chain type match

      // Check if destination matches
      const destMatches =
        dest === destIdStr || // Exact chain ID match
        dest === destChainType; // Chain type match

      if (sourceMatches && destMatches) {
        return true;
      }
    }

    return false;
  }
}
