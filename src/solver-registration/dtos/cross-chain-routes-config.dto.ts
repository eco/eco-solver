import { RouteTokensDTO } from './route-tokens.dto'

export class CrossChainRoutesConfigDTO {
  [fromChainId: string]: {
    [toChainId: string]: RouteTokensDTO[]
  }
}
