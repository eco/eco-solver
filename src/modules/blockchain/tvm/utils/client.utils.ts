import { TronWeb } from 'tronweb';

import { TvmNetworkConfig } from '@/config/schemas';

/**
 * Utility class for creating and managing TronWeb client instances
 */
export class TvmClientUtils {
  /**
   * Creates a TronWeb client instance from chain configuration
   * @param chainConfig - Chain configuration containing RPC endpoints
   * @param privateKey - Optional private key for signing transactions
   * @returns Configured TronWeb instance
   */
  static createClient(chainConfig: TvmNetworkConfig, privateKey?: string): TronWeb {
    const { rpc } = chainConfig;

    const config = {
      fullNode: rpc.fullNode,
      solidityNode: rpc.solidityNode || rpc.fullNode,
      eventServer: rpc.eventServer || rpc.fullNode,
      ...(privateKey && { privateKey }),
    };

    return new TronWeb(config);
  }

  /**
   * Creates a TronWeb client instance with minimal configuration
   * @param fullNode - Full node URL
   * @param solidityNode - Solidity node URL (optional, defaults to fullNode)
   * @param eventServer - Event server URL (optional, defaults to fullNode)
   * @param privateKey - Private key for signing (optional)
   * @returns Configured TronWeb instance
   */
  static createClientWithUrls(
    fullNode: string,
    solidityNode?: string,
    eventServer?: string,
    privateKey?: string,
  ): TronWeb {
    const config = {
      fullNode,
      solidityNode: solidityNode || fullNode,
      eventServer: eventServer || fullNode,
      ...(privateKey && { privateKey }),
    };

    return new TronWeb(config);
  }
}
