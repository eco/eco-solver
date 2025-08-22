declare const _default: {
    server: {
        url: string;
    };
    logger: {
        usePino: boolean;
    };
    database: {
        auth: {
            enabled: boolean;
            username: string;
            password: string;
            type: string;
        };
        uriPrefix: string;
        uri: string;
        dbName: string;
        enableJournaling: boolean;
    };
    redis: {
        connection: {
            host: string;
            port: number;
        };
        jobs: {
            intentJobConfig: {
                removeOnComplete: boolean;
                removeOnFail: boolean;
            };
        };
    };
    intentSources: {
        network: string;
        chainID: number;
        tokens: string[];
    }[];
    solvers: {
        84532: {
            targets: {
                '0xAb1D243b07e99C91dE9E4B80DFc2B07a8332A2f7': {
                    contractType: string;
                    selectors: string[];
                    minBalance: number;
                };
                '0x8bDa9F5C33FBCB04Ea176ea5Bc1f5102e934257f': {
                    contractType: string;
                    selectors: string[];
                    minBalance: number;
                };
                '0x93551e3F61F8E3EE73DDc096BddbC1ADc52f5A3a': {
                    contractType: string;
                    selectors: string[];
                    minBalance: number;
                };
            };
            network: string;
            chainID: number;
            averageBlockTime: number;
            gasOverhead: number;
        };
        11155420: {
            targets: {
                '0x5fd84259d66Cd46123540766Be93DFE6D43130D7': {
                    contractType: string;
                    selectors: string[];
                    minBalance: number;
                };
            };
            network: string;
            chainID: number;
            averageBlockTime: number;
            gasOverhead: number;
        };
    };
    solverRegistrationConfig: {
        apiOptions: {
            baseUrl: string;
        };
    };
};
export default _default;
