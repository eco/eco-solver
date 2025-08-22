import { RouteTokensDTO } from './route-tokens.dto';
export declare class CrossChainRoutesConfigDTO {
    [from: string]: {
        [to: string]: RouteTokensDTO[];
    };
}
