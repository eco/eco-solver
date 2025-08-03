import { Intent as IntentInterface } from '@/common/interfaces/intent.interface';
import { Intent as IntentSchema } from '@/modules/intents/schemas/intent.schema';

export class IntentConverter {
  static toSchema(intent: IntentInterface): Partial<IntentSchema> {
    return {
      intentId: intent.intentId,
      reward: {
        prover: intent.reward.prover,
        creator: intent.reward.creator,
        deadline: intent.reward.deadline.toString(),
        nativeValue: intent.reward.nativeValue.toString(),
        tokens: intent.reward.tokens.map((token) => ({
          amount: token.amount.toString(),
          token: token.token,
        })),
      },
      route: {
        source: intent.route.source.toString(),
        destination: intent.route.destination.toString(),
        salt: intent.route.salt,
        inbox: intent.route.inbox,
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
      intentId: schema.intentId,
      reward: {
        prover: schema.reward.prover as `0x${string}`,
        creator: schema.reward.creator as `0x${string}`,
        deadline: BigInt(schema.reward.deadline),
        nativeValue: BigInt(schema.reward.nativeValue),
        tokens: schema.reward.tokens.map((token) => ({
          amount: BigInt(token.amount),
          token: token.token as `0x${string}`,
        })),
      },
      route: {
        source: BigInt(schema.route.source),
        destination: BigInt(schema.route.destination),
        salt: schema.route.salt as `0x${string}`,
        inbox: schema.route.inbox as `0x${string}`,
        calls: schema.route.calls.map((call) => ({
          data: call.data as `0x${string}`,
          target: call.target as `0x${string}`,
          value: BigInt(call.value),
        })),
        tokens: schema.route.tokens.map((token) => ({
          amount: BigInt(token.amount),
          token: token.token as `0x${string}`,
        })),
      },
      status: schema.status,
    };
  }
}