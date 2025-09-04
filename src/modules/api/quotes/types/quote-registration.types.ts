export interface SolverRegistrationRequestBody {
  intentExecutionTypes: ('SELF_PUBLISH' | 'GASLESS')[];

  supportsNativeTransfers?: boolean;

  quotesUrl: string;

  receiveSignedIntentUrl: string;

  crossChainRoutes: {
    useTokenEnums?: boolean;
    crossChainRoutesConfig: {
      [from: string]: {
        [to: string]: {
          send: string;
          receive: string[];
        }[];
      };
    };
  };
}
