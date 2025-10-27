import * as fs from 'fs';

import { PublicKey } from '@solana/web3.js';
import vault from 'node-vault';

import { getErrorMessage } from '@/common/utils/error-handler';
import { VaultAuthConfig } from '@/config/schemas/solana.schema';

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
        // Token authentication - directly set the token
        this.client.token = this.authConfig.token;

        // Verify the token is valid
        await this.client.tokenLookupSelf();
      } else if (this.authConfig.type === 'kubernetes') {
        // Kubernetes authentication
        const jwt =
          this.authConfig.jwt ||
          this.readServiceAccountToken('/var/run/secrets/kubernetes.io/serviceaccount/token');

        const response = await this.client.kubernetesLogin({
          role: this.authConfig.role,
          jwt: jwt,
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

      // Parse the public key - Vault returns it as base64
      // For ed25519 (Solana's curve), the public key should be 32 bytes
      const publicKeyBuffer = Buffer.from(keyData.public_key, 'base64');

      // Convert to Solana PublicKey
      this.publicKey = new PublicKey(publicKeyBuffer);

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

  /**
   * Renews the Vault token if necessary
   * This should be called periodically for long-running processes
   */
  async renewToken(): Promise<void> {
    try {
      // Only renew for token auth (kubernetes auth handles this differently)
      if (this.authConfig.type === 'token') {
        await this.client.tokenRenewSelf();
      }
    } catch (error) {
      throw new Error(`Failed to renew Vault token: ${getErrorMessage(error)}`);
    }
  }
}
