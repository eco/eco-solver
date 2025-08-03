import { Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';

import { Validation } from './validation.interface';

@Injectable()
export class RouteCallsValidation implements Validation {
  // TODO: Inject configuration service to get supported route calls
  private blockedTargets: Set<string> = new Set([
    // Add blocked target addresses here
  ]);

  async validate(intent: Intent): Promise<boolean> {
    // Validate route calls
    if (!intent.route.calls || intent.route.calls.length === 0) {
      // It's valid to have no calls (token-only transfer)
      return true;
    }

    for (const call of intent.route.calls) {
      // Validate call has required fields
      if (!call.target) {
        throw new Error('Route call must have a target address');
      }

      if (!call.data) {
        throw new Error('Route call must have data');
      }

      if (call.value === undefined || call.value === null) {
        throw new Error('Route call must have a value field');
      }

      // Check if target is blocked
      if (this.blockedTargets.has(call.target.toLowerCase())) {
        throw new Error(`Target address ${call.target} is blocked`);
      }

      // Validate target is not zero address
      if (call.target === '0x0000000000000000000000000000000000000000') {
        throw new Error('Cannot call zero address');
      }

      // TODO: Add more sophisticated validation:
      // 1. Decode call data to validate function signatures
      // 2. Check against whitelist of allowed functions
      // 3. Validate parameters are within acceptable ranges
    }

    return true;
  }
}
