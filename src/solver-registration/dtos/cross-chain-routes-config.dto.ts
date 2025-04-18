import { RouteTokensDTO } from './route-tokens.dto'

export class CrossChainRoutesConfigDTO {
  [from: string]: {
    [to: string]: RouteTokensDTO[]
  }
}
