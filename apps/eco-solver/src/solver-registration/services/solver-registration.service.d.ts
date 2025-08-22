import { EcoConfigService } from '@libs/solver-config';
import { EcoResponse } from '@eco-solver/common/eco-response';
import { HttpService } from '@nestjs/axios';
import { OnApplicationBootstrap, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
export declare class SolverRegistrationService implements OnModuleInit, OnApplicationBootstrap {
    private readonly ecoConfigService;
    private httpService;
    private readonly moduleRef;
    private logger;
    private serverConfig;
    private solverRegistrationConfig;
    private quotesConfig;
    private solversConfig;
    private signingService;
    private apiRequestExecutor;
    constructor(ecoConfigService: EcoConfigService, httpService: HttpService, moduleRef: ModuleRef);
    onModuleInit(): void;
    onApplicationBootstrap(): Promise<void>;
    private getRequestSignatureHeaders;
    registerSolver(): Promise<EcoResponse<void>>;
    private getSolverRegistrationDTO;
}
