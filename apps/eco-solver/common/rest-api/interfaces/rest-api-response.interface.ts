export interface RESTAPIResponse<T> {
  response?: T
  status: number
  error?: any
  additionalErrorData?: any
}
