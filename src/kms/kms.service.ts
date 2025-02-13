import { EcoError } from '@/common/errors/eco-error'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { obscureCenter } from '@/common/utils/strings'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Signer } from '@web3-kms-signer/core'
import { KMSProviderAWS } from '@web3-kms-signer/kms-provider-aws'
import { KMSWallets } from '@web3-kms-signer/kms-wallets'
import { Hex } from 'viem'

/**
 * A service class that initializes the kms signer and provides for signing of messages.
 * @see {@link SignerKmsService}
 */
@Injectable()
export class KmsService implements OnModuleInit {
  private logger = new Logger(KmsService.name)
  private keyID: string
  wallets: KMSWallets
  signer: Signer
  constructor(private readonly ecoConfigService: EcoConfigService) {}

  async onModuleInit() {
    const kmsConfig = this.ecoConfigService.getKmsConfig()
    if (!kmsConfig) {
      throw EcoError.KmsCredentialsError(kmsConfig)
    }
    this.keyID = kmsConfig.keyID

    const provider = new KMSProviderAWS({
      region: kmsConfig.region,
    })
    this.wallets = new KMSWallets(provider)

    // Dont need chainId because transactions eip1559, already hash the chainID on signature in viem
    // Basic signs do need chainID for eip 155
    this.signer = new Signer(this.wallets) //, chainId)

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `KmsService initialized`,
        properties: {
          kmsAddress: await this.getAddress(),
          kmsKeyId: obscureCenter(this.getKmsKeyId()),
        },
      }),
    )
  }

  /**
   * Returns the address as hex of the KMS signer.
   * @returns the KMS eth address
   */
  async getAddress(): Promise<Hex> {
    return (await this.wallets.getAddressHex(this.keyID)) as Hex
  }

  /**
   * Returns the KMS key ID that this service uses to sign
   * @returns the KMS key ID
   */
  getKmsKeyId(): string {
    return this.keyID
  }
}
