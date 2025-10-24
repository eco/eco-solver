import { RouteTokensDTO } from '@/solver-registration/dtos/route-tokens.dto'

export type CrossChainRoutesConfigDTO = Record<string, Record<string, RouteTokensDTO[]>>
