// Intent repository interface  
import { IntentEntity } from '../entities';

export interface IIntentRepository {
  findById(id: string): Promise<IntentEntity | null>;
  save(intent: IntentEntity): Promise<IntentEntity>;
}