import { HttpService } from '@nestjs/axios';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';

import { AxiosError } from 'axios';
import canonicalize from 'canonicalize';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { firstValueFrom } from 'rxjs';
import { Address, Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { BlockchainAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainTypeDetector } from '@/common/utils/chain-type-detector';
import { getErrorMessage } from '@/common/utils/error-handler';
import { minutes, now } from '@/common/utils/time';
import {
  SolverRegistrationRequestBody,
  SolverRegistrationResponseBody,
} from '@/modules/api/quotes/types/quote-registration.types';
import { BlockchainConfigService, QuotesConfigService } from '@/modules/config/services';

import { QUOTES_ENDPOINT } from '../constants/endpoint';

@Injectable()
export class QuoteRegistrationService implements OnApplicationBootstrap {
  constructor(
    @InjectPinoLogger(QuoteRegistrationService.name)
    private readonly logger: PinoLogger,
    private readonly httpService: HttpService,
    private readonly quotesConfigService: QuotesConfigService,
    private readonly blockchainConfigService: BlockchainConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // Perform solver registration if enabled
    if (this.quotesConfigService.registrationEnabled) {
      try {
        this.logger.info('Initiating solver registration on quote server...');
        await this.register();
      } catch (error) {
        this.logger.error(`Failed to register solver to quote server: ${getErrorMessage(error)}`);
      }
    }
  }

  /**
   * Register with the external quoting service
   */
  async register(): Promise<void> {
    if (!this.quotesConfigService.registrationEnabled) {
      this.logger.info('Registration is disabled');
      return;
    }

    try {
      const registrationDto = this.getRegistrationRequestBody();
      const headers = await this.getRequestHeaders(registrationDto);

      const response = await firstValueFrom(
        this.httpService.post<{ data: SolverRegistrationResponseBody }>(
          this.quotesConfigService.apiUrl,
          registrationDto,
          { headers },
        ),
      );

      if ('quotesUrl' in response.data.data) {
        this.logger.info(
          `Successfully registered with ID: ${response.data.data.solverID || 'N/A'}`,
        );
      } else {
        this.logger.error(`Registration failed`);
      }
    } catch (error) {
      this.handleRegistrationError(error);
    }
  }

  /**
   * Generate request headers including signature using wallet signing
   */
  private async getRequestHeaders(dto: SolverRegistrationRequestBody) {
    const expiryTime = (now() + minutes(2)) * 1_000; // 2 minutes
    const { address, signature } = await this.signPayload(dto, expiryTime);

    return {
      'Content-Type': 'application/json',
      'x-beam-sig': signature,
      'x-beam-sig-expire': expiryTime,
      'x-beam-sig-address': address,
    };
  }

  private getLocalQuoteEndpoint() {
    const baseUrl = this.quotesConfigService.registrationBaseUrl;
    if (!baseUrl) {
      this.logger.error('Registration base URL is not configured');
      throw new Error('Registration base URL is not configured');
    }
    return `${baseUrl}${QUOTES_ENDPOINT}`;
  }

  /**
   * Handle registration errors
   */
  private handleRegistrationError(error: unknown): void {
    if (error instanceof AxiosError) {
      if (error.response) {
        this.logger.error(
          `Registration failed with status ${error.response.status}: ${
            error.response.data?.message || error.message
          }`,
        );
      } else if (error.request) {
        this.logger.error(`Registration failed - no response received: ${error.message}`);
      } else {
        this.logger.error(`Registration request failed: ${error.message}`);
      }
    } else if (error instanceof Error) {
      this.logger.error(`Registration failed: ${error.message}`);
    } else {
      this.logger.error(`Registration failed with unknown error`);
    }
  }

  private getRegistrationRequestBody(): SolverRegistrationRequestBody {
    return {
      intentExecutionTypes: ['SELF_PUBLISH'],
      quotesUrl: this.getLocalQuoteEndpoint(),
      quotesV2Url: this.getLocalQuoteEndpoint(),
      reverseQuotesV2Url: this.getLocalQuoteEndpoint(),

      // Use placeholder value since endpoint is required
      receiveSignedIntentUrl: this.getLocalQuoteEndpoint(),

      supportsNativeTransfers: false,
      crossChainRoutes: {
        crossChainRoutesConfig: this.getCrossChainRoutes(),
      },
    };
  }

  private async signPayload(
    payload: object,
    expiryTime: number,
  ): Promise<{ signature: Hex; address: Address }> {
    const privateKey = this.quotesConfigService.registrationPrivateKey;
    const walletAccount = privateKeyToAccount(privateKey as Hex);
    const canonicalPayload = canonicalize(payload);

    if (!canonicalPayload) {
      throw new Error('Failed to get canonical payload');
    }

    const signature = await walletAccount.signTypedData({
      domain: {
        name: 'EcoQuotes',
        version: '1',
        chainId: 1,
      },
      types: {
        Registration: [
          { name: 'payload', type: 'string' },
          { name: 'expiryTime', type: 'uint256' },
        ],
      },
      primaryType: 'Registration',
      message: { payload: canonicalPayload, expiryTime: BigInt(expiryTime) },
    });

    return { signature, address: walletAccount.address };
  }

  private getCrossChainRoutes() {
    const chainIDs = this.blockchainConfigService.getAllConfiguredChains();

    const routes: SolverRegistrationRequestBody['crossChainRoutes']['crossChainRoutesConfig'] = {};

    for (const sourceChainId of chainIDs) {
      // Initialize object
      routes[sourceChainId] = {};

      for (const destinationChainId of chainIDs) {
        if (sourceChainId === destinationChainId) {
          // Skip same-chain routes
          continue;
        }

        routes[sourceChainId][destinationChainId] = this.getCrossChainRoute(
          sourceChainId,
          destinationChainId,
        );
      }
    }

    return routes;
  }

  private getCrossChainRoute(
    source: number,
    destination: number,
  ): { send: BlockchainAddress; receive: BlockchainAddress[] }[] {
    const sourceTokens = this.getChainTokens(source);
    const destinationTokens = this.getChainTokens(destination);

    return sourceTokens.map((token) => ({
      send: token,
      receive: destinationTokens,
    }));
  }

  private getChainTokens(chainID: number): BlockchainAddress[] {
    const chainType = ChainTypeDetector.detect(chainID);
    return this.blockchainConfigService
      .getSupportedTokens(chainID)
      .map((token) => AddressNormalizer.denormalize(token.address, chainType));
  }
}
