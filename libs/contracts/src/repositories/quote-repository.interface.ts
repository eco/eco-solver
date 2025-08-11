// Quote repository interface
import { QuoteEntity } from '../entities';

export interface IQuoteRepository {
  findById(id: string): Promise<QuoteEntity | null>;
  save(quote: QuoteEntity): Promise<QuoteEntity>;
}