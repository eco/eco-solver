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

    return new TronWeb({
      fullNode: rpc.fullNode,
      solidityNode: rpc.solidityNode || rpc.fullNode,
      eventServer: rpc.eventServer || rpc.fullNode,
      headers: rpc.apiKey ? { 'TRON-PRO-API-KEY': rpc.apiKey } : undefined,
      ...(privateKey && { privateKey }),
    });
  }
}
