import { AuditOperation } from '@/modules/dynamic-config/enums/audit-operation.enum';

export class ConfigurationAuditResponseDTO {
  configKey: string;
  operation: AuditOperation;
  oldValue?: any;
  newValue?: any;
  userId: string;
  userAgent?: string;
  timestamp: Date;
}

export class GetAuditHistoryResponseDTO {
  success: boolean;
  data: ConfigurationAuditResponseDTO[];
  count: number;
}

export class AuditLogResponseDTO {
  id: string;
  configKey: string;
  operation: AuditOperation;
  oldValue?: any;
  newValue?: any;
  userId: string;
  userAgent?: string;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class PaginatedAuditResponseDTO {
  data: AuditLogResponseDTO[];
  total: number;
  pagination?: {
    offset: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}
