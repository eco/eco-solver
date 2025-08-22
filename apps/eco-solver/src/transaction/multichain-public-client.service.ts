import { Injectable } from '@nestjs/common'
import { createPublicClient, PublicClient, PublicClientConfig } from 'viem'
import { ViemMultichainClientService } from './viem_multichain_client.service'

@Injectable()
export class MultichainPublicClientService extends ViemMultichainClientService<
  any,
  PublicClientConfig
> {
  protected override async createInstanceClient(
    configs: PublicClientConfig,
  ): Promise<any> {
    return createPublicClient(configs as any)
  }
}
