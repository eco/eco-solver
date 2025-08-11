export class EcoTesterHttp {
  constructor(private readonly app: INestApplication) {}

  post(url: string, payload: any = {}, headers: any = {}): request.Test {
    return request(this.app.getHttpServer()).post(url).set(headers).send(payload)
  }

  patch(url: string, payload: any, headers: any = {}): request.Test {
    return request(this.app.getHttpServer()).patch(url).set(headers).send(payload)
  }

  get(url: string, headers: any = {}): request.Test {
    return request(this.app.getHttpServer()).get(url).set(headers).send()
  }

  delete(url: string, headers: any = {}): request.Test {
    return request(this.app.getHttpServer()).delete(url).set(headers).send()
  }
}
