import { v4 as uuidv4 } from 'uuid';

/**
 * Base class for all domain events
 * Domain events represent significant business occurrences
 */
export abstract class DomainEvent {
  public readonly eventId: string;
  public readonly aggregateId: string;
  public readonly eventType: string;
  public readonly aggregateType: string;
  public readonly timestamp: Date;
  public readonly metadata: Record<string, any>;
  public readonly expectedVersion?: number;

  constructor(params: {
    aggregateId: string;
    aggregateType: string;
    eventType: string;
    metadata?: Record<string, any>;
    expectedVersion?: number;
  }) {
    this.eventId = uuidv4();
    this.aggregateId = params.aggregateId;
    this.aggregateType = params.aggregateType;
    this.eventType = params.eventType;
    this.timestamp = new Date();
    this.metadata = params.metadata || {};
    this.expectedVersion = params.expectedVersion;
  }

  /**
   * Convert event to payload for storage
   */
  abstract toPayload(): Record<string, any>;

  /**
   * Create event from stored payload (for replay)
   */
  static fromPayload<T extends DomainEvent>(
    this: new (params: any) => T,
    payload: Record<string, any>,
    aggregateId: string,
    metadata?: Record<string, any>,
  ): T {
    return new this({
      aggregateId,
      aggregateType: (this.prototype as any).aggregateType || 'Unknown',
      eventType: (this.prototype as any).eventType || '',
      metadata,
    });
  }
}
