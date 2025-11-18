import { PortalIdlTypes } from '@/modules/blockchain/svm/targets/types/portal-idl.type';
import { Snakify } from '@/modules/blockchain/svm/types/snake-case.types';

export type RouteInstruction = Snakify<PortalIdlTypes['route']>;
export type RewardInstruction = Snakify<PortalIdlTypes['reward']>;
export type CalldataInstruction = Snakify<PortalIdlTypes['calldata']>;
export type CalldataWithAccountsInstruction = Snakify<PortalIdlTypes['calldataWithAccounts']>;

// Events
export type IntentPublishedInstruction = Snakify<PortalIdlTypes['intentPublished']>;
export type IntentFundedInstruction = Snakify<PortalIdlTypes['intentFunded']>;
export type IntentFulfilledInstruction = Snakify<PortalIdlTypes['intentFulfilled']>;
export type IntentWithdrawnInstruction = Snakify<PortalIdlTypes['intentWithdrawn']>;
