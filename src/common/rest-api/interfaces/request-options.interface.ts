import { AxiosRequestConfig } from 'axios';
import { HttpMethod } from '@/common/rest-api/interfaces/execute-request-params.interface';

export interface RequestOptions {
  method: HttpMethod;
  url: string;
  data?: any;
  config?: AxiosRequestConfig;
}
