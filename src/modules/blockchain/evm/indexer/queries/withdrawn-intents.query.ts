import { gql } from 'graphql-request';

import type { IndexedWithdrawal } from '../types/intent.types';
import type { PaginatedResponse } from '../types/pagination.types';

export const WITHDRAWN_INTENTS_QUERY = gql`
  query WithdrawnIntents($portalAddresses: [String!]!, $since: BigInt!, $after: String) {
    withdrawals(
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

export interface WithdrawnIntentsVariables {
  portalAddresses: string[];
  since: bigint;
  after?: string;
}

export interface WithdrawnIntentsResponse {
  withdrawals: PaginatedResponse<IndexedWithdrawal>;
}
