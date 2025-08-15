import { Injectable } from '@nestjs/common'
import { EcoConfigService } from '@eco/infrastructure-config'
import { NonceService } from './nonce.service'
import { privateKeyAndNonceToAccountSigner } from './sign.helper'
import { SignerService } from './signer.service'
import { Hex, PrivateKeyAccount } from 'viem'

@Injectable()
export class AtomicSignerService extends SignerService {
  constructor(
    readonly nonceService: NonceService,
    readonly ecoConfigService: EcoConfigService,
  ) {
    super(ecoConfigService)
  }

  protected buildAccount(): PrivateKeyAccount {
    return privateKeyAndNonceToAccountSigner(this.nonceService, this.getPrivateKey())
  }

  protected override getPrivateKey(): Hex {
    return this.ecoConfigService.getEth().simpleAccount.signerPrivateKey
  }
}
