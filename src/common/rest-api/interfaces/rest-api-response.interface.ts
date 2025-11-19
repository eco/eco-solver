export interface RESTAPIResponse<T> {
  response?: T;
  status: number;
  error?: unknown;
  additionalErrorData?: unknown;
}
