import { RequestUrlParams } from './request-url-params.interface'

export interface ExecuteRequestParams extends RequestUrlParams {
  method: string
  body?: any
  idempotentID?: string
  queryParamsObject?: any
  additionalHeaders?: Record<string, string>
}
