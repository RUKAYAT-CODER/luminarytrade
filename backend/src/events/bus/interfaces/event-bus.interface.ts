import { DomainEvent } from '../../base/domain-event.base';

export interface IEventHandler<T extends DomainEvent = DomainEvent> {
  handle(event: T): Promise<void>;
}

export interface IEventBus {
  /**
   * Publish an event to all registered handlers
   */
  publish<T extends DomainEvent>(event: T): Promise<void>;

  /**
   * Subscribe a handler to an event type
   */
  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: IEventHandler<T>,
  ): void;

  /**
   * Unsubscribe a handler from an event type
   */
  unsubscribe<T extends DomainEvent>(
    eventType: string,
    handler: IEventHandler<T>,
  ): void;

  /**
   * Publish multiple events
   */
  publishAll<T extends DomainEvent>(events: T[]): Promise<void>;
}

export interface EventBusOptions {
  /**
   * Maximum number of concurrent handlers per event
   */
  concurrency?: number;

  /**
   * Enable retry on handler failure
   */
  retryEnabled?: boolean;

  /**
   * Maximum retry attempts
   */
  maxRetries?: number;

  /**
   * Base delay for exponential backoff (ms)
   */
  baseRetryDelay?: number;

  /**
   * Maximum retry delay (ms)
   */
  maxRetryDelay?: number;

  /**
   * Enable dead letter queue for failed events
   */
  deadLetterEnabled?: boolean;
}
