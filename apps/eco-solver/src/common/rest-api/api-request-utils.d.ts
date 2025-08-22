import { RESTAPIResponse } from './interfaces/rest-api-response.interface';
export declare class APIRequestUtils {
    handleResponse<T>(response: any): RESTAPIResponse<T>;
    handleError<T>(error: any): RESTAPIResponse<T>;
    private getError;
}
