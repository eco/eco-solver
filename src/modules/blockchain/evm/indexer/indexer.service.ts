import { Injectable } from '@nestjs/common';

import { GraphQLClient } from 'graphql-request';

import { toError } from '@/common/utils/error-handler';
import { SystemLoggerService } from '@/modules/logging';

import {
  FULFILLED_INTENTS_QUERY,
  type FulfilledIntentsResponse,
  type FulfilledIntentsVariables,
} from './queries/fulfilled-intents.query';
import {
  FUNDED_INTENTS_QUERY,
  type FundedIntentsResponse,
  type FundedIntentsVariables,
} from './queries/funded-intents.query';
import {
  PUBLISHED_INTENTS_QUERY,
  type PublishedIntentsResponse,
  type PublishedIntentsVariables,
} from './queries/published-intents.query';
import {
  WITHDRAWN_INTENTS_QUERY,
  type WithdrawnIntentsResponse,
  type WithdrawnIntentsVariables,
} from './queries/withdrawn-intents.query';
import type {
  IndexedFulfillment,
  IndexedIntent,
  IndexedRefund,
  IndexedWithdrawal,
} from './types/intent.types';
import { IndexerConfigService } from './indexer-config.service';

@Injectable()
export class IndexerService {
  private readonly client: GraphQLClient;

  constructor(
    private readonly indexerConfigService: IndexerConfigService,
    private readonly logger: SystemLoggerService,
  ) {
    this.logger.setContext(IndexerService.name);
    this.client = new GraphQLClient(this.indexerConfigService.url);
  }

  /**
   * Query published intents with automatic pagination
   * Iterates until hasNextPage is false
   */
  async *queryPublishedIntents(
    variables: PublishedIntentsVariables,
  ): AsyncGenerator<IndexedIntent[]> {
    let hasMore = true;
    let cursor: string | undefined;

    while (hasMore) {
      try {
        const response = await this.client.request<PublishedIntentsResponse>(
          PUBLISHED_INTENTS_QUERY,
          {
            ...variables,
            since: variables.since.toString(), // Convert BigInt to string for GraphQL
            after: cursor,
          },
        );

        const { items, pageInfo } = response.intents;

        if (items.length > 0) {
          yield items;
        }

        hasMore = pageInfo.hasNextPage;
        cursor = pageInfo.endCursor ?? undefined;

        this.logger.debug(`Fetched ${items.length} published intents, hasNextPage: ${hasMore}`);
      } catch (error) {
        this.logger.error(`Failed to fetch published intents`, toError(error));
        throw error;
      }
    }
  }

  /**
   * Query fulfilled intents with automatic pagination
   * Iterates until hasNextPage is false
   */
  async *queryFulfilledIntents(
    variables: FulfilledIntentsVariables,
  ): AsyncGenerator<IndexedFulfillment[]> {
    let hasMore = true;
    let cursor: string | undefined;

    while (hasMore) {
      try {
        const response = await this.client.request<FulfilledIntentsResponse>(
          FULFILLED_INTENTS_QUERY,
          {
            ...variables,
            since: variables.since.toString(), // Convert BigInt to string for GraphQL
            after: cursor,
          },
        );

        const { items, pageInfo } = response.fulfillments;

        if (items.length > 0) {
          yield items;
        }

        hasMore = pageInfo.hasNextPage;
        cursor = pageInfo.endCursor ?? undefined;

        this.logger.debug(`Fetched ${items.length} fulfilled intents, hasNextPage: ${hasMore}`);
      } catch (error) {
        this.logger.error(`Failed to fetch fulfilled intents`, toError(error));
        throw error;
      }
    }
  }

  /**
   * Query withdrawn intents with automatic pagination
   * Iterates until hasNextPage is false
   */
  async *queryWithdrawnIntents(
    variables: WithdrawnIntentsVariables,
  ): AsyncGenerator<IndexedWithdrawal[]> {
    let hasMore = true;
    let cursor: string | undefined;

    while (hasMore) {
      try {
        const response = await this.client.request<WithdrawnIntentsResponse>(
          WITHDRAWN_INTENTS_QUERY,
          {
            ...variables,
            since: variables.since.toString(), // Convert BigInt to string for GraphQL
            after: cursor,
          },
        );

        const { items, pageInfo } = response.withdrawals;

        if (items.length > 0) {
          yield items;
        }

        hasMore = pageInfo.hasNextPage;
        cursor = pageInfo.endCursor ?? undefined;

        this.logger.debug(`Fetched ${items.length} withdrawn intents, hasNextPage: ${hasMore}`);
      } catch (error) {
        this.logger.error(`Failed to fetch withdrawn intents`, toError(error));
        throw error;
      }
    }
  }

  /**
   * Query funded intents (refunds) with automatic pagination
   * Iterates until hasNextPage is false
   */
  async *queryFundedIntents(variables: FundedIntentsVariables): AsyncGenerator<IndexedRefund[]> {
    let hasMore = true;
    let cursor: string | undefined;

    while (hasMore) {
      try {
        const response = await this.client.request<FundedIntentsResponse>(FUNDED_INTENTS_QUERY, {
          ...variables,
          since: variables.since.toString(), // Convert BigInt to string for GraphQL
          after: cursor,
        });

        const { items, pageInfo } = response.refunds;

        if (items.length > 0) {
          yield items;
        }

        hasMore = pageInfo.hasNextPage;
        cursor = pageInfo.endCursor ?? undefined;

        this.logger.debug(
          `Fetched ${items.length} funded intents (refunds), hasNextPage: ${hasMore}`,
        );
      } catch (error) {
        this.logger.error(`Failed to fetch funded intents`, toError(error));
        throw error;
      }
    }
  }
}
