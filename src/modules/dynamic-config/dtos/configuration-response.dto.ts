import { ConfigurationType } from '@/modules/dynamic-config/enums/configuration-type.enum';

export class ConfigurationResponseDTO {
  id: string;
  key: string;
  value: any;
  type: ConfigurationType;
  isRequired: boolean;
  isSecret: boolean;
  description?: string;
  lastModifiedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class GetConfigurationResponseDTO {
  success: boolean;
  data: ConfigurationResponseDTO;
}

export class GetAllConfigurationsResponseDTO {
  success: boolean;
  data: ConfigurationResponseDTO[];
  count: number;
}

export class CreateConfigurationResponseDTO {
  success: boolean;
  message: string;
  data: ConfigurationResponseDTO;
}

export class UpdateConfigurationResponseDTO {
  success: boolean;
  message: string;
  data: ConfigurationResponseDTO;
}

export class DeleteConfigurationResponseDTO {
  success: boolean;
  message: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export class PaginatedConfigurationResponseDTO {
  data: ConfigurationResponseDTO[];
  pagination: PaginationInfo;
}
