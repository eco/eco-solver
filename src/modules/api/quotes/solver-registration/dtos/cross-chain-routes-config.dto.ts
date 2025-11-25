import { RouteTokensDTO } from '@/modules/api/quotes/solver-registration/dtos/route-tokens.dto';

export type CrossChainRoutesConfigDTO = Record<string, Record<string, RouteTokensDTO[]>>;
