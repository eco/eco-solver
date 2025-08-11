export class APIRequestUtils {
  constructor() {}

  handleResponse<T>(response: any): RESTAPIResponse<T> {
    const { status, data: responseData } = response

    return {
      status,
      response: responseData,
    }
  }

  handleError<T>(error: any): RESTAPIResponse<T> {
    delete error.stack
    delete error.config
    return this.getError<T>(error)
  }

  private getError<T>(ex: any): RESTAPIResponse<T> {
    let error: any
    const { response } = ex

    if (response) {
      const { status, data } = response
      if (data) {
        ;({ error } = data)
        if (error) {
          return {
            status,
            error,
            additionalErrorData: data,
          }
        }

        return {
          status,
          error: data,
        }
      }
    }

    let finalError: any
    ;({ error } = ex)
    if (error) {
      finalError = error
    } else {
      finalError = {
        message: ex.message || ex,
      }
    }

    return {
      status: -1,
      error: finalError,
    }
  }
}
