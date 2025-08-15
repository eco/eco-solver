import { EcoError } from '@/common/errors/eco-error'
import { EcoLogMessage } from '@eco/infrastructure-logging'
import { obscureCenter } from '@eco/utils'
import { EcoConfigService } from '@eco/infrastructure-config'
import { Signer } from '@eco/foundation-eco-adapter'
import { KMSProviderAWS } from '@eco/foundation-eco-adapter'
import { KMSWallets } from '@eco/foundation-eco-adapter'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { getAddress as viemGetAddress, Hex } from 'viem'

/**
 * A service class that initializes the kms signer and provides for signing of messages.
 * @see {@link SignerKmsService}
 */
@Injectable()
export class KmsService implements OnModuleInit {
  private logger = new Logger(KmsService.name)
  private keyID!: string
  wallets!: KMSWallets
  signer!: Signer
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
    return viemGetAddress(await this.wallets.getAddressHex(this.keyID))
  }

  /**
   * Returns the KMS key ID that this service uses to sign
   * @returns the KMS key ID
   */
  getKmsKeyId(): string {
    return this.keyID
  }
}
