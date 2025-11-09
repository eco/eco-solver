import { gql } from 'graphql-request';

import type { IndexedRefund } from '../types/intent.types';
import type { PaginatedResponse } from '../types/pagination.types';

// Note: Based on schema exploration, there's no direct "IntentFunded" event
// We'll track this through the "refunds" which the indexer provides
export const FUNDED_INTENTS_QUERY = gql`
  query FundedIntents($portalAddresses: [String!]!, $since: BigInt!, $after: String) {
    refunds(
      where: { blockTimestamp_gt: $since, evt_log_address_in: $portalAddresses }
      after: $after
      limit: 50
    ) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      items {
        hash
        chainId
        transactionHash
        blockNumber
        blockTimestamp
        evt_log_address
        evt_log_index
      }
    }
  }
`;

export interface FundedIntentsVariables {
  portalAddresses: string[];
  since: bigint;
  after?: string;
}

export interface FundedIntentsResponse {
  refunds: PaginatedResponse<IndexedRefund>;
}
