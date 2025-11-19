import { Hex } from 'viem';

import { Intent as IntentInterface } from '@/common/interfaces/intent.interface';
import { Intent as IntentSchema } from '@/modules/intents/schemas/intent.schema';

export class IntentConverter {
  static toSchema(intent: IntentInterface): Partial<IntentSchema> {
    return {
      intentHash: intent.intentHash,
      reward: {
        prover: intent.reward.prover,
        creator: intent.reward.creator,
        deadline: intent.reward.deadline.toString(),
        nativeAmount: intent.reward.nativeAmount.toString(),
        tokens: intent.reward.tokens.map((token) => ({
          amount: token.amount.toString(),
          token: token.token,
        })),
      },
      route: {
        source: intent.sourceChainId?.toString(),
        destination: intent.destination.toString(),
        salt: intent.route.salt,
        portal: intent.route.portal,
        deadline: intent.route.deadline.toString(),
        nativeAmount: intent.route.nativeAmount.toString(),
        calls: intent.route.calls.map((call) => ({
          data: call.data,
          target: call.target,
          value: call.value.toString(),
        })),
        tokens: intent.route.tokens.map((token) => ({
          amount: token.amount.toString(),
          token: token.token,
        })),
      },
      status: intent.status,
    };
  }

  static toInterface(schema: IntentSchema): IntentInterface {
    return {
      intentHash: schema.intentHash as Hex,
      publishTxHash: schema.publishTxHash,
      reward: {
        prover: schema.reward.prover,
        creator: schema.reward.creator,
        deadline: BigInt(schema.reward.deadline),
        nativeAmount: BigInt(schema.reward.nativeAmount),
        tokens: schema.reward.tokens.map((token) => ({
          amount: BigInt(token.amount),
          token: token.token,
        })),
      },
      route: {
        salt: schema.route.salt as `0x${string}`,
        deadline: BigInt(schema.route.deadline),
        portal: schema.route.portal,
        nativeAmount: BigInt(schema.route.nativeAmount),
        calls: schema.route.calls.map((call) => ({
          data: call.data as `0x${string}`,
          target: call.target,
          value: BigInt(call.value),
        })),
        tokens: schema.route.tokens.map((token) => ({
          amount: BigInt(token.amount),
          token: token.token,
        })),
      },
      destination: BigInt(schema.route.destination),
      sourceChainId: BigInt(schema.route.source),
      status: schema.status,
    };
  }
}
