import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';

import { Intent } from '@/common/interfaces/intent.interface';
import { FulfillmentConfigService } from '@/modules/config/services/fulfillment-config.service';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { Validation } from './validation.interface';

@Injectable()
export class CrowdLiquidityFeeValidation implements Validation {
  constructor(
    private readonly fulfillmentConfigService: FulfillmentConfigService,
    private readonly otelService: OpenTelemetryService,
  ) {}

  async validate(_intent: Intent, _context: ValidationContext): Promise<boolean> {
    return this.otelService.tracer.startActiveSpan(
      'validation.CrowdLiquidityFeeValidation',
      {
        attributes: {
          'validation.name': 'CrowdLiquidityFeeValidation',
          'intent.hash': _intent.intentHash,
          'intent.destination_chain': _intent.destination?.toString(),
        },
      },
      (span: api.Span) => {
        try {
          // Calculate total value from tokens and native value in calls
          // const totalValue = this.fulfillmentConfigService.sum(
          //   intent.destination,
          //   intent.route.tokens,
          // );
          //
          // // Crowd liquidity uses different fee structure
          // // Calculate required fee: clBaseFee + (totalValue * clBpsFee / 10000)
          // const clFeeConfig = this.fulfillmentConfigService.getNetworkFee(intent.destination);
          // const clBaseFee = clFeeConfig?.baseFee ?? BigInt(500000);
          // const clBpsFee = clFeeConfig?.bpsFee ?? BigInt(50);
          //
          // const percentageFee = (totalValue * clBpsFee) / BigInt(10000);
          // const totalRequiredFee = clBaseFee + percentageFee;
          //
          // if (reward < totalRequiredFee) {
          //   throw new Error(
          //     `Reward ${reward} is less than required CL fee ${totalRequiredFee} (base: ${clBaseFee}, percentage: ${percentageFee})`,
          //   );
          // }

          // TODO: Get fee from pool contract
          span.setAttribute('fee.validation.todo', 'Get fee from pool contract');

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
}
