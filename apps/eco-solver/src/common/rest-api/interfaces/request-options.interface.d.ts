import { AxiosRequestConfig } from 'axios';
export interface RequestOptions {
    method: string;
    url: string;
    data?: string;
    config?: AxiosRequestConfig;
}
