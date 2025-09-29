import { Address } from 'viem'
import {
  API_ROOT,
  API_V2_ROOT,
  INTENT_INITIATION_ROUTE,
  QUOTE_ROUTE,
  QUOTE_ROUTE_REVERSE,
} from '@/common/routes/constants'
import { APIRequestExecutor } from '@/common/rest-api/api-request-executor'
import { CrossChainRoutesConfigDTO } from '@/solver-registration/dtos/cross-chain-routes-config.dto'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoError } from '@/common/errors/eco-error'
import { EcoLogger } from '@/common/logging/eco-logger'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoResponse } from '@/common/eco-response'
import { HttpService } from '@nestjs/axios'
import { Injectable, OnApplicationBootstrap, OnModuleInit } from '@nestjs/common'
import {
  IntentSource,
  QuotesConfig,
  ServerConfig,
  Solver,
  SolverRegistrationConfig,
} from '@/eco-configs/eco-config.types'
import { ModuleRef } from '@nestjs/core'
import { RouteTokensDTO } from '@/solver-registration/dtos/route-tokens.dto'
import { SignatureHeaders } from '@/request-signing/interfaces/signature-headers.interface'
import { SigningService } from '../../request-signing/signing.service'
import { SolverRegistrationDTO } from '@/solver-registration/dtos/solver-registration.dto'
import * as _ from 'lodash'

@Injectable()
export class SolverRegistrationService implements OnModuleInit, OnApplicationBootstrap {
  private logger = new EcoLogger(SolverRegistrationService.name)
  private serverConfig: ServerConfig
  private solverRegistrationConfig: SolverRegistrationConfig
  private quotesConfig: QuotesConfig
  private solversConfig: Record<number, Solver>
  private intentSourcesConfig: IntentSource[]
  private signingService: SigningService
  private apiRequestExecutor: APIRequestExecutor

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private httpService: HttpService,
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit() {
    this.serverConfig = this.ecoConfigService.getServer()
    this.solverRegistrationConfig = this.ecoConfigService.getSolverRegistrationConfig()
    this.quotesConfig = this.ecoConfigService.getQuotesConfig()
    this.solversConfig = this.ecoConfigService.getSolvers()
    this.intentSourcesConfig = this.ecoConfigService.getIntentSources()
    this.signingService = this.moduleRef.get<SigningService>(SigningService, {
      strict: false,
    })

    this.apiRequestExecutor = new APIRequestExecutor(
      this.httpService,
      this.solverRegistrationConfig.apiOptions,
      this.logger,
    )

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${SolverRegistrationService.name}.onModuleInit()`,
      }),
    )
  }

  async onApplicationBootstrap() {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `${SolverRegistrationService.name}.onApplicationBootstrap()`,
      }),
    )

    setImmediate(() => this.tryRegisterWithBackoff())
  }

  private async getRequestSignatureHeaders(payload: object): Promise<SignatureHeaders> {
    const expiryTime = Date.now() + 1000 * 60 * 5 // 5 minutes
    return this.signingService.getHeaders(payload, expiryTime)
  }

  async registerSolver(): Promise<EcoResponse<void>> {
    try {
      const solverRegistrationDTO = this.getSolverRegistrationDTO()

      const { response, error } = await this.apiRequestExecutor.executeRequest<void>({
        method: 'post',
        endPoint: '/api/v1/solverRegistry/registerSolver',
        body: solverRegistrationDTO,
        additionalHeaders: await this.getRequestSignatureHeaders(solverRegistrationDTO),
      })

      if (error) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `Error registering solver`,
            properties: {
              error,
            },
          }),
        )

        return { error }
      }

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `registerSolver: Solver has been registered`,
          properties: { response },
        }),
      )

      return {}
    } catch (ex) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Exception registering solver`,
          properties: {
            error: ex.message,
          },
        }),
      )

      return { error: EcoError.SolverRegistrationError }
    }
  }

  private getSolverRegistrationDTO(): SolverRegistrationDTO {
    /*
      Looks like this:

      "*": {
        "84532": [
          { send: "*", receive: ["0xAb1D243b07e99C91dE9E4B80DFc2B07a8332A2f7", "0x8bDa9F5C33FBCB04Ea176ea5Bc1f5102e934257f"] }
        ],
      }

      "*": {
        "11155420": [
          { send: "*", receive: ["0x5fd84259d66Cd46123540766Be93DFE6D43130D7"] }
        ],
      }
    */

    const solverRegistrationDTO: SolverRegistrationDTO = {
      intentExecutionTypes: this.quotesConfig.intentExecutionTypes,
      quotesUrl: this.getServerEndpoint(API_ROOT, QUOTE_ROUTE),
      quotesV2Url: this.getServerEndpoint(API_V2_ROOT, QUOTE_ROUTE_REVERSE),

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

      supportsNativeTransfers: true, // this.solverRegistrationConfig.supportsNative,

      crossChainRoutes: {
        crossChainRoutesConfig: this.getCrossChainRoutesConfig(),
      },
    }

    return solverRegistrationDTO
  }

  private getCrossChainRoutesConfig(): CrossChainRoutesConfigDTO {
    const crossChainRoutesConfig: CrossChainRoutesConfigDTO = {}

    for (const solver of Object.values(this.solversConfig)) {
      const destinationChainID = solver.chainID.toString()
      const destinationTokens = [...new Set(Object.keys(solver.targets))].sort()

      if (destinationTokens.length === 0) {
        this.logger.warn(
          EcoLogMessage.fromDefault({
            message: `getCrossChainRoutesConfig: No targets configured for solver destinationChainID ${destinationChainID}, skipping`,
          }),
        )
        continue
      }

      for (const intentSource of this.intentSourcesConfig) {
        const intentSourceChainID = intentSource.chainID.toString()

        if (intentSourceChainID === destinationChainID) {
          // Skip if from and to are the same
          continue
        }

        const routeTokensDTOs = this.getRouteTokensDTOs(intentSource.chainID, destinationTokens)

        if (routeTokensDTOs.length === 0) {
          continue
        }

        // If crossChainRoutesConfig[intentSourceChainID] is null or undefined, assign {}
        crossChainRoutesConfig[intentSourceChainID] ??= {}
        crossChainRoutesConfig[intentSourceChainID][destinationChainID] = routeTokensDTOs
      }
    }

    return crossChainRoutesConfig
  }

  private getRouteTokensDTOs(
    intentSourceChainID: number,
    destinationTokens: string[],
  ): RouteTokensDTO[] {
    const sourceTokens = this.getSourceTokensForChain(intentSourceChainID)

    if (_.isEmpty(sourceTokens)) {
      this.logger.warn(
        EcoLogMessage.fromDefault({
          message: `getRouteTokensDTOs: No tokens configured for intentSourceChainID ${intentSourceChainID}, skipping`,
        }),
      )
      return []
    }

    return sourceTokens.map((token) => ({
      send: token,
      receive: destinationTokens,
    }))
  }

  private getSourceTokensForChain(chainID: number): Address[] {
    const intentSource = this.intentSourcesConfig.find((source) => source.chainID === chainID)

    if (!intentSource) {
      this.logger.warn(
        EcoLogMessage.fromDefault({
          message: `getSourceTokensForChain: No intent source found for chainID ${chainID}`,
        }),
      )

      return []
    }

    return intentSource.tokens
  }

  private async tryRegisterWithBackoff(max = 5) {
    let delay = 1000

    for (let i = 0; i < max; i++) {
      const { error } = await this.registerSolver()

      if (!error) {
        return
      }

      await new Promise((r) => setTimeout(r, delay))
      delay = Math.min(delay * 2, 30_000)
    }

    this.logger.error(
      EcoLogMessage.fromDefault({
        message: `tryRegisterWithBackoff: Solver registration failed after ${max} retries`,
      }),
    )
  }

  private getServerEndpoint(...parts: string[]): string {
    return this.joinUrl(this.serverConfig.url, ...parts)
  }

  private joinUrl(...parts: string[]) {
    return parts
      .filter(Boolean)
      .map((p, i) => (i === 0 ? p.replace(/\/+$/, '') : p.replace(/^\/+/, '').replace(/\/+$/, '')))
      .join('/')
  }
}
