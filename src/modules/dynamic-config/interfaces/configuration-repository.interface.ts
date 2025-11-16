import { SortOrder } from '@/modules/dynamic-config/enums/sort-order.enum';
import { ConfigurationDocument } from '@/modules/dynamic-config/schemas/configuration.schema';

export interface CreateConfigurationDTO {
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  isRequired?: boolean;
  description?: string;
  lastModifiedBy?: string;
}

export interface UpdateConfigurationDTO {
  value?: any;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  isRequired?: boolean;
  description?: string;
  lastModifiedBy?: string;
}

export interface ConfigurationFilter {
  keys?: string[];
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  isRequired?: boolean;
  lastModifiedBy?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
}

export interface BulkConfigurationOperation {
  key: string;
  operation: 'create' | 'update' | 'delete';
  data?: CreateConfigurationDTO | UpdateConfigurationDTO;
}

export interface BulkOperationResult {
  successful: Array<{
    key: string;
    operation: 'create' | 'update' | 'delete';
    document?: ConfigurationDocument;
  }>;
  failed: Array<{
    key: string;
    operation: 'create' | 'update' | 'delete';
    error: string;
  }>;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: SortOrder;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface IConfigurationRepository {
  // Basic CRUD operations
  create(data: CreateConfigurationDTO): Promise<ConfigurationDocument>;
  findByKey(key: string): Promise<ConfigurationDocument | null>;
  findAllWithFilteringAndPagination(
    filter: ConfigurationFilter,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<ConfigurationDocument>>;
  update(key: string, data: UpdateConfigurationDTO): Promise<ConfigurationDocument | null>;
  delete(key: string): Promise<boolean>;

  // Bulk operations
  bulkOperations(operations: BulkConfigurationOperation[]): Promise<BulkOperationResult>;
  bulkCreate(configurations: CreateConfigurationDTO[]): Promise<BulkOperationResult>;
  bulkUpdate(
    updates: Array<{ key: string; data: UpdateConfigurationDTO }>,
  ): Promise<BulkOperationResult>;
  bulkDelete(keys: string[]): Promise<BulkOperationResult>;

  // Validation and utility methods
  validateConfiguration(data: CreateConfigurationDTO | UpdateConfigurationDTO): Promise<string[]>;
  exists(key: string): Promise<boolean>;
  count(filter?: ConfigurationFilter): Promise<number>;

  // Specialized queries
  findRequired(): Promise<ConfigurationDocument[]>;
  findByType(
    type: 'string' | 'number' | 'boolean' | 'object' | 'array',
  ): Promise<ConfigurationDocument[]>;
  findByModifier(
    userId: string,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<ConfigurationDocument>>;
  findMissingRequired(requiredKeys: string[]): Promise<string[]>;

  // Health and maintenance
  healthCheck(): Promise<boolean>;
  getStatistics(): Promise<{
    total: number;
    byType: Record<string, number>;
    required: number;
    lastModified: Date | null;
  }>;
}
