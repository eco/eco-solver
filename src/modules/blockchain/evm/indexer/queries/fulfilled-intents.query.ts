import { gql } from 'graphql-request';

import type { IndexedFulfillment } from '../types/intent.types';
import type { PaginatedResponse } from '../types/pagination.types';

export const FULFILLED_INTENTS_QUERY = gql`
  query FulfilledIntents($portalAddresses: [String!]!, $since: BigInt!, $after: String) {
    fulfillments(
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

export interface FulfilledIntentsVariables {
  portalAddresses: string[];
  since: bigint;
  after?: string;
}

export interface FulfilledIntentsResponse {
  fulfillments: PaginatedResponse<IndexedFulfillment>;
}
