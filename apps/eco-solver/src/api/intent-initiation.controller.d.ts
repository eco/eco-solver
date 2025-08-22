import { OnModuleInit } from '@nestjs/common';
import { GaslessIntentRequestDTO } from '@eco-solver/quote/dto/gasless-intent-request.dto';
import { GaslessIntentResponseDTO } from '@eco-solver/intent-initiation/dtos/gasless-intent-response.dto';
import { ModuleRef } from '@nestjs/core';
export declare class IntentInitiationController implements OnModuleInit {
    private readonly moduleRef;
    private logger;
    private intentInitiationService;
    constructor(moduleRef: ModuleRef);
    onModuleInit(): void;
    initiateGaslessIntent(gaslessIntentRequestDTO: GaslessIntentRequestDTO): Promise<GaslessIntentResponseDTO>;
}
