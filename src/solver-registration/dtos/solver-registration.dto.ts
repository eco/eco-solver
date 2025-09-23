import { ApiProperty } from '@nestjs/swagger'
import { BaseSolverRegistrationDTO } from '@/solver-registration/dtos/base-solver-registration.dto'
import { CrossChainRoutesDTO } from '@/solver-registration/dtos/cross-chain-routes.dto'
import { IsNotEmpty } from 'class-validator'

export class SolverRegistrationDTO extends BaseSolverRegistrationDTO {
  @ApiProperty()
  @IsNotEmpty()
  crossChainRoutes: CrossChainRoutesDTO
}
