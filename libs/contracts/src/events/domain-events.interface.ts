// Domain events interface
export interface DomainEvent {
  type: string;
  aggregateId: string;
  timestamp: Date;
  data: any;
}