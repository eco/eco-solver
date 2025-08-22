export interface StargateQuote {
    bridge: string;
    srcAddress: string;
    dstAddress: string;
    srcChainKey: string;
    dstChainKey: string;
    error: unknown;
    srcToken: string;
    dstToken: string;
    srcAmount: string;
    srcAmountMax: string;
    dstAmount: string;
    dstAmountMin: string;
    duration: {
        estimated: number;
    };
    allowance: string;
    dstNativeAmount: string;
    fees: {
        token: string;
        amount: string;
        type: string;
        chainKey: string;
    }[];
    steps: StargateStep[];
}
export interface StargateStep {
    type: string;
    sender: string;
    chainKey: string;
    transaction: {
        data: string;
        to: string;
        from: string;
        value: string;
    };
}
