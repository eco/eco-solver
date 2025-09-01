import { decodeEventLog, WatchContractEventOnLogsParameter } from 'viem';

import { PortalAbi } from '@/common/abis/portal.abi';
import { Intent } from '@/common/interfaces/intent.interface';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainType, ChainTypeDetector } from '@/common/utils/chain-type-detector';
import { PortalEncoder } from '@/common/utils/portal-encoder';

type IntentPublishLog = WatchContractEventOnLogsParameter<
  typeof PortalAbi,
  'IntentPublished',
  true
>[number];

export function parseIntentPublish(sourceChainId: bigint, rawLog: any): Intent {
  const log = decodeEventLog({
    abi: PortalAbi,
    eventName: 'IntentPublished',
    topics: rawLog.topics,
    data: rawLog.data,
    strict: true,
  }) as IntentPublishLog;

  // Decode route based on destination chain type - already returns an Intent format
  const destChainType = ChainTypeDetector.detect(log.args.destination);
  const route = PortalEncoder.decodeFromChain(log.args.route, destChainType, 'route');

  // Normalize all addresses to UniversalAddress format
  return {
    intentHash: log.args.intentHash,
    destination: log.args.destination,
    sourceChainId,
    route, // Already in Intent format with UniversalAddress from PortalEncoder
    reward: {
      deadline: log.args.rewardDeadline,
      creator: AddressNormalizer.normalize(log.args.creator, ChainType.EVM),
      prover: AddressNormalizer.normalize(log.args.prover, ChainType.EVM),
      nativeAmount: log.args.rewardNativeAmount,
      tokens: log.args.rewardTokens.map((token) => ({
        amount: token.amount,
        token: AddressNormalizer.normalize(token.token, ChainType.EVM),
      })),
    },
  };
}
