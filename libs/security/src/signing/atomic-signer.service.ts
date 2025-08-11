import { Injectable } from '@nestjs/common'
import { Hex, PrivateKeyAccount } from 'viem/accounts'
import { IEcoConfigService } from '@libs/shared'
import { NonceService } from './nonce.service'
import { SignerService } from './signer.service'
import { privateKeyAndNonceToAccountSigner } from '@libs/shared'

@Injectable()
export class AtomicSignerService extends SignerService {
  constructor(
    readonly nonceService: NonceService,
    readonly ecoConfigService: IEcoConfigService,
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
