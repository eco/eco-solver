export interface SolverRegistrationRequestBody {
  intentExecutionTypes: ('SELF_PUBLISH' | 'GASLESS')[];

  supportsNativeTransfers?: boolean;

  quotesUrl: string;
  quotesV2Url?: string;
  reverseQuotesUrl?: string;
  reverseQuotesV2Url?: string;

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

export interface SolverRegistrationResponseBody {
  solverID: string;
  intentExecutionTypes: string[];
  supportsNativeTransfers?: boolean;
  quotesUrl: string;
  quotesV2Url?: string;
  reverseQuotesUrl: string;
  receiveSignedIntentUrl: string;
  gaslessIntentTransactionDataUrl: string;
  useSolverDataFormat: boolean;
}
