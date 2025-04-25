import { API_ROOT, QUOTE_ROUTE } from '@/common/routes/constants'
import { APIRequestExecutor } from '@/common/rest-api/api-request-executor'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoError } from '@/common/errors/eco-error'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoResponse } from '@/common/eco-response'
import { HttpService } from '@nestjs/axios'
import { Injectable, Logger, OnApplicationBootstrap, OnModuleInit } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { ServerConfig, SolverRegistrationConfig } from '@/eco-configs/eco-config.types'
import { SignatureHeaders } from '@/request-signing/interfaces/signature-headers.interface'
import { SigningService } from '@/request-signing/signing-service'
import { SolverRegistrationDTO } from '@/solver-registration/dtos/solver-registration.dto'

@Injectable()
export class SolverRegistrationService implements OnModuleInit, OnApplicationBootstrap {
  private logger = new Logger(SolverRegistrationService.name)
  private serverConfig: ServerConfig
  private solverRegistrationConfig: SolverRegistrationConfig
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

  private getSolverRegistrationDTO(): SolverRegistrationDTO {
    const solverRegistrationDTO: SolverRegistrationDTO = {
      quotesUrl: `${this.serverConfig.url}${API_ROOT}${QUOTE_ROUTE}`,
      receiveSignedIntentUrl: `${this.serverConfig.url}${API_ROOT}/unsupported/receiveSignedIntent`,
    }

    return solverRegistrationDTO
  }
}
