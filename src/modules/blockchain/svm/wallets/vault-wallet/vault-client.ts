import * as fs from 'fs';

import { PublicKey } from '@solana/web3.js';
import vault from 'node-vault';

import { getErrorMessage } from '@/common/utils/error-handler';
import { VaultAuthConfig } from '@/config/schemas/solana.schema';
import { SystemLoggerService } from '@/modules/logging';

/**
 * HashiCorp Vault client for Solana signing operations using Transit Secrets Engine
 *
 * This class provides secure key management and signing capabilities for Solana transactions
 * by delegating cryptographic operations to HashiCorp Vault's Transit Secrets Engine.
 * Private keys never leave Vault, providing enhanced security for production environments.
 *
 * @remarks
 * **IMPORTANT**: Vault keys MUST be ed25519 type. The Transit Secrets Engine must be enabled
 * and configured with an ed25519 signing key before using this client.
 *
 * ## Features
 * - Remote signing without exposing private keys
 * - Support for token and Kubernetes authentication
 * - Automatic public key caching
 * - Raw 32-byte Ed25519 public key handling
 *
 * ## Token Expiration Handling
 * When a Vault token expires, operations will fail with "permission denied" errors. This client
 * automatically detects these errors, re-authenticates with Vault, and retries the operation once.
 * This ensures seamless operation even after token expiration.
 *
 * ## Authentication Methods
 *
 * ### Token Authentication (Testing Only)
 * Token authentication is suitable for development and testing but lacks automatic token renewal
 * required for long-running production processes.
 *
 * @example
 * ```yaml
 * # Token authentication configuration (testing only)
 * solana:
 *   wallets:
 *     basic:
 *       type: vault
 *       endpoint: https://vault.example.com:8200
 *       transitPath: transit
 *       keyName: solana-signing-key
 *       auth:
 *         type: token
 *         token: hvs.CAESIJ...
 * ```
 *
 * ### Kubernetes Authentication (Production)
 * Kubernetes authentication is recommended for production deployments. It uses the pod's
 * service account token for authentication and supports automatic token renewal.
 *
 * @example
 * ```yaml
 * # Kubernetes authentication configuration (production)
 * solana:
 *   wallets:
 *     basic:
 *       type: vault
 *       endpoint: https://vault.example.com:8200
 *       transitPath: transit
 *       keyName: solana-signing-key
 *       auth:
 *         type: kubernetes
 *         role: solver-service
 *         mountPoint: kubernetes  # optional, defaults to 'kubernetes'
 *         jwtPath: /var/run/secrets/kubernetes.io/serviceaccount/token  # optional
 * ```
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
        this.logger.log('Token authentication successful');
      } else if (this.authConfig.type === 'kubernetes') {
        // Kubernetes authentication
        let jwt: string;
        if (this.authConfig.jwt) {
          jwt = this.authConfig.jwt;
        } else if (this.authConfig.jwtPath) {
          jwt = await this.readServiceAccountToken(this.authConfig.jwtPath);
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

        const leaseDuration = response.auth.lease_duration || response.lease_duration;
        this.logger.log(
          `Kubernetes authentication successful${leaseDuration ? ` (TTL: ${leaseDuration}s)` : ''}`,
        );
      } else {
        throw new Error(`Unsupported auth type: ${(this.authConfig as any).type}`);
      }
    } catch (error) {
      throw new Error(`Failed to authenticate with Vault: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Signs data using Vault Transit Secrets Engine
   * Automatically re-authenticates if token has expired
   * @param data - The data to sign (Uint8Array)
   * @returns Signature as Uint8Array
   */
  async sign(data: Uint8Array): Promise<Uint8Array> {
    try {
      return await this.executeWithRetry(async () => {
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
      });
    } catch (error) {
      throw new Error(`Failed to sign with Vault: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Gets the public key from Vault Transit Secrets Engine
   * Returns cached public key if already fetched
   * Automatically re-authenticates if token has expired
   * @returns PublicKey for this signing key
   */
  async getPublicKey(): Promise<PublicKey> {
    if (this.publicKey) {
      return this.publicKey;
    }

    try {
      return await this.executeWithRetry(async () => {
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

        const keyBuffer = Buffer.from(keyData.public_key, 'base64');

        // Validate the raw key size
        if (keyBuffer.length !== 32) {
          throw new Error(`Expected 32-byte raw Ed25519 public key, got ${keyBuffer.length} bytes`);
        }

        // Convert to Solana PublicKey
        this.publicKey = new PublicKey(keyBuffer);

        return this.publicKey;
      });
    } catch (error) {
      throw new Error(`Failed to get public key from Vault: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Executes a Vault operation with automatic retry on permission denied errors
   * If a permission denied error occurs, re-authenticates and retries once
   * @param operation - The async operation to execute
   * @returns The result of the operation
   */
  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      // Check if this is a permission denied error
      if (this.isPermissionDeniedError(error)) {
        this.logger.warn('Vault operation failed with permission denied. Re-authenticating...');

        try {
          // Re-authenticate
          await this.authenticate();
          this.logger.log('Re-authentication successful. Retrying operation...');

          // Retry the operation once
          return await operation();
        } catch (retryError) {
          this.logger.error(`Retry after re-authentication failed: ${getErrorMessage(retryError)}`);
          throw retryError;
        }
      }

      // If not a permission error, throw the original error
      throw error;
    }
  }

  /**
   * Checks if an error is a permission denied error from Vault
   * @param error - The error to check
   * @returns true if this is a permission denied error
   */
  private isPermissionDeniedError(error: unknown): boolean {
    if (!error) return false;

    const errorMessage = getErrorMessage(error).toLowerCase();

    // Check for common Vault permission error messages
    return (
      errorMessage.includes('permission denied') ||
      errorMessage.includes('403') ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('token expired') ||
      errorMessage.includes('invalid token')
    );
  }

  /**
   * Reads the Kubernetes service account token from the default location
   * @param path - Path to the service account token file
   * @returns The JWT token as a string
   */
  private async readServiceAccountToken(path: string): Promise<string> {
    try {
      const token = await fs.promises.readFile(path, 'utf8');
      return token.trim();
    } catch (error) {
      throw new Error(
        `Failed to read Kubernetes service account token from ${path}: ${getErrorMessage(error)}`,
      );
    }
  }
}
