/**
 * Errors that can be thrown by the quote service
 */
export interface QuoteErrorsInterface {
  statusCode: number
  message: string
  code: number

  [key: string]: any
}

export type Quote400 = QuoteErrorsInterface & {
  statusCode: 400
}

export type Quote500 = QuoteErrorsInterface & {
  statusCode: 500
}