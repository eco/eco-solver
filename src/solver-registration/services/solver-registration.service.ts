import { API_ROOT, INTENT_INITIATION_ROUTE, QUOTE_ROUTE } from '@/common/routes/constants'
import { APIRequestExecutor } from '@/common/rest-api/api-request-executor'
import { CrossChainRoutesConfigDTO } from '@/solver-registration/dtos/cross-chain-routes-config.dto'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoResponse } from '@/common/eco-response'
import { HttpService } from '@nestjs/axios'
import { Injectable, Logger, OnApplicationBootstrap, OnModuleInit } from '@nestjs/common'
import {
  QuotesConfig,
  ServerConfig,
  Solver,
  SolverRegistrationConfig,
} from '@/eco-configs/eco-config.types'
import { EcoError } from '@/common/errors/eco-error'
import { RouteTokensDTO } from '@/solver-registration/dtos/route-tokens.dto'
import { SignatureHeaders } from '@/request-signing/interfaces/signature-headers.interface'
import { QuotesServerSigningService } from '@/request-signing/quotes-server-signing.service'
import { SolverRegistrationDTO } from '@/solver-registration/dtos/solver-registration.dto'

@Injectable()
export class SolverRegistrationService implements OnModuleInit, OnApplicationBootstrap {
  private logger = new Logger(SolverRegistrationService.name)
  private serverConfig: ServerConfig
  private solverRegistrationConfig: SolverRegistrationConfig
  private quotesConfig: QuotesConfig
  private solversConfig: Record<number, Solver>
  private apiRequestExecutor: APIRequestExecutor

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly httpService: HttpService,
    private readonly quotesServerSigningService: QuotesServerSigningService,
  ) {}

  onModuleInit() {
    this.serverConfig = this.ecoConfigService.getServer()
    this.solverRegistrationConfig = this.ecoConfigService.getSolverRegistrationConfig()
    this.quotesConfig = this.ecoConfigService.getQuotesConfig()
    this.solversConfig = this.ecoConfigService.getSolvers()

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

  async registerSolver(): Promise<EcoResponse<void>> {
    try {
      const solverRegistrationDTO = this.getSolverRegistrationDTO()

      const { error } = await this.apiRequestExecutor.executeRequest<void>({
        method: 'post',
        endPoint: '/api/v1/solverRegistry/registerSolver',
        body: solverRegistrationDTO,
        additionalHeaders: this.getRequestSignatureHeaders(solverRegistrationDTO),
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

  private async getRequestSignatureHeaders(payload: object): Promise<SignatureHeaders> {
    const expiryTime = Date.now() + 1000 * 60 * 2 // 2 minutes
    return this.quotesServerSigningService.getHeaders(payload, expiryTime)
  }

  private getSolverRegistrationDTO(): SolverRegistrationDTO {
    return {
      intentExecutionTypes: this.quotesConfig.intentExecutionTypes,
      quotesUrl: `${this.serverConfig.url}${API_ROOT}${QUOTE_ROUTE}`,
      receiveSignedIntentUrl: `${this.serverConfig.url}${API_ROOT}${INTENT_INITIATION_ROUTE}`,

      crossChainRoutes: {
        crossChainRoutesConfig: this.getCrossChainRoutesConfig(),
      },
    }
  }

  private getCrossChainRoutesConfig() {
    /*
      Looks like this:

      "*": {
        "84532": [
          { send: "*", receive: ["0xAb1D243b07e99C91dE9E4B80DFc2B07a8332A2f7", "0x8bDa9F5C33FBCB04Ea176ea5Bc1f5102e934257f"] }
        ],
        "11155420": [
          { send: "*", receive: ["0x5fd84259d66Cd46123540766Be93DFE6D43130D7"] }
        ],
      }
    */
    const crossChainRoutesConfig: CrossChainRoutesConfigDTO = {
      '*': {},
    }

    for (const solver of Object.values(this.solversConfig)) {
      const chainID = solver.chainID.toString()

      const routeTokensDTO: RouteTokensDTO = {
        send: '*',
        receive: Object.keys(solver.targets),
      }

      crossChainRoutesConfig['*'][chainID] = [routeTokensDTO]
    }

    return crossChainRoutesConfig
  }
}
