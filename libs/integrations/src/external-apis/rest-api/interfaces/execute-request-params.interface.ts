export interface ExecuteRequestParams extends RequestUrlParams {
  method: string
  body?: any
  idempotentID?: string
  queryParamsObject?: any
  additionalHeaders?: object
}
