import { gql } from 'graphql-request';

import type { IndexedIntent } from '../types/intent.types';
import type { PaginatedResponse } from '../types/pagination.types';

export const PUBLISHED_INTENTS_QUERY = gql`
  query PublishedIntents($portalAddresses: [String!]!, $since: BigInt!, $after: String) {
    intents(
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
        params
        transactionHash
        blockNumber
        blockTimestamp
        evt_log_address
        evt_log_index
        from
      }
    }
  }
`;

export interface PublishedIntentsVariables {
  portalAddresses: string[];
  since: bigint;
  after?: string;
}

export interface PublishedIntentsResponse {
  intents: PaginatedResponse<IndexedIntent>;
}
