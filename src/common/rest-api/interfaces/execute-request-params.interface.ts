import { RequestUrlParams } from './request-url-params.interface';

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface ExecuteRequestParams extends RequestUrlParams {
  method: HttpMethod;
  body?: any;
  idempotentID?: string;
  queryParamsObject?: any;
  additionalHeaders?: Record<string, string>;
}
