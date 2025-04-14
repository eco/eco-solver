import { APIConfig } from './interfaces/api-config.interface'
import { APIRequestUtils } from './api-request-utils'
import { AxiosRequestConfig } from 'axios'
import { EcoLogMessage } from '../logging/eco-log-message'
import { ExecuteRequestParams } from './interfaces/execute-request-params.interface'
import { HttpService } from '@nestjs/axios'
import { Logger } from '@nestjs/common'
import { RequestOptions } from './interfaces/request-options.interface'
import { RequestUrlParams } from './interfaces/request-url-params.interface'
import { RESTAPIResponse } from './interfaces/rest-api-response.interface'
import * as _ from 'lodash'
import * as path from 'path'
import * as url from 'url'

export class APIRequestExecutor {
  private apiRequestUtils: APIRequestUtils

  constructor(
    private httpService: HttpService,
    private apiConfig: APIConfig,
    protected logger: Logger,
  ) {
    this.apiRequestUtils = new APIRequestUtils()
  }

  async executeRequest<T>(requestParams: ExecuteRequestParams): Promise<RESTAPIResponse<T>> {
    const requestOptions = this.getRequestOptions(requestParams)
    this.logRequest(requestOptions)

    const { method, url: requestURL, data, config } = requestOptions

    let req: any

    switch (method) {
      case 'get':
        req = this.httpService.get(requestURL, config)
        break

      case 'post':
        req = this.httpService.post(requestURL, data, config)
        break

      case 'put':
        req = this.httpService.put(requestURL, data, config)
        break

      case 'patch':
        req = this.httpService.patch(requestURL, data, config)
        break

      case 'delete':
        req = this.httpService.delete(requestURL, config)
        break
    }

    return this._executeRequest<T>(req, requestOptions)
  }

  logRequest(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
    requestOptions: RequestOptions,
    // eslint-disable-next-line @typescript-eslint/no-empty-function, no-empty-function
  ) {}

  getRequestOptions(requestParams: ExecuteRequestParams): RequestOptions {
    return {
      method: requestParams.method,
      url: this.getURL(requestParams).href,
      data: requestParams.body,
      config: this.getAxiosRequestConfig(requestParams),
    }
  }

  private getAxiosRequestConfig(requestParams: ExecuteRequestParams): AxiosRequestConfig {
    const { idempotentID, additionalHeaders: additionalHeadersIn } = requestParams

    const additionalHeaders = additionalHeadersIn || {}

    if (idempotentID) {
      const idempotentIDHeader = this.getIdempotentIDHeader()
      if (idempotentIDHeader) {
        additionalHeaders[idempotentIDHeader] = idempotentID
      }
    }

    return {
      headers: {
        ...this.getRequestHeaders(requestParams),
        ...additionalHeaders,
      },
      maxRedirects: 0,
    }
  }

  getBaseURLString(urlParams: RequestUrlParams): string {
    return this.getBaseURL(urlParams).href
  }

  private getBaseURL(urlParams: RequestUrlParams): URL {
    const { endPoint, apiVersion, pathParams: pathParamsIn, pathSuffix: pathSuffixIn } = urlParams

    const pathParams = pathParamsIn || ''
    const pathSuffix = pathSuffixIn || ''
    const apiPath = this.apiConfig.apiPath || ''
    const version = this.apiConfig.addVersionToUrl ? apiVersion || this.getDefaultAPIVersion() : ''

    const baseURL = new URL(this.apiConfig.baseUrl)

    const pathname = path.join(apiPath, version, endPoint, pathParams, pathSuffix)

    baseURL.pathname = path.join(baseURL.pathname, pathname)

    return baseURL
  }

  private getURL(requestParams: ExecuteRequestParams): URL {
    const baseURL = this.getBaseURL(requestParams)
    baseURL.search = this.getQueryString(requestParams.queryParamsObject)

    return baseURL
  }

  getIdempotentIDHeader(): string | undefined {
    return this.apiConfig.idempotentIDHeader
  }

  private getAPIKeyHeader(): string | undefined {
    return this.apiConfig.apiKeyHeader
  }

  private getAPISecretHeader(): string | undefined {
    return this.apiConfig.apiSecretHeader
  }

  protected getAPIKey(): string | undefined {
    return this.apiConfig.apiKey
  }

  private getAPISecret(): string | undefined {
    return this.apiConfig.apiSecret
  }

  getDefaultAPIVersion(): string {
    return ''
  }

  getDefaultRequestHeaders(): object {
    const headers: any = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }

    return headers
  }

  getRequestHeaders(requestParams: ExecuteRequestParams): object {
    const authorization = this.getAuthorization(requestParams)

    const headers: any = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }

    if (authorization) {
      headers.Authorization = authorization
    }

    const apiKeyHeader = this.getAPIKeyHeader()
    if (apiKeyHeader) {
      const apiKey = this.getAPIKey()
      if (apiKey) {
        headers[apiKeyHeader] = apiKey
      }
    }

    const apiSecretHeader = this.getAPISecretHeader()
    if (apiSecretHeader) {
      const apiSecret = this.getAPISecret()
      if (apiSecret) {
        headers[apiSecretHeader] = apiSecret
      }
    }

    return headers
  }

  getAuthorization(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
    requestParams: ExecuteRequestParams,
  ): string | undefined {
    return undefined
  }

  getQueryString(queryParamsObject: any): string {
    if (!queryParamsObject) {
      return ''
    }

    let queryStr = new url.URLSearchParams(queryParamsObject).toString()
    if (queryStr.length > 0) {
      queryStr = `?${queryStr}`
    }

    return queryStr
  }

  private async _executeRequest<T>(
    req: any,
    requestOptions: RequestOptions,
  ): Promise<RESTAPIResponse<T>> {
    try {
      const response = await req.toPromise()
      return this.handleResponse<T>(response)
    } catch (ex) {
      const errorResponse = this.handleError<T>(ex)

      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Error executing HTTP request`,
          properties: {
            errorMessage: errorResponse.error,
            request: this.getRequestForLogging(requestOptions),
          },
        }),
      )

      return errorResponse
    }
  }

  private getRequestForLogging(requestOptions: RequestOptions): object {
    return _.omit(requestOptions, ['config', 'data'])
  }

  private handleResponse<T>(response: any): RESTAPIResponse<T> {
    return this.apiRequestUtils.handleResponse<T>(response)
  }

  private handleError<T>(error: any): RESTAPIResponse<T> {
    return this.apiRequestUtils.handleError<T>(error)
  }
}
