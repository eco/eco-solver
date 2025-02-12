import { EcoError } from "@/common/errors/eco-error"
import { EcoConfigService } from "@/eco-configs/eco-config.service"
import { hashObject } from "@/kms/utils"
import { CreateKeyCommand, GetPublicKeyCommand, KMSClient, SignCommand } from "@aws-sdk/client-kms"
import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { createHash } from "crypto"
import { getAddress, Hex, hexToBigInt, keccak256, recoverAddress, toBytes, toHex } from "viem"
import { publicKeyToAddress } from "viem/accounts"

@Injectable()
export class KmsService implements OnModuleInit {
  private logger = new Logger(KmsService.name)
  private kmsClient: KMSClient
  private keyId: string
  constructor(private readonly ecoConfigService: EcoConfigService) { }

  async onModuleInit() {
    const kmsConfig = this.ecoConfigService.getKmsConfig()
    if (!kmsConfig) {
      throw EcoError.KmsCredentialsError(kmsConfig)
    }
    this.kmsClient = new KMSClient({
      region: kmsConfig.region,
    })
    this.keyId = kmsConfig.keyID
    const ethAddress = await this.publicKeyToEthereumAddress()
    // const ethAddress = await this.getPublicAddress()
    console.log("Public Address: ", ethAddress)
    console.log("Public Address: ", await this.publicKeyToEthereumAddress())
    const stuff = this.signMessageWithKms("Hello World", ethAddress)
    // const sig = await this.signObject({ message: "Hello World" }, ethAddress, 10n)
    // console.log("signed object: " + JSON.stringify(sig))
    // console.log("signed object: " + JSON.stringify(await this.verifySignature({ message: "Hello World" }, '0x', 10n)))
  }

  async publicKeyToEthereumAddress(
  ): Promise<Hex> {


    // 2. Get the public key from KMS
    const getPublicKeyCommand = new GetPublicKeyCommand({
      KeyId: this.keyId,
    })

    const publicKeyResponse = await this.kmsClient.send(getPublicKeyCommand)

    if (!publicKeyResponse.PublicKey) {
      throw new Error('Failed to retrieve public key from KMS')
    }
    let publicKey = publicKeyResponse.PublicKey
    // Buffer.from(publicKeyResponse.PublicKey).toString("hex")
    // Remove ASN.1 encoding if needed
    if (publicKey.length > 65) {
      // Extract the last 64 bytes
      publicKey = publicKey.slice(-64)
      // Add 0x04 prefix (uncompressed format)
      publicKey = Buffer.concat([Buffer.from([0x04]), publicKey])
    }

    // Hash the public key with Keccak-256
    const hash = keccak256(publicKey)

    // Ethereum address is last 20 bytes of the hash
    return `0x${hash.slice(-40)}`
  }

  toHexString(uint8Array: Uint8Array) {
    return Array.from(uint8Array)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
  }
  async getPublicAddress(): Promise<Hex> {
    const command = new GetPublicKeyCommand({
      KeyId: this.keyId,
    })

    const response = await this.kmsClient.send(command)

    if (!response.PublicKey) {
      throw new Error('Failed to retrieve public key from KMS')
    }
    // Convert the public key from ASN.1 DER format to raw uncompressed format
    let pubString = Buffer.from(response.PublicKey).toString("hex")

    // Convert public key to Ethereum address
    return publicKeyToAddress(`0x${pubString}`)
  }

  async signMessageWithKms(message: string, expectedAddress: `0x${string}`): Promise<{ r: `0x${string}`, s: `0x${string}`, yParity: number }> {
  // Hash the message with keccak256 (Ethereum standard)
  const hash = keccak256(toBytes(message))

  // Request KMS to sign the hash
  const signCommand = new SignCommand({
    KeyId: this.keyId,
    Message: toBytes(hash),
    MessageType: "DIGEST",
    SigningAlgorithm: "ECDSA_SHA_256"
  })

  const { Signature } = await this.kmsClient.send(signCommand)
  if (!Signature) {
    throw new Error("Failed to sign the message with AWS KMS")
  }

  // Decode DER signature
  const signature = Buffer.from(Signature)
  const r = toHex(signature.slice(4, 36)) // Extract r
  const s = toHex(signature.slice(38, 70)) // Extract s

  // Try both v values (27 and 28) to determine the correct one
  let v = 27
  try{
    console.log("recoverd: " , await recoverAddress({ hash, signature: { r, s, v: BigInt(v) } }))
  }catch(e){
    v++
    console.log("recoverdd: " ,await recoverAddress({ hash, signature: { r, s, v: BigInt(v) } }))
  }

  // let recovered = await recoverAddress({ hash, signature: { r, s, v: BigInt(v) } })

  // if (recovered.toLowerCase() !== expectedAddress.toLowerCase()) {
  //   v = 28
  //   recovered = await recoverAddress({ hash, signature: { r, s, v: BigInt(v) } })
  //   if (recovered.toLowerCase() !== expectedAddress.toLowerCase()) {
  //     throw new Error("Failed to recover the correct address")
  //   }
  // }

  // Convert v to yParity (0 for v = 27, 1 for v = 28)
  const yParity = v - 27

  return { r, s, yParity }
}

  /**
 * Signs a given keccak256 hash using AWS KMS
 */
  // async signHashWithKms(hash: `0x${string}`, expectedAddress: Hex, chainId: bigint): Promise<{ r: `0x${string}`, s: `0x${string}`, v: number }> {
  //   const signCommand = new SignCommand({
  //     KeyId: this.keyId,
  //     Message: toBytes(hash),
  //     MessageType: "DIGEST",
  //     SigningAlgorithm: "ECDSA_SHA_256"
  //   })

  //   const { Signature } = await this.kmsClient.send(signCommand)
  //   if (!Signature) {
  //     throw new Error("Failed to sign the message with AWS KMS")
  //   }

  //   // Decode DER signature
  //   const signature = Buffer.from(Signature)
  //   const r = toHex(signature.slice(4, 36))
  //   const s = toHex(signature.slice(38, 70))

  //   // Try both v values (27 and 28) and find the correct one
  //   let v = 27 // Default to 27
  //   try {
  //     let re = await recoverAddress({ hash, signature: { r, s, v: BigInt(v) } })
  //     console.log("Recovered Address:", re)
  //     if (re.toLowerCase() !== expectedAddress.toLowerCase()) {
  //       throw new Error("Failed to recover the correct address with v = 27")
  //     }
  //   } catch (e) {
  //     v++
  //     let re1 = await recoverAddress({ hash, signature: { r, s, v: BigInt(v) } })
  //     console.log("Recovered Address1:", re1)
  //   }
  //   let recovered = await recoverAddress({ hash, signature: { r, s, v: BigInt(v) } })
  //   if (recovered.toLowerCase() !== expectedAddress.toLowerCase()) {
  //     v = 28 // Try 28
  //     recovered = await recoverAddress({ hash, signature: { r, s, v: BigInt(v) } })
  //     if (recovered.toLowerCase() !== expectedAddress.toLowerCase()) {
  //       throw new Error("Failed to recover the correct address with either v = 27 or v = 28")
  //     }
  //   }

  //   // Convert v to yParity for Viem (0 or 1)
  //   const yParity = v - 27 // If v = 27, yParity = 0; if v = 28, yParity = 1

  //   return { r, s, v: yParity }
  // }

//   /**
//  * Verifies the signature by recovering the address and comparing it to the expected signer
//  */
//   async verifySignature(obj: object, expectedAddress: `0x${string}`, chainId: bigint) {
//     const hash = keccak256(toBytes(hashObject(obj)))
//     console.log("Hashed Message:", hash)

//     const { r, s, v } = await this.signHashWithKms(hash, expectedAddress, chainId)

//     // Recover the address from the signature
//     const recoveredAddress = await recoverAddress({ hash, signature: { r, s, v: BigInt(v) } })

//     console.log("Recovered Address:", recoveredAddress)
//     console.log("Expected Address:", expectedAddress)

//     return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase()
//   }



  /**
  * Main function to sign an object and return the Ethereum-compatible signature
  */
  // async signObject(obj: object, expectedAddress: Hex, chainID: bigint) {
  // try {
  //   const hash = hashObject(obj)
  //   console.log("Hashed Object:", hash)

  //   const { r, s, v } = await this.signHashWithKms(hash, expectedAddress, chainID)
  //   console.log("Ethereum Signature:", { r, s, v })

  //   return { r, s, v }
  // } catch (error) {
  //   console.error("Error signing object:", error)
  // }
// }


  /**
   * Creates a new key in AWS KMS and returns the key ID.
   * @returns the keyID
   */
  async createKey(): Promise < string > {
  const response = await this.kmsClient.send(new CreateKeyCommand({
    KeySpec: "ECC_SECG_P256K1",
    KeyUsage: "SIGN_VERIFY"
  }))
    if(!response.KeyMetadata?.KeyId) {
  throw new Error("AWSKMS: KeyId not exist.")
}
return response.KeyMetadata?.KeyId
  }
}