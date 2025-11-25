import { HttpService } from '@nestjs/axios';
import { Injectable, OnApplicationBootstrap, OnModuleInit } from '@nestjs/common';

import { Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { EcoResponse } from '@/common/eco-response';
import { EcoLogMessage } from '@/common/logging/eco-log-message';
import { EcoLogger } from '@/common/logging/eco-logger';
import { APIRequestExecutor } from '@/common/rest-api/api-request-executor';
import { BlockchainAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainTypeDetector } from '@/common/utils/chain-type-detector';
import { minutes, now } from '@/common/utils/time';
import { EcoError } from '@/errors/eco-error';
import { INTENT_INITIATION_ROUTE } from '@/modules/api/gasless-intents/constants/endpoint';
import { API_ROOT, API_V2_ROOT } from '@/modules/api/paths';
import { QUOTE_ROUTE } from '@/modules/api/quotes/constants/endpoint';
import { IntentExecutionType } from '@/modules/api/quotes/enums/intent-execution-type.enum';
import { SolverRegistrationDTO } from '@/modules/api/quotes/solver-registration/dtos/solver-registration.dto';
import { BlockchainConfigService, QuotesConfigService } from '@/modules/config/services';
import { SIGNATURE_EXPIRE_HEADER } from '@/request-signing/interfaces/signature-headers.interface';
import { SignatureGenerator } from '@/request-signing/signature-generator';

@Injectable()
export class SolverRegistrationService implements OnModuleInit, OnApplicationBootstrap {
  private readonly logger = new EcoLogger(SolverRegistrationService.name);
  private apiRequestExecutor: APIRequestExecutor;

  constructor(
    private readonly httpService: HttpService,
    private readonly quotesConfigService: QuotesConfigService,
    private readonly blockchainConfigService: BlockchainConfigService,
    private readonly signatureGenerator: SignatureGenerator,
  ) {}

  onModuleInit() {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `${SolverRegistrationService.name}.onModuleInit()`,
        properties: {
          registrationEnabled: this.quotesConfigService.registrationEnabled,
          baseUrl: this.quotesConfigService.registrationBaseUrl,
          apiUrl: this.quotesConfigService.apiUrl,
        },
      }),
    );

    this.apiRequestExecutor = new APIRequestExecutor(this.httpService, this.logger);
  }

  async onApplicationBootstrap() {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `${SolverRegistrationService.name}.onApplicationBootstrap()`,
      }),
    );

    setImmediate(() => this.tryRegisterWithBackoff());
  }

  /**
   * Register with the external quoting service
   */
  async registerSolver(): Promise<EcoResponse<void>> {
    if (!this.quotesConfigService.registrationEnabled) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `registerSolver: Registration is disabled`,
        }),
      );

      return { error: EcoError.SolverRegistrationDisabled };
    }

    try {
      const solverRegistrationDTO = this.getSolverRegistrationDTO();
      const headers = await this.getRequestHeaders(solverRegistrationDTO);

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `registerSolver: about to register solver`,
        }),
      );

      const { response: urlParts, error: urlError } = this.splitUrl(
        this.quotesConfigService.apiUrl,
      );

      if (urlError) {
        return { error: urlError };
      }

      const { baseUrl, endPoint } = urlParts!;
      this.apiRequestExecutor.setApiConfig({ baseUrl });

      const { response, error } = await this.apiRequestExecutor.executeRequest<any>({
        method: 'post',
        endPoint,
        body: solverRegistrationDTO,
        additionalHeaders: headers,
      });

      if (error) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `Error registering solver`,
            properties: {
              error,
            },
          }),
        );

        return { error };
      }

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `registerSolver: Solver has been registered`,
          properties: { response },
        }),
      );

      return {};
    } catch (ex: any) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Exception registering solver`,
          properties: {
            error: ex.message,
          },
        }),
      );

      return { error: EcoError.SolverRegistrationError };
    }
  }

  /**
   * Generate request headers including signature using wallet signing
   */
  private async getRequestHeaders(payload: SolverRegistrationDTO): Promise<Record<string, string>> {
    const privateKey = this.quotesConfigService.registrationPrivateKey;
    const walletAccount = privateKeyToAccount(privateKey as Hex);
    const expiryTime = (now() + minutes(2)) * 1_000; // 2 minutes

    const signatureHeaders = await this.signatureGenerator.getHeadersWithWalletClient(
      walletAccount,
      payload,
      expiryTime,
    );

    return {
      ...signatureHeaders,
      [SIGNATURE_EXPIRE_HEADER]: signatureHeaders[SIGNATURE_EXPIRE_HEADER].toString(),
    };
  }

  // export const QUOTES_ENDPOINT = '/api/v1/quotes' as const;

  // private getLocalQuoteEndpoint() {
  //   const baseUrl = this.quotesConfigService.registrationBaseUrl;
  //   if (!baseUrl) {
  //     this.logger.error('Registration base URL is not configured');
  //     throw new Error('Registration base URL is not configured');
  //   }
  //   return `${baseUrl}${QUOTES_ENDPOINT}`;
  // }

  private getSolverRegistrationDTO(): SolverRegistrationDTO {
    return {
      intentExecutionTypes: [
        IntentExecutionType.SELF_PUBLISH.toString(),
        IntentExecutionType.GASLESS.toString(),
      ],

      ...this.getAPIEndpoints(),

      // quotesUrl: this.getLocalQuoteEndpoint(),
      // quotesV2Url: this.getLocalQuoteEndpoint(),
      // reverseQuotesV2Url: this.getLocalQuoteEndpoint(),

      // // Use placeholder value since endpoint is required
      // receiveSignedIntentUrl: this.getLocalQuoteEndpoint(),

      supportsNativeTransfers: false,

      crossChainRoutes: {
        crossChainRoutesConfig: this.getCrossChainRoutes(),
      },
    };
  }

  private getAPIEndpoints() {
    if (!this.quotesConfigService.registrationBaseUrl) {
      this.logger.error('Registration base URL is not configured');
      throw new Error('Registration base URL is not configured');
    }

    return {
      quotesUrl: this.getServerEndpoint(API_ROOT, QUOTE_ROUTE),
      quotesV2Url: this.getServerEndpoint(API_V2_ROOT, QUOTE_ROUTE),

      reverseQuotesUrl: this.getServerEndpoint(API_ROOT, QUOTE_ROUTE, 'reverse'),
      reverseQuotesV2Url: this.getServerEndpoint(API_V2_ROOT, QUOTE_ROUTE, 'reverse'),

      receiveSignedIntentUrl: this.getServerEndpoint(
        API_ROOT,
        INTENT_INITIATION_ROUTE,
        'initiateGaslessIntent',
      ),

      gaslessIntentTransactionDataUrl: this.getServerEndpoint(
        API_ROOT,
        INTENT_INITIATION_ROUTE,
        'getGaslessIntentTransactionData',
      ),
    };
  }

  private getCrossChainRoutes() {
    const chainIDs = this.blockchainConfigService.getAllConfiguredChains();

    const routes: SolverRegistrationDTO['crossChainRoutes']['crossChainRoutesConfig'] = {};

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

  private async tryRegisterWithBackoff(max = 5) {
    let delay = 1000;

    for (let i = 0; i < max; i++) {
      const { error } = await this.registerSolver();

      if (!error) {
        return;
      }

      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, 30_000);
    }

    this.logger.error(
      EcoLogMessage.fromDefault({
        message: `tryRegisterWithBackoff: Solver registration failed after ${max} retries`,
      }),
    );
  }

  private splitUrl(fullUrl: string): EcoResponse<{ baseUrl: string; endPoint: string }> {
    try {
      const url = new URL(fullUrl);

      return {
        response: {
          baseUrl: `${url.protocol}//${url.host}`, // http://localhost:9494
          endPoint: url.pathname, // /api/v1/solverRegistry/registerSolver
        },
      };
    } catch (ex: any) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `splitUrl: Invalid URL ${fullUrl}`,
          properties: {
            error: ex.message,
          },
        }),
      );

      return { error: EcoError.InvalidURL };
    }
  }

  private getServerEndpoint(...parts: string[]): string {
    return this.joinUrl(this.quotesConfigService.registrationBaseUrl!, ...parts);
  }

  private joinUrl(...parts: string[]) {
    return parts
      .filter(Boolean)
      .map((p, i) => (i === 0 ? p.replace(/\/+$/, '') : p.replace(/^\/+/, '').replace(/\/+$/, '')))
      .join('/');
  }
}
