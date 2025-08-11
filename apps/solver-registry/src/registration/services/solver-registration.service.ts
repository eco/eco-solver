import { Injectable, OnModuleInit, OnApplicationBootstrap } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { ModuleRef } from '@nestjs/core'
import {
  EcoLogger,
  EcoLogMessage,
  EcoResponse,
  EcoError,
  API_ROOT,
  QUOTE_ROUTE,
  INTENT_INITIATION_ROUTE,
} from '@libs/shared'
import {
  EcoConfigService,
  QuotesConfig,
  ServerConfig,
  Solver,
  SolverRegistrationConfig,
} from '@libs/integrations'
import { SignatureHeaders, SigningService, APIRequestExecutor } from '@libs/security'
import { SolverRegistrationDTO } from '../dtos/solver-registration.dto'
import { CrossChainRoutesConfigDTO } from '../dtos/cross-chain-routes-config.dto'
import { RouteTokensDTO } from '../dtos/route-tokens.dto'

@Injectable()
export class SolverRegistrationService implements OnModuleInit, OnApplicationBootstrap {
  private logger = new EcoLogger(SolverRegistrationService.name)
  private serverConfig: ServerConfig
  private solverRegistrationConfig: SolverRegistrationConfig
  private quotesConfig: QuotesConfig
  private solversConfig: Record<number, Solver>
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
        properties: {
          solverRegistrationDTO: this.getSolverRegistrationDTO(),
        },
      }),
    )
  }

  async onApplicationBootstrap() {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `${SolverRegistrationService.name}.onApplicationBootstrap()`,
      }),
    )

    await this.registerSolver()
  }

  private async getRequestSignatureHeaders(payload: object): Promise<SignatureHeaders> {
    const expiryTime = Date.now() + 1000 * 60 * 2 // 2 minutes
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
          message: `${SolverRegistrationService.name}.registerSolver(): Solver has been registered`,
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

  private getSolverRegistrationDTO(): SolverRegistrationDTO{
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

    const crossChainRoutesConfig: CrossChainRoutesConfigDTO = {
      '*': {},
    }

    const solverRegistrationDTO: SolverRegistrationDTO = {
      intentExecutionTypes: this.quotesConfig.intentExecutionTypes,
      quotesUrl: `${this.serverConfig.url}${API_ROOT}${QUOTE_ROUTE}`,
      receiveSignedIntentUrl: `${this.serverConfig.url}${API_ROOT}${INTENT_INITIATION_ROUTE}`,
      supportsNativeTransfers: true, // this.solverRegistrationConfig.supportsNative,

      crossChainRoutes: {
        crossChainRoutesConfig,
      },
    }

    for (const solver of Object.values(this.solversConfig)) {
      const chainID = solver.chainID.toString()

      const routeTokensDTO: RouteTokensDTO = {
        send: '*',
        receive: Object.keys(solver.targets),
      }

      crossChainRoutesConfig['*'][chainID] = [routeTokensDTO]
    }

    return solverRegistrationDTO
  }
}
