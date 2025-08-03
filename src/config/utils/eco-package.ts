import { EcoChainIdsEnv, EcoProtocolAddresses } from '@eco-foundation/routes-ts';
import { zeroAddress } from 'viem';

import { ProverType } from '@/common/interfaces/prover.interface';
import { DeepPartial } from '@/common/types';
import { Config } from '@/config/config.schema';

export function getEcoNpmPackageConfig(config: DeepPartial<Config>): DeepPartial<Config> {
  return {
    evm: {
      networks: config.evm.networks.map((network) => {
        if (!network.chainId) return network;

        const chainId =
          config.env === 'preproduction' ? `${network.chainId}-pre` : network.chainId.toString();

        const addresses = EcoProtocolAddresses[chainId as EcoChainIdsEnv];
        if (!addresses) return network;

        const { Inbox, IntentSource, MetaProver, HyperProver } = addresses;

        const provers = { ...network.provers };

        if (HyperProver !== zeroAddress) provers[ProverType.HYPER] = HyperProver;
        if (MetaProver !== zeroAddress) provers[ProverType.METALAYER] = MetaProver;

        return {
          intentSourceAddress: IntentSource,
          inboxAddress: Inbox,
          provers,
          ...network,
        };
      }),
    },
  };
}
