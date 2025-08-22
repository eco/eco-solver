import { INestApplication } from '@nestjs/common';
import request from 'supertest';
export declare class EcoTesterHttp {
    private readonly app;
    constructor(app: INestApplication);
    post(url: string, payload?: any, headers?: any): request.Test;
    patch(url: string, payload: any, headers?: any): request.Test;
    get(url: string, headers?: any): request.Test;
    delete(url: string, headers?: any): request.Test;
}
