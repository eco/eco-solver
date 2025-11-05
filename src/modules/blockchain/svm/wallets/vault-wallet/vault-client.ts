import * as fs from 'fs';

import { PublicKey } from '@solana/web3.js';
import vault from 'node-vault';

import { getErrorMessage } from '@/common/utils/error-handler';
import { VaultAuthConfig } from '@/config/schemas/solana.schema';
import { SystemLoggerService } from '@/modules/logging';

/**
 * HashiCorp Vault client for Solana signing operations using Transit Secrets Engine
 */
export class VaultClient {
  private client: vault.client;
  private publicKey: PublicKey | null = null;

  constructor(
    private readonly endpoint: string,
    private readonly transitPath: string,
    private readonly keyName: string,
    private readonly authConfig: VaultAuthConfig,
    private readonly logger: SystemLoggerService,
  ) {
    // Initialize vault client (authentication happens in authenticate method)
    this.client = vault({
      apiVersion: 'v1',
      endpoint: endpoint,
    });
  }

  /**
   * Authenticates with HashiCorp Vault based on the configured auth method
   * @throws Error if authentication fails
   */
  async authenticate(): Promise<void> {
    try {
      if (this.authConfig.type === 'token') {
        // NOTE: TOKEN AUTH MUST BE USED FOR TESTING PURPOSES ONLY
        // It lacks auto-renewals needed for long-running processes

        // Token authentication - directly set the token
        this.client.token = this.authConfig.token;

        // Verify the token is valid
        await this.client.tokenLookupSelf();
      } else if (this.authConfig.type === 'kubernetes') {
        // Kubernetes authentication

        let jwt: string;
        if (this.authConfig.jwt) {
          jwt = this.authConfig.jwt;
        } else if (this.authConfig.jwtPath) {
          jwt = this.readServiceAccountToken(this.authConfig.jwtPath);
        } else {
          throw new Error('Kubernetes auth requires either jwt or jwtPath');
        }

        const response = await this.client.kubernetesLogin({
          jwt: jwt,
          role: this.authConfig.role,
          mount_point: this.authConfig.mountPoint,
        });

        if (!response.auth || !response.auth.client_token) {
          throw new Error('Kubernetes authentication failed: no client token returned');
        }

        this.client.token = response.auth.client_token;
      } else {
        throw new Error(`Unsupported auth type: ${(this.authConfig as any).type}`);
      }
    } catch (error) {
      throw new Error(`Failed to authenticate with Vault: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Signs data using Vault Transit Secrets Engine
   * @param data - The data to sign (Uint8Array)
   * @returns Signature as Uint8Array
   */
  async sign(data: Uint8Array): Promise<Uint8Array> {
    try {
      // Convert data to base64 for Vault API
      const base64Data = Buffer.from(data).toString('base64');

      // Call Transit sign endpoint
      const response = await this.client.write(`${this.transitPath}/sign/${this.keyName}`, {
        input: base64Data,
      });

      if (!response.data || !response.data.signature) {
        throw new Error('Vault sign operation did not return a signature');
      }

      // Parse the signature from Vault format (vault:v1:base64signature)
      const signatureParts = response.data.signature.split(':');
      if (signatureParts.length < 3) {
        throw new Error(`Invalid signature format from Vault: ${response.data.signature}`);
      }

      const signatureBase64 = signatureParts[2];
      const signatureBuffer = Buffer.from(signatureBase64, 'base64');

      return new Uint8Array(signatureBuffer);
    } catch (error) {
      throw new Error(`Failed to sign with Vault: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Gets the public key from Vault Transit Secrets Engine
   * Returns cached public key if already fetched
   * @returns PublicKey for this signing key
   */
  async getPublicKey(): Promise<PublicKey> {
    if (this.publicKey) {
      return this.publicKey;
    }

    try {
      // Read the public key from Vault
      const response = await this.client.read(`${this.transitPath}/keys/${this.keyName}`);

      if (!response.data || !response.data.keys) {
        throw new Error('Vault did not return key information');
      }

      // Get the latest version of the key
      const versions = Object.keys(response.data.keys);
      if (versions.length === 0) {
        throw new Error('No key versions found in Vault');
      }

      // Use the latest version
      const latestVersion = Math.max(...versions.map(Number)).toString();
      const keyData = response.data.keys[latestVersion];

      if (!keyData || !keyData.public_key) {
        throw new Error('Public key not found in Vault key data');
      }

      this.logger.log('Vault client public key', { public_key: keyData.public_key });

      // Parse the public key - Vault returns it as base64-encoded DER SubjectPublicKeyInfo
      // For ed25519, this is a 44-byte structure: 12-byte ASN.1/DER header + 32-byte raw key
      const derBuffer = Buffer.from(keyData.public_key, 'base64');

      // Validate the buffer size
      if (derBuffer.length !== 44) {
        throw new Error(
          `Expected 44-byte DER-encoded public key from Vault, got ${derBuffer.length} bytes`,
        );
      }

      // Strip the 12-byte DER header to extract the raw 32-byte Ed25519 public key
      // DER header format: 0x302a300506032b6570032100 (12 bytes)
      const rawPublicKeyBuffer = derBuffer.subarray(12);

      // Validate the raw key size
      if (rawPublicKeyBuffer.length !== 32) {
        throw new Error(
          `Expected 32-byte raw Ed25519 public key, got ${rawPublicKeyBuffer.length} bytes`,
        );
      }

      // Convert to Solana PublicKey
      this.publicKey = new PublicKey(rawPublicKeyBuffer);

      return this.publicKey;
    } catch (error) {
      throw new Error(`Failed to get public key from Vault: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Reads the Kubernetes service account token from the default location
   * @param path - Path to the service account token file
   * @returns The JWT token as a string
   */
  private readServiceAccountToken(path: string): string {
    try {
      return fs.readFileSync(path, 'utf8').trim();
    } catch (error) {
      throw new Error(
        `Failed to read Kubernetes service account token from ${path}: ${getErrorMessage(error)}`,
      );
    }
  }
}
