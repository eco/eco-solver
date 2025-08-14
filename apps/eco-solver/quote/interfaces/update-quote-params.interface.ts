import { QuoteDataEntryDTO } from '@/quote/dto/quote-data-entry.dto'

export interface UpdateQuoteParams {
  quoteDataEntry?: QuoteDataEntryDTO
  error?: any
}
